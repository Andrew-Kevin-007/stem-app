import { NextResponse } from 'next/server';

export const maxDuration = 300;

// Resolve the AWS target for a branch: a connected tenant provisions in their
// own account via STS-assumed creds; the operator's own repos use env config.
async function targetForBranch(branch: { owner?: string }) {
  const { getUserConnectionByRepo } = await import('@/lib/dsql');
  const { assumeTenantRole } = await import('@/lib/tenant');
  const owner = branch.owner || '';
  const connection = owner ? await getUserConnectionByRepo(owner) : null;
  if (!connection) return { target: undefined, connection: null };
  const credentials = await assumeTenantRole(connection, `stem-cron-${owner}`);
  return {
    target: {
      credentials,
      region: connection.aurora_region,
      sourceClusterId: connection.aurora_cluster_id,
      subnetGroup: connection.aurora_subnet_group,
      securityGroupId: connection.aurora_sg_id,
    },
    connection,
  };
}

export async function GET() {
  console.log('Pipeline cron running');

  const { getBranchesByState, updateBranchState } = await import('@/lib/dsql');
  const { rdsClientFor, resetCloneMasterPassword } = await import('@/lib/aurora');
  const { CreateDBInstanceCommand, DescribeDBInstancesCommand } = await import('@aws-sdk/client-rds');

  // --- Stage 1: cluster_ready → create instance ---
  const clusterReady = await getBranchesByState('cluster_ready');
  for (const branch of clusterReady) {
    console.log(`Creating instance for PR #${branch.pr_number}`);
    try {
      const { target } = await targetForBranch(branch);
      const rds = rdsClientFor(target);
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
      const { target, connection } = await targetForBranch(branch);
      const rds = rdsClientFor(target);
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

        let anonymizedCols: string[];
        if (connection) {
          // Tenant clone: inherits the customer's master password (unknown to
          // STEM). Reset it to a derived value, then anonymize with the stored
          // master username + database. Source cluster is never touched.
          const { derivedClonePassword } = await import('@/lib/tenant');
          const clonePassword = derivedClonePassword(branch.clone_cluster_id);
          await resetCloneMasterPassword(branch.clone_cluster_id, clonePassword, target);
          anonymizedCols = await runAnonymization(branch.endpoint, {
            user: connection.aurora_master_user,
            password: clonePassword,
            database: connection.aurora_database,
          });
        } else {
          anonymizedCols = await runAnonymization(branch.endpoint);
        }
        console.log(`Anonymized PR #${branch.pr_number}: ${anonymizedCols.join(', ')}`);

        // Vercel env injection is an operator-side convenience; tenants don't
        // get the operator's DATABASE_URL written to the operator's project.
        let envId = '';
        if (!connection) {
          envId = await injectVercelEnvVar(branch.pr_number, branch.endpoint);
          console.log(`Vercel env injected for PR #${branch.pr_number}`);
        }

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
