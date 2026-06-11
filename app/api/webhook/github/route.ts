import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';
import type { AuroraTarget } from '@/lib/aurora';

export const maxDuration = 300;

function verifySignature(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // timingSafeEqual throws on length mismatch — a malformed header must yield
  // a clean 401, never an unhandled 500.
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get('x-hub-signature-256');

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = req.headers.get('x-github-event');
  const body = JSON.parse(rawBody);
  const action = body.action;

  console.log(`GitHub event: ${event} / ${action}`);

  if (event === 'pull_request' && (action === 'opened' || action === 'reopened')) {
    // Fire and forget — don't await, respond to GitHub immediately
    waitUntil(handlePROpened(body.pull_request, body.repository));
    return NextResponse.json({ ok: true, message: `PR ${action} — processing` });
  }

  if (event === 'pull_request' && action === 'closed') {
    waitUntil(handlePRClosed(body.pull_request, body.repository));
    return NextResponse.json({ ok: true, message: 'PR closed — processing' });
  }

  return NextResponse.json({ ok: true, message: 'Event ignored' });
}

async function handlePROpened(pr: any, repo: any) {
  const { number: prNumber } = pr;
  const owner = repo.full_name.split('/')[0];
  const repoName = repo.name;

  console.log(`PR #${prNumber} opened — resolving tenant for ${owner}`);

  try {
    const { getUserConnectionByRepo } = await import('@/lib/dsql');
    const { assumeTenantRole, operatorLogin } = await import('@/lib/tenant');
    const { restoreCloneCluster } = await import('@/lib/aurora');

    // Resolve which AWS account this repo's clones land in. A connected tenant
    // provisions in THEIR account; everyone else falls back to the operator's
    // env-configured cluster (unchanged single-tenant behavior).
    const connection = await getUserConnectionByRepo(owner);

    if (!connection && owner.toLowerCase() !== operatorLogin().toLowerCase()) {
      // Unknown owner with no AWS connection — nothing we can safely do.
      // Return quietly; the webhook responder already 200'd to GitHub.
      console.log(`No AWS connection for ${owner} — skipping PR #${prNumber}`);
      return;
    }

    let target: AuroraTarget | undefined;
    if (connection) {
      const credentials = await assumeTenantRole(connection, `stem-pr-${prNumber}`);
      target = {
        credentials,
        region: connection.aurora_region,
        sourceClusterId: connection.aurora_cluster_id,
        subnetGroup: connection.aurora_subnet_group,
        securityGroupId: connection.aurora_sg_id,
      };
      console.log(`PR #${prNumber} → tenant ${owner} account ${connection.aws_account_id}`);
    }

    const { cloneId, endpoint } = await restoreCloneCluster(prNumber, target);

    const { saveBranch } = await import('@/lib/dsql');
    await saveBranch({
      prNumber,
      cloneClusterId: cloneId,
      endpoint,
      anonymizedColumns: [],
      vercelEnvId: '',
      state: 'cluster_ready',
      owner,
      repo: repoName,
    });

    console.log(`Cluster ready PR #${prNumber} — cron will continue`);
  } catch (err) {
    console.error(`Error PR #${prNumber}:`, err);
  }
}

async function handlePRClosed(pr: any, repo: any) {
  const { number: prNumber } = pr;
  const [owner, repoName] = repo.full_name.split('/');

  console.log(`PR #${prNumber} closed — destroying clone`);

  try {
    const { getBranchByPR, markBranchDestroyed, getUserConnectionByRepo } = await import('@/lib/dsql');
    const branch = await getBranchByPR(prNumber);
    if (!branch) return;

    // Tear down in the SAME account the clone was created in.
    const { assumeTenantRole } = await import('@/lib/tenant');
    const { deleteAuroraClone } = await import('@/lib/aurora');
    const connection = await getUserConnectionByRepo(owner);
    let target: AuroraTarget | undefined;
    if (connection) {
      const credentials = await assumeTenantRole(connection, `stem-pr-${prNumber}-del`);
      target = { credentials, region: connection.aurora_region };
    }

    await deleteAuroraClone(branch.clone_cluster_id, target);

    const { deleteVercelEnvVar } = await import('@/lib/vercel');
    await deleteVercelEnvVar(branch.vercel_env_id);

    await markBranchDestroyed(branch.id);

    const { postCloneDestroyed } = await import('@/lib/github');
    await postCloneDestroyed(owner, repoName, prNumber);

    console.log(`PR #${prNumber} clone destroyed`);
  } catch (err) {
    console.error(`Error destroying PR #${prNumber}:`, err);
  }
}