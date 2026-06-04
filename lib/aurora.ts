import {
  RDSClient,
  RestoreDBClusterToPointInTimeCommand,
  CreateDBInstanceCommand,
  DeleteDBInstanceCommand,
  DeleteDBClusterCommand,
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
} from '@aws-sdk/client-rds';

const rds = new RDSClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function poll(fn: () => Promise<boolean>, intervalMs = 5000, maxMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await fn()) return;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Poll timed out');
}

export async function createAuroraClone(prNumber: number): Promise<{ cloneId: string; endpoint: string }> {
  const cloneId = `stem-pr-${prNumber}-${Date.now()}`;
  const instanceId = `${cloneId}-w`;

  await rds.send(new RestoreDBClusterToPointInTimeCommand({
    DBClusterIdentifier: cloneId,
    SourceDBClusterIdentifier: process.env.AURORA_SOURCE_CLUSTER_ID!,
    RestoreType: 'copy-on-write',
    UseLatestRestorableTime: true,
    DBSubnetGroupName: process.env.AURORA_SUBNET_GROUP!,
    VpcSecurityGroupIds: [process.env.AURORA_SECURITY_GROUP_ID!],
    Tags: [{ Key: 'stem-pr', Value: String(prNumber) }],
  }));

  await poll(async () => {
    const res = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: cloneId }));
    const status = res.DBClusters?.[0]?.Status;
    console.log(`Clone cluster: ${status}`);
    if (status === 'failed') throw new Error('Clone cluster failed');
    return status === 'available';
  }, 5000, 180000);

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

export async function deleteAuroraClone(cloneId: string) {
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