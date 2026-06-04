const VERCEL_TOKEN = process.env.VERCEL_TOKEN!;
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID!;

export async function injectVercelEnvVar(prNumber: number, dbEndpoint: string): Promise<string> {
  const dbUrl = `postgresql://${process.env.AURORA_MASTER_USER}:${process.env.AURORA_MASTER_PASSWORD}@${dbEndpoint}:5432/stemdb?sslmode=require`;

  const res = await fetch(`https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: 'DATABASE_URL',
      value: dbUrl,
      type: 'encrypted',
      target: ['preview'],
      gitBranch: `pr-${prNumber}`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vercel env inject failed: ${err}`);
  }

  const data = await res.json();
  return data.id;
}

export async function deleteVercelEnvVar(envId: string) {
  if (!envId) return;

  const res = await fetch(
    `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env/${envId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    }
  );

  if (!res.ok) {
    console.warn(`Failed to delete Vercel env var ${envId}: ${res.status}`);
  }
}