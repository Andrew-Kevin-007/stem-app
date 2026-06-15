import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const maxDuration = 300;

/**
 * Gate the pipeline trigger. Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET`; the dashboard's manual "Advance Pipeline" button reaches us
 * through the session-gated frontend proxy, which forwards the same secret.
 * Without CRON_SECRET set we only allow it outside production so local dev
 * still works — in production an unset secret fails closed.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const header = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

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

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
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
        const { postBranchComment, postMaskingNeeded } = await import('@/lib/github');

        let result: { columns: string[]; tablesScanned: number };
        if (connection) {
          // Tenant clone: inherits the customer's master password (unknown to
          // STEM). Reset it to a derived value, then anonymize with the stored
          // master username + database. Source cluster is never touched.
          const { derivedClonePassword } = await import('@/lib/tenant');
          const clonePassword = derivedClonePassword(branch.clone_cluster_id);
          await resetCloneMasterPassword(branch.clone_cluster_id, clonePassword, target);
          result = await runAnonymization(branch.endpoint, {
            user: connection.aurora_master_user,
            password: clonePassword,
            database: connection.aurora_database,
          });
        } else {
          result = await runAnonymization(branch.endpoint);
        }
        const anonymizedCols = result.columns;
        console.log(`Anonymized PR #${branch.pr_number}: ${anonymizedCols.join(', ') || 'none'}`);

        // FAIL CLOSED: a clone that scanned real tables but matched zero PII
        // columns must NOT be handed out — that would expose live data while
        // claiming it is safe. Mark it for manual masking config instead.
        if (anonymizedCols.length === 0 && result.tablesScanned > 0) {
          await updateBranchState(branch.clone_cluster_id, 'masking_failed', {
            vercelEnvId: '',
            anonymizedColumns: [],
          });
          await postMaskingNeeded(branch.owner, branch.repo, branch.pr_number, branch.clone_cluster_id);
          console.warn(`PR #${branch.pr_number} held: no PII columns detected, masking config required`);
          continue;
        }

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
