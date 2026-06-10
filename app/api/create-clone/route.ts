import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { prNumber, owner, repo } = await req.json();
  console.log(`create-clone called for PR #${prNumber}`);

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

    // Poll until cluster available (~2-3 min, fits in 5 min)
    let endpoint = '';
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      const res = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: cloneId }));
      const status = res.DBClusters?.[0]?.Status;
      console.log(`Cluster: ${status}`);
      if (status === 'available') {
        endpoint = res.DBClusters![0].Endpoint!;
        break;
      }
      if (status === 'failed') throw new Error('Cluster failed');
    }

    if (!endpoint) throw new Error('Cluster timed out');

    // Save to DSQL — cron will pick up and continue
    const { saveBranch } = await import('@/lib/dsql');
    await saveBranch({
      prNumber,
      cloneClusterId: cloneId,
      endpoint,
      anonymizedColumns: [],
      vercelEnvId: '',
      state: 'cluster_ready',
      owner,
      repo,
    });

    console.log(`PR #${prNumber} cluster ready — cron will continue`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('create-clone error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}