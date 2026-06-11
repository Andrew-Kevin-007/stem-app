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
        process.env.STEM_TEAM_ID || '00000000-0000-0000-0000-000000000001',
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
    await client.query(
      `UPDATE branches SET state=$1, vercel_env_id=COALESCE($2, vercel_env_id), anonymized_columns=$3 WHERE clone_cluster_id=$4`,
      [
        state,
        extra?.vercelEnvId ?? null,
        JSON.stringify(extra?.anonymizedColumns ?? []),
        cloneClusterId,
      ]
    );
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

export async function getAllActiveBranches(ownerLogin?: string) {
  const client = await getDSQLClient();
  try {
    // Tenant isolation: when a login is supplied, return only that owner's
    // branches. Legacy rows were written with the operator's login.
    const res = ownerLogin
      ? await client.query(
          `SELECT * FROM branches WHERE destroyed_at IS NULL AND owner = $1 ORDER BY created_at DESC`,
          [ownerLogin]
        )
      : await client.query(
          `SELECT * FROM branches WHERE destroyed_at IS NULL ORDER BY created_at DESC`
        );
    return res.rows;
  } finally {
    await client.end();
  }
}

export interface UserConnection {
  github_login: string;
  aws_role_arn: string;
  aws_external_id: string;
  aws_account_id: string;
  aurora_cluster_id: string;
  aurora_subnet_group: string;
  aurora_sg_id: string;
  aurora_region: string;
  // master username + db name needed to connect to the clone for anonymization;
  // both default in the connect form so they add no friction for standard setups.
  aurora_master_user: string;
  aurora_database: string;
  connected_at: number;
}

export async function saveUserConnection(conn: UserConnection): Promise<void> {
  const client = await getDSQLClient();
  try {
    // Delete-then-insert instead of ON CONFLICT — DSQL's upsert support is
    // limited and a connect re-run replacing the row is the desired semantic.
    await client.query(`DELETE FROM user_connections WHERE github_login = $1`, [conn.github_login]);
    await client.query(
      `INSERT INTO user_connections
        (github_login, aws_role_arn, aws_external_id, aws_account_id,
         aurora_cluster_id, aurora_subnet_group, aurora_sg_id, aurora_region,
         aurora_master_user, aurora_database, connected_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        conn.github_login,
        conn.aws_role_arn,
        conn.aws_external_id,
        conn.aws_account_id,
        conn.aurora_cluster_id,
        conn.aurora_subnet_group,
        conn.aurora_sg_id,
        conn.aurora_region,
        conn.aurora_master_user,
        conn.aurora_database,
        conn.connected_at,
      ]
    );
  } finally {
    await client.end();
  }
}

export async function getUserConnectionByLogin(login: string): Promise<UserConnection | null> {
  const client = await getDSQLClient();
  try {
    const res = await client.query(`SELECT * FROM user_connections WHERE github_login = $1`, [login]);
    return (res.rows[0] as UserConnection | undefined) ?? null;
  } finally {
    await client.end();
  }
}

/** Repo owner login IS the tenant key — a user's connection covers their repos. */
export async function getUserConnectionByRepo(repoOwner: string): Promise<UserConnection | null> {
  return getUserConnectionByLogin(repoOwner);
}

export async function deleteUserConnection(login: string): Promise<void> {
  const client = await getDSQLClient();
  try {
    await client.query(`DELETE FROM user_connections WHERE github_login = $1`, [login]);
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