import { Client } from 'pg';

const ANONYMIZATION_RULES = [
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

export interface AnonymizerConnection {
  user: string;
  password: string;
  database: string;
}

export async function runAnonymization(
  cloneEndpoint: string,
  conn?: AnonymizerConnection,
): Promise<string[]> {
  const client = new Client({
    host: cloneEndpoint,
    port: 5432,
    // Default: the operator's own cluster credentials from env. Tenant clones
    // pass explicit credentials (clone master password reset by the pipeline).
    user: conn?.user ?? process.env.AURORA_MASTER_USER!,
    password: conn?.password ?? process.env.AURORA_MASTER_PASSWORD!,
    database: conn?.database ?? 'stemdb',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  const anonymizedColumns: string[] = [];

  try {
    await client.query('BEGIN');

    for (const rule of ANONYMIZATION_RULES) {
      const setClauses = Object.entries(rule.columns)
        .map(([col, expr]) => `${col} = ${expr}`)
        .join(', ');

      // Tenant schemas vary — tolerate missing tables/columns per rule via
      // savepoints so one absent table doesn't roll back the whole pass.
      await client.query('SAVEPOINT rule_sp');
      try {
        await client.query(`UPDATE "${rule.table}" SET ${setClauses}`);
        anonymizedColumns.push(...Object.keys(rule.columns).map((col) => `${rule.table}.${col}`));
        console.log(`Anonymized ${rule.table}: ${Object.keys(rule.columns).join(', ')}`);
      } catch (ruleErr) {
        await client.query('ROLLBACK TO SAVEPOINT rule_sp');
        const code = (ruleErr as { code?: string }).code;
        // 42P01 undefined_table / 42703 undefined_column — schema simply
        // doesn't have this PII surface; skip. Anything else is fatal.
        if (code !== '42P01' && code !== '42703') throw ruleErr;
        console.log(`Skipped ${rule.table} (not in schema)`);
      }
      await client.query('RELEASE SAVEPOINT rule_sp');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }

  return anonymizedColumns;
}