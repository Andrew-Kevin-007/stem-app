import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Lightweight uptime + configuration probe. Presence booleans only, no secret
// values, no DSQL connection (keeps it cheap to poll). The dashboard proxy
// pings this to report backend reachability.
export async function GET() {
  const config = {
    dsql: !!process.env.DSQL_ENDPOINT,
    aws: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    github_app: !!(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY),
    webhook_secret: !!process.env.GITHUB_WEBHOOK_SECRET,
    internal_token: !!process.env.STEM_INTERNAL_TOKEN,
    aurora_source: !!process.env.AURORA_SOURCE_CLUSTER_ID,
  };
  return NextResponse.json(
    { ok: true, service: 'stem-backend', time: new Date().toISOString(), config },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
