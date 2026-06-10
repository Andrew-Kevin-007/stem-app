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
  const { number: prNumber } = pr;
  const owner = repo.full_name.split('/')[0];
  const repoName = repo.name;

  console.log(`PR #${prNumber} opened — creating cluster`);

  try {
    const { RDSClient, RestoreDBClusterToPointInTimeCommand, DescribeDBClustersCommand } = await import('@aws-sdk/client-rds');
    const rds = new RDSClient({ region: 'us-east-1' });
    const cloneId = `stem-pr-${prNumber}-${Date.now()}`;

    await rds.send(new RestoreDBClusterToPointInTimeCommand({
      DBClusterIdentifier: cloneId,
      SourceDBClusterIdentifier: process.env.AURORA_SOURCE_CLUSTER_ID!,
      RestoreType: 'copy-on-write',
      UseLatestRestorableTime: true,
      DBSubnetGroupName: process.env.AURORA_SUBNET_GROUP!,
      VpcSecurityGroupIds: [process.env.AURORA_SECURITY_GROUP_ID!],
      Tags: [{ Key: 'stem-pr', Value: String(prNumber) }],
    }));

    let endpoint = '';
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: cloneId }));
      const status = res.DBClusters?.[0]?.Status;
      console.log(`Cluster: ${status}`);
      if (status === 'available') {
        endpoint = res.DBClusters![0].Endpoint!;
        break;
      }
    }

    if (!endpoint) throw new Error('Cluster timed out');

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