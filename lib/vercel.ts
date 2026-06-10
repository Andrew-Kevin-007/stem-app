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
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.id;
  }

  // If DATABASE_URL already exists, find it and PATCH the value instead.
  const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
  const isAlreadyExists =
    res.status === 400 &&
    (JSON.stringify(errBody).includes('already') || JSON.stringify(errBody).includes('exists'));

  if (isAlreadyExists) {
    const listRes = await fetch(
      `https://api.vercel.com/v9/projects/${VERCEL_PROJECT_ID}/env`,
      { headers: { Authorization: `Bearer ${VERCEL_TOKEN}` } }
    );
    if (listRes.ok) {
      const listData = await listRes.json() as { envs?: Array<{ id: string; key: string }> };
      const existing = listData.envs?.find((e) => e.key === 'DATABASE_URL');
      if (existing) {
        const patchRes = await fetch(
          `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env/${existing.id}`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${VERCEL_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ value: dbUrl }),
          }
        );
        if (!patchRes.ok) {
          throw new Error(`Vercel env update failed: ${await patchRes.text()}`);
        }
        const patchData = await patchRes.json() as { id?: string };
        return patchData.id ?? existing.id;
      }
    }
  }

  throw new Error(`Vercel env inject failed: ${JSON.stringify(errBody)}`);
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