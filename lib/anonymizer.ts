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

export async function runAnonymization(cloneEndpoint: string): Promise<string[]> {
  const client = new Client({
    host: cloneEndpoint,
    port: 5432,
    user: process.env.AURORA_MASTER_USER!,
    password: process.env.AURORA_MASTER_PASSWORD!,
    database: 'stemdb',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
  });

  await client.connect();
  const anonymizedColumns: string[] = [];

  try {
    await client.query('BEGIN');

    for (const rule of ANONYMIZATION_RULES) {
      const setClauses = Object.entries(rule.columns)
        .map(([col, expr]) => {
          anonymizedColumns.push(`${rule.table}.${col}`);
          return `${col} = ${expr}`;
        })
        .join(', ');

      await client.query(`UPDATE "${rule.table}" SET ${setClauses}`);
      console.log(`Anonymized ${rule.table}: ${Object.keys(rule.columns).join(', ')}`);
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