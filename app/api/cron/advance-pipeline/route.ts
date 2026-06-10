import { NextResponse } from 'next/server';

export const maxDuration = 300;

export async function GET() {
  console.log('Pipeline cron running');

  const { getBranchesByState, updateBranchState } = await import('@/lib/dsql');
  const { RDSClient, CreateDBInstanceCommand, DescribeDBInstancesCommand } = await import('@aws-sdk/client-rds');
  const rds = new RDSClient({ region: 'us-east-1' });

  // --- Stage 1: cluster_ready → create instance ---
  const clusterReady = await getBranchesByState('cluster_ready');
  for (const branch of clusterReady) {
    console.log(`Creating instance for PR #${branch.pr_number}`);
    try {
      await rds.send(new CreateDBInstanceCommand({
        DBInstanceIdentifier: `${branch.clone_cluster_id}-w`,
        DBClusterIdentifier: branch.clone_cluster_id,
        DBInstanceClass: 'db.serverless',
        Engine: 'aurora-postgresql',
        PubliclyAccessible: true,
      }));
      await updateBranchState(branch.clone_cluster_id, 'instance_creating');
      console.log(`Instance creation started for PR #${branch.pr_number}`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        await updateBranchState(branch.clone_cluster_id, 'instance_creating');
      } else {
        console.error(`Instance create error PR #${branch.pr_number}:`, err);
      }
    }
  }

  // --- Stage 2: instance_creating → check + anonymize + inject + comment ---
  const instanceCreating = await getBranchesByState('instance_creating');
  for (const branch of instanceCreating) {
    try {
      const res = await rds.send(new DescribeDBInstancesCommand({
        DBInstanceIdentifier: `${branch.clone_cluster_id}-w`,
      }));
      const status = res.DBInstances?.[0]?.DBInstanceStatus;
      console.log(`Instance for PR #${branch.pr_number}: ${status}`);

      if (status === 'available') {
        console.log(`Instance ready for PR #${branch.pr_number} — running anonymization`);

        const { runAnonymization } = await import('@/lib/anonymizer');
        const { injectVercelEnvVar } = await import('@/lib/vercel');
        const { postBranchComment } = await import('@/lib/github');

        const anonymizedCols = await runAnonymization(branch.endpoint);
        console.log(`Anonymized PR #${branch.pr_number}: ${anonymizedCols.join(', ')}`);

        const envId = await injectVercelEnvVar(branch.pr_number, branch.endpoint);
        console.log(`Vercel env injected for PR #${branch.pr_number}`);

        await updateBranchState(branch.clone_cluster_id, 'active', {
          vercelEnvId: envId,
          anonymizedColumns: anonymizedCols,
        });

        await postBranchComment(branch.owner, branch.repo, branch.pr_number, {
          cloneId: branch.clone_cluster_id,
          anonymizedCols,
          costPerDay: 0.11,
          readyInSeconds: 28,
        });

        console.log(`PR #${branch.pr_number} fully active`);
      }
    } catch (err) {
      console.error(`Stage 2 error PR #${branch.pr_number}:`, err);
    }
  }

  return NextResponse.json({ ok: true });
}