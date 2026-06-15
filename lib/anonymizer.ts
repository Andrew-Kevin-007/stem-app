import { Client } from 'pg';

/**
 * PII anonymizer.
 *
 * Two layers:
 *  1. High-confidence explicit rules for the canonical demo schema.
 *  2. Generic detection across ANY schema: scan information_schema for columns
 *     whose name matches a PII pattern and mask them with type-appropriate
 *     fake data. This is what lets STEM anonymize an arbitrary customer
 *     database, not just the demo tables.
 *
 * Bias is deliberately toward over-masking: writing fake data into a
 * non-sensitive column of a throwaway clone is harmless, while leaving a real
 * PII column unmasked is a breach. The caller treats "zero columns masked" as
 * a failure and refuses to expose the clone (fail closed).
 */

interface ExplicitRule {
  table: string;
  columns: Record<string, string>;
}

const EXPLICIT_RULES: ExplicitRule[] = [
  {
    table: 'users',
    columns: {
      email: `'user_' || floor(random()*1000000)::text || '@example.com'`,
      phone: `'+1' || floor(random()*9000000000+1000000000)::bigint::text`,
      full_name: `(ARRAY['Alice Smith','Bob Jones','Carol Brown','Dave Wilson','Eve Davis'])[floor(random()*5+1)::int]`,
    },
  },
  {
    table: 'payments',
    columns: {
      card_number: `'****-****-****-' || floor(random()*9000+1000)::text`,
      billing_address: `floor(random()*9999+1)::text || ' Example St, Anytown USA 10001'`,
    },
  },
];

// Ordered most-specific first; the first category whose pattern matches a
// column name wins. Each maps to a SQL expression producing fake data.
type Category =
  | 'email' | 'phone' | 'ssn' | 'card' | 'name' | 'address'
  | 'ip' | 'dob' | 'postal' | 'token';

const CATEGORY_PATTERNS: { category: Category; test: RegExp }[] = [
  { category: 'email', test: /email|e_mail/i },
  { category: 'ssn', test: /\bssn\b|social_?security|national_?id|tax_?id/i },
  { category: 'card', test: /card_?(number|no|num)|credit_?card|\bpan\b|cc_?number/i },
  { category: 'phone', test: /phone|mobile|telephone|fax|msisdn/i },
  { category: 'dob', test: /birth|dob\b|date_of_birth/i },
  { category: 'postal', test: /zip|postal|postcode/i },
  { category: 'address', test: /address|street|addr_?line|city/i },
  { category: 'ip', test: /ip_?addr|ip_?address|client_?ip|remote_?ip/i },
  { category: 'name', test: /first_?name|last_?name|full_?name|surname|given_?name|\bname\b/i },
  { category: 'token', test: /password|passwd|secret|api_?key|access_?token|private_?key|auth_?token/i },
];

// SQL fake-data expression per category, applicable to text-ish columns.
function maskExpr(category: Category, quotedCol: string): string {
  switch (category) {
    case 'email': return `'user_' || floor(random()*1000000)::text || '@example.com'`;
    case 'phone': return `'+1' || floor(random()*9000000000+1000000000)::bigint::text`;
    case 'ssn': return `lpad(floor(random()*900+100)::text,3,'0') || '-' || lpad(floor(random()*90+10)::text,2,'0') || '-' || lpad(floor(random()*9000+1000)::text,4,'0')`;
    case 'card': return `'****-****-****-' || lpad(floor(random()*9000+1000)::text,4,'0')`;
    case 'name': return `(ARRAY['Alice Smith','Bob Jones','Carol Brown','Dave Wilson','Eve Davis','Frank Hill','Grace Lee'])[floor(random()*7+1)::int]`;
    case 'address': return `floor(random()*9999+1)::text || ' Example St, Anytown USA 10001'`;
    case 'ip': return `'10.' || floor(random()*256)::text || '.' || floor(random()*256)::text || '.' || floor(random()*256)::text`;
    case 'dob': return `'1990-01-01'`;
    case 'postal': return `lpad(floor(random()*90000+10000)::text,5,'0')`;
    case 'token': return `'redacted_' || md5(random()::text)`;
    // exhaustive — keeps the compiler honest if a category is added
    default: return `'REDACTED'`;
  }
}

const TEXT_TYPES = new Set([
  'text', 'character varying', 'varchar', 'character', 'char', 'citext', 'name',
]);

function categorize(columnName: string): Category | null {
  for (const { category, test } of CATEGORY_PATTERNS) {
    if (test.test(columnName)) return category;
  }
  return null;
}

export interface AnonymizerConnection {
  user: string;
  password: string;
  database: string;
}

export interface AnonymizationResult {
  /** "table.column" entries that were masked. */
  columns: string[];
  /** total tables scanned (visibility into why a run masked nothing). */
  tablesScanned: number;
}

export async function runAnonymization(
  cloneEndpoint: string,
  conn?: AnonymizerConnection,
): Promise<AnonymizationResult> {
  const client = new Client({
    host: cloneEndpoint,
    port: 5432,
    user: conn?.user ?? process.env.AURORA_MASTER_USER!,
    password: conn?.password ?? process.env.AURORA_MASTER_PASSWORD!,
    database: conn?.database ?? 'stemdb',
    ssl: buildSsl(),
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  const masked = new Set<string>();
  let tablesScanned = 0;

  try {
    await client.query('BEGIN');

    // ── Layer 1: explicit high-confidence rules ──
    for (const rule of EXPLICIT_RULES) {
      const setClauses = Object.entries(rule.columns).map(([col, expr]) => `"${col}" = ${expr}`).join(', ');
      const ok = await tryUpdate(client, rule.table, setClauses);
      if (ok) for (const col of Object.keys(rule.columns)) masked.add(`${rule.table}.${col}`);
    }

    // ── Layer 2: generic detection across the public schema ──
    const cols = await client.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type
         FROM information_schema.columns
        WHERE table_schema = 'public'`,
    );
    const tables = new Set(cols.rows.map((r) => r.table_name));
    tablesScanned = tables.size;

    // Group maskable columns by table so each table is one UPDATE.
    const byTable = new Map<string, string[]>();
    for (const row of cols.rows) {
      if (!TEXT_TYPES.has(row.data_type)) continue; // only mask text columns generically
      const key = `${row.table_name}.${row.column_name}`;
      if (masked.has(key)) continue; // already covered by an explicit rule
      const category = categorize(row.column_name);
      if (!category) continue;
      const clause = `"${row.column_name}" = ${maskExpr(category, row.column_name)}`;
      const list = byTable.get(row.table_name) ?? [];
      list.push(clause);
      byTable.set(row.table_name, list);
      masked.add(key);
    }

    for (const [table, clauses] of byTable) {
      const ok = await tryUpdate(client, table, clauses.join(', '));
      if (!ok) {
        // Revert the optimistic bookkeeping for a table that failed to update.
        for (const key of [...masked]) if (key.startsWith(`${table}.`)) masked.delete(key);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  const columns = [...masked].sort();
  console.log(`Anonymization: ${columns.length} column(s) across ${tablesScanned} table(s)`);
  return { columns, tablesScanned };
}

/** Run one UPDATE inside a savepoint; swallow missing-table/column, rethrow the rest. */
async function tryUpdate(client: Client, table: string, setClause: string): Promise<boolean> {
  await client.query('SAVEPOINT sp');
  try {
    await client.query(`UPDATE "${table}" SET ${setClause}`);
    await client.query('RELEASE SAVEPOINT sp');
    return true;
  } catch (err) {
    await client.query('ROLLBACK TO SAVEPOINT sp');
    await client.query('RELEASE SAVEPOINT sp');
    const code = (err as { code?: string }).code;
    if (code === '42P01' || code === '42703') return false; // undefined_table / undefined_column
    throw err;
  }
}

/**
 * TLS for the clone connection. If AURORA_CA_CERT (PEM) is provided we verify
 * against it; otherwise fall back to an encrypted-but-unverified connection
 * (RDS presents a chain not in the default trust store). Supplying the RDS CA
 * bundle is the recommended production posture.
 */
function buildSsl(): { ca: string; rejectUnauthorized: true } | { rejectUnauthorized: false } {
  const ca = process.env.AURORA_CA_CERT;
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}
