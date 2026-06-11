import {
  RDSClient,
  RestoreDBClusterToPointInTimeCommand,
  CreateDBInstanceCommand,
  DeleteDBInstanceCommand,
  DeleteDBClusterCommand,
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  ModifyDBClusterCommand,
} from '@aws-sdk/client-rds';
import type { AwsCredentials } from './tenant';

/**
 * Per-call AWS targeting. Omitted = the operator's own account/cluster from
 * env (the original single-tenant behavior, unchanged). Supplied = a tenant's
 * account via STS-assumed credentials.
 */
export interface AuroraTarget {
  credentials?: AwsCredentials;
  region?: string;
  sourceClusterId?: string;
  subnetGroup?: string;
  securityGroupId?: string;
}

export function rdsClientFor(target?: AuroraTarget): RDSClient {
  return new RDSClient({
    region: target?.region || process.env.AWS_REGION || 'us-east-1',
    ...(target?.credentials ? { credentials: target.credentials } : {}),
  });
}

async function poll(fn: () => Promise<boolean>, intervalMs = 5000, maxMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Poll timed out');
}

/** Stage-1 primitive used by the webhook: restore the COW clone cluster only. */
export async function restoreCloneCluster(
  prNumber: number,
  target?: AuroraTarget,
): Promise<{ cloneId: string; endpoint: string }> {
  const rds = rdsClientFor(target);
  const cloneId = `stem-pr-${prNumber}-${Date.now()}`;

  await rds.send(new RestoreDBClusterToPointInTimeCommand({
    DBClusterIdentifier: cloneId,
    SourceDBClusterIdentifier: target?.sourceClusterId || process.env.AURORA_SOURCE_CLUSTER_ID!,
    RestoreType: 'copy-on-write',
    UseLatestRestorableTime: true,
    DBSubnetGroupName: target?.subnetGroup || process.env.AURORA_SUBNET_GROUP!,
    VpcSecurityGroupIds: [target?.securityGroupId || process.env.AURORA_SECURITY_GROUP_ID!],
    Tags: [{ Key: 'stem-pr', Value: String(prNumber) }],
  }));

  let endpoint = '';
  await poll(async () => {
    const res = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: cloneId }));
    const status = res.DBClusters?.[0]?.Status;
    console.log(`Clone cluster: ${status}`);
    if (status === 'failed') throw new Error('Clone cluster failed');
    if (status === 'available') {
      endpoint = res.DBClusters![0].Endpoint!;
      return true;
    }
    return false;
  }, 5000, 200000);

  if (!endpoint) throw new Error('Cluster timed out');
  return { cloneId, endpoint };
}

export async function createAuroraClone(
  prNumber: number,
  target?: AuroraTarget,
): Promise<{ cloneId: string; endpoint: string }> {
  const rds = rdsClientFor(target);
  const { cloneId } = await restoreCloneCluster(prNumber, target);
  const instanceId = `${cloneId}-w`;

  await rds.send(new CreateDBInstanceCommand({
    DBInstanceIdentifier: instanceId,
    DBClusterIdentifier: cloneId,
    DBInstanceClass: 'db.serverless',
    Engine: 'aurora-postgresql',
    PubliclyAccessible: true,
  }));

  await poll(async () => {
    const res = await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }));
    const status = res.DBInstances?.[0]?.DBInstanceStatus;
    console.log(`Clone instance: ${status}`);
    if (status === 'failed') throw new Error('Clone instance failed');
    return status === 'available';
  }, 10000, 300000);

  const clusterRes = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: cloneId }));
  const endpoint = clusterRes.DBClusters?.[0]?.Endpoint!;

  return { cloneId, endpoint };
}

/**
 * Reset a CLONE cluster's master password to a value STEM controls, so the
 * anonymizer can connect. Admin-level RDS operation (authorized by IAM, not
 * the old DB password) applied immediately. Only ever called on stem-pr-*
 * clones — the customer's source cluster is never modified.
 */
export async function resetCloneMasterPassword(
  cloneId: string,
  newPassword: string,
  target?: AuroraTarget,
): Promise<void> {
  const rds = rdsClientFor(target);
  await rds.send(new ModifyDBClusterCommand({
    DBClusterIdentifier: cloneId,
    MasterUserPassword: newPassword,
    ApplyImmediately: true,
  }));
  // ModifyDBCluster flips Status to 'resetting-master-credentials' briefly.
  await poll(async () => {
    const res = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: cloneId }));
    return res.DBClusters?.[0]?.Status === 'available';
  }, 5000, 120000);
}

export async function deleteAuroraClone(cloneId: string, target?: AuroraTarget) {
  const rds = rdsClientFor(target);
  const instanceId = `${cloneId}-w`;

  try {
    await rds.send(new DeleteDBInstanceCommand({
      DBInstanceIdentifier: instanceId,
      SkipFinalSnapshot: true,
    }));
    await poll(async () => {
      try {
        const res = await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: instanceId }));
        return !res.DBInstances?.length;
      } catch { return true; }
    }, 10000, 300000);
  } catch (e) {
    console.log('Instance already gone:', e);
  }

  try {
    await rds.send(new DeleteDBClusterCommand({
      DBClusterIdentifier: cloneId,
      SkipFinalSnapshot: true,
    }));
  } catch (e) {
    console.log('Cluster already gone:', e);
  }
}
