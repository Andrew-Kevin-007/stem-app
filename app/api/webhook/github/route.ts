import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { waitUntil } from '@vercel/functions';

export const maxDuration = 300;

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.GITHUB_WEBHOOK_SECRET!;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
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

  if (event === 'pull_request' && action === 'opened') {
    // Fire and forget — don't await, respond to GitHub immediately
    waitUntil(handlePROpened(body.pull_request, body.repository));
    return NextResponse.json({ ok: true, message: 'PR opened — processing' });
  }

  if (event === 'pull_request' && action === 'closed') {
    waitUntil(handlePRClosed(body.pull_request, body.repository));
    return NextResponse.json({ ok: true, message: 'PR closed — processing' });
  }

  return NextResponse.json({ ok: true, message: 'Event ignored' });
}

async function handlePROpened(pr: any, repo: any) {
  const { number: prNumber, head } = pr;
  const { full_name: repoFullName } = repo;
  const [owner, repoName] = repoFullName.split('/');

  console.log(`PR #${prNumber} opened in ${repoFullName}`);

  try {
    // Step 1: Create Aurora clone
    const { createAuroraClone } = await import('@/lib/aurora');
    const { cloneId, endpoint } = await createAuroraClone(prNumber);
    console.log(`Clone created: ${cloneId} at ${endpoint}`);

    // Step 2: Run PII anonymization
    const { runAnonymization } = await import('@/lib/anonymizer');
    const anonymizedCols = await runAnonymization(endpoint);
    console.log(`Anonymized: ${anonymizedCols.join(', ')}`);

    // Step 3: Inject DATABASE_URL into Vercel
    const { injectVercelEnvVar } = await import('@/lib/vercel');
    const envId = await injectVercelEnvVar(prNumber, endpoint);
    console.log(`Vercel env injected: ${envId}`);

    // Step 4: Save branch record to DSQL
    const { saveBranch } = await import('@/lib/dsql');
    await saveBranch({
      prNumber,
      cloneClusterId: cloneId,
      endpoint,
      anonymizedColumns: anonymizedCols,
      vercelEnvId: envId,
      state: 'active',
    });

    // Step 5: Post PR comment
    const { postBranchComment } = await import('@/lib/github');
    await postBranchComment(owner, repoName, prNumber, {
      cloneId,
      anonymizedCols,
      costPerDay: 0.11,
      readyInSeconds: 28,
    });

    console.log(`PR #${prNumber} fully processed`);
  } catch (err) {
    console.error(`Error processing PR #${prNumber}:`, err);
  }
}

async function handlePRClosed(pr: any, repo: any) {
  const { number: prNumber } = pr;
  const [owner, repoName] = repo.full_name.split('/');

  console.log(`PR #${prNumber} closed — destroying clone`);

  try {
    const { getBranchByPR, markBranchDestroyed } = await import('@/lib/dsql');
    const branch = await getBranchByPR(prNumber);
    if (!branch) return;

    const { deleteAuroraClone } = await import('@/lib/aurora');
    await deleteAuroraClone(branch.clone_cluster_id);

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