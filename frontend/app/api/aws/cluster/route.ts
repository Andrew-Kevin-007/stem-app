import { NextRequest, NextResponse } from "next/server"
import {
  readSession,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  type AwsConnection,
} from "@/lib/auth"
import { isStsConfigured, verifyClusterAccess } from "@/lib/aws-connect"
import { persistConnection } from "@/lib/connections"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const REGION_RE = /^[a-z]{2}-[a-z]+-\d$/
const SG_RE = /^sg-[0-9a-f]{8,}$/

// Step 2 of AWS onboarding: bind the customer's source Aurora cluster to their
// connection and persist it to DSQL so the webhook pipeline can fan out to it.
export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  if (!session.aws?.roleArn || !session.aws.externalId) {
    return NextResponse.json({ error: "Connect your AWS role first (step 1)" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "")
  const clusterId = str("clusterId")
  const subnetGroup = str("subnetGroup")
  const securityGroupId = str("securityGroupId")
  const region = str("region") || "us-east-1"
  const masterUser = str("masterUser") || "postgres"
  const database = str("database") || "postgres"

  if (!clusterId) return NextResponse.json({ error: "Aurora cluster ID is required" }, { status: 400 })
  if (!subnetGroup) return NextResponse.json({ error: "DB subnet group is required" }, { status: 400 })
  if (!SG_RE.test(securityGroupId)) {
    return NextResponse.json({ error: "Security group must look like sg-0123abcd…" }, { status: 400 })
  }
  if (!REGION_RE.test(region)) return NextResponse.json({ error: "Invalid AWS region" }, { status: 400 })

  let accountId = session.aws.accountId
  if (isStsConfigured()) {
    try {
      const result = await verifyClusterAccess(session.aws.roleArn, session.aws.externalId, region, clusterId)
      accountId = result.accountId
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Couldn't see that cluster through the role. Check the cluster ID and region, and that the role's policy allows rds:DescribeDBClusters.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      )
    }
  }

  // Persist to DSQL via the backend (keyed by github_login = repo owner).
  try {
    await persistConnection({
      github_login: session.login,
      aws_role_arn: session.aws.roleArn,
      aws_external_id: session.aws.externalId,
      aws_account_id: accountId,
      aurora_cluster_id: clusterId,
      aurora_subnet_group: subnetGroup,
      aurora_sg_id: securityGroupId,
      aurora_region: region,
      aurora_master_user: masterUser,
      aurora_database: database,
    })
  } catch (err) {
    return NextResponse.json(
      { error: "Saved locally but the backend rejected the connection.", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }

  const aws: AwsConnection = {
    ...session.aws,
    accountId,
    cluster: { clusterId, subnetGroup, securityGroupId, region, masterUser, database },
  }
  const res = NextResponse.json({ ok: true, clusterId, accountId })
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken({
      sub: session.sub,
      login: session.login,
      name: session.name,
      email: session.email,
      avatarUrl: session.avatarUrl,
      ghToken: session.ghToken,
      installations: session.installations,
      aws,
    }),
    sessionCookieOptions,
  )
  return res
}
