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
  owner?: string;
  repo?: string;
}) {
  const client = await getDSQLClient();
  try {
    await client.query(
      `INSERT INTO branches
        (team_id, pr_number, clone_cluster_id, endpoint, anonymized_columns, vercel_env_id, state, cost_estimate_daily, ready_in_seconds, owner, repo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        '00000000-0000-0000-0000-000000000001', // default team_id for hackathon
        data.prNumber,
        data.cloneClusterId,
        data.endpoint,
        JSON.stringify(data.anonymizedColumns),
        data.vercelEnvId,
        data.state,
        0.11,
        28,
        data.owner || '',
        data.repo || '',
      ]
    );
  } finally {
    await client.end();
  }
}

export async function updateBranchState(cloneClusterId: string, state: string, extra?: Partial<{
  vercelEnvId: string;
  anonymizedColumns: string[];
  instanceId: string;
}>) {
  const client = await getDSQLClient();
  try {
    if (extra?.vercelEnvId !== undefined) {
      await client.query(
        `UPDATE branches SET state=$1, vercel_env_id=$2, anonymized_columns=$3 WHERE clone_cluster_id=$4`,
        [state, extra.vercelEnvId, JSON.stringify(extra.anonymizedColumns || []), cloneClusterId]
      );
    } else {
      await client.query(
        `UPDATE branches SET state=$1 WHERE clone_cluster_id=$2`,
        [state, cloneClusterId]
      );
    }
  } finally {
    await client.end();
  }
}

export async function getBranchesByState(state: string) {
  const client = await getDSQLClient();
  try {
    const res = await client.query(
      `SELECT * FROM branches WHERE state=$1`,
      [state]
    );
    return res.rows;
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