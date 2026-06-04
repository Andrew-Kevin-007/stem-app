import { DsqlSigner } from '@aws-sdk/dsql-signer';
import { Client } from 'pg';

async function getDSQLClient(): Promise<Client> {
  const endpoint = process.env.DSQL_ENDPOINT!;
  const signer = new DsqlSigner({ hostname: endpoint, region: 'us-east-1' });
  const token = await signer.getDbConnectAdminAuthToken();

  const client = new Client({
    host: endpoint,
    port: 5432,
    user: 'admin',
    password: token,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  return client;
}

export async function saveBranch(data: {
  prNumber: number;
  cloneClusterId: string;
  endpoint: string;
  anonymizedColumns: string[];
  vercelEnvId: string;
  state: string;
}) {
  const client = await getDSQLClient();
  try {
    await client.query(
      `INSERT INTO branches (pr_number, clone_cluster_id, endpoint, anonymized_columns, vercel_env_id, state, cost_estimate_daily, ready_in_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.prNumber,
        data.cloneClusterId,
        data.endpoint,
        JSON.stringify(data.anonymizedColumns),
        data.vercelEnvId,
        data.state,
        0.11,
        28,
      ]
    );
  } finally {
    await client.end();
  }
}

export async function getBranchByPR(prNumber: number) {
  const client = await getDSQLClient();
  try {
    const res = await client.query(
      `SELECT * FROM branches WHERE pr_number = $1 AND destroyed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [prNumber]
    );
    return res.rows[0] || null;
  } finally {
    await client.end();
  }
}

export async function markBranchDestroyed(id: string) {
  const client = await getDSQLClient();
  try {
    await client.query(
      `UPDATE branches SET destroyed_at = NOW(), state = 'destroyed' WHERE id = $1`,
      [id]
    );
  } finally {
    await client.end();
  }
}

export async function getAllActiveBranches() {
  const client = await getDSQLClient();
  try {
    const res = await client.query(
      `SELECT * FROM branches WHERE destroyed_at IS NULL ORDER BY created_at DESC`
    );
    return res.rows;
  } finally {
    await client.end();
  }
}

export async function getAllPoolSlots() {
  const client = await getDSQLClient();
  try {
    const res = await client.query(`SELECT * FROM pool_slots ORDER BY created_at DESC`);
    return res.rows;
  } finally {
    await client.end();
  }
}