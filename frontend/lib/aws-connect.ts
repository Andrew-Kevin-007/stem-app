// AWS account connection via cross-account IAM role assumption — the secure
// SaaS standard (no long-lived access keys ever leave the customer account).
//
// The customer deploys a CloudFormation stack that creates a role trusting
// STEM's AWS account, scoped to exactly the RDS actions the pipeline needs,
// and gated by a per-user ExternalId (confused-deputy protection). STEM then
// assumes that role with STS to operate on their behalf.

const ROLE_ARN_RE = /^arn:aws:iam::(\d{12}):role\/[\w+=,.@/-]+$/

export function isStsConfigured(): boolean {
  return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
}

let cachedAccountId: string | null = null

/**
 * STEM's own AWS account id — the trusted principal in the customer's role.
 * Uses STEM_AWS_ACCOUNT_ID when set; otherwise derives it once from the
 * control-plane credentials via STS GetCallerIdentity (one less config knob).
 */
export async function resolveStemAccountId(): Promise<string | null> {
  if (process.env.STEM_AWS_ACCOUNT_ID) return process.env.STEM_AWS_ACCOUNT_ID
  if (cachedAccountId) return cachedAccountId
  if (!isStsConfigured()) return null
  try {
    const { STSClient, GetCallerIdentityCommand } = await import("@aws-sdk/client-sts")
    const sts = new STSClient({ region: process.env.AWS_REGION || "us-east-1" })
    const out = await sts.send(new GetCallerIdentityCommand({}))
    cachedAccountId = out.Account ?? null
    return cachedAccountId
  } catch {
    return null
  }
}

export function parseRoleArn(arn: string): { accountId: string } | null {
  const m = ROLE_ARN_RE.exec(arn.trim())
  return m ? { accountId: m[1] } : null
}

/**
 * Deterministic, per-user ExternalId. Derived from a server secret so it can't
 * be guessed, but stable for a given user so the role survives re-connects.
 */
export async function deriveExternalId(sub: string): Promise<string> {
  const secret = process.env.STEM_AWS_EXTERNAL_ID_SECRET || process.env.SESSION_SECRET || "stem-external-id"
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`aws:${sub}`)))
  return `stem-${Array.from(sig.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("")}`
}

/**
 * Least-privilege role policy. Describe/list are account-wide (RDS does not
 * support resource-level scoping for them); create targets are constrained by
 * the pipeline's stem-pr-* naming; destructive actions are HARD-scoped so STEM
 * can never delete a non-STEM cluster or instance in the customer account.
 */
function rolePolicyStatements() {
  return [
    {
      Sid: "RdsReadOnly",
      Effect: "Allow",
      Action: ["rds:DescribeDBClusters", "rds:DescribeDBInstances", "rds:ListTagsForResource"],
      Resource: "*",
    },
    {
      Sid: "RdsCloneCreate",
      Effect: "Allow",
      Action: ["rds:RestoreDBClusterToPointInTime", "rds:CreateDBInstance", "rds:AddTagsToResource"],
      Resource: "*",
    },
    {
      // Reset the clone's master password before anonymizing — scoped so STEM
      // can only modify clusters it created, never the customer's source.
      Sid: "RdsCloneModifyStemOnly",
      Effect: "Allow",
      Action: ["rds:ModifyDBCluster"],
      Resource: [{ "Fn::Sub": "arn:aws:rds:*:${AWS::AccountId}:cluster:stem-pr-*" }],
    },
    {
      Sid: "RdsCloneDestroyStemOnly",
      Effect: "Allow",
      Action: ["rds:DeleteDBInstance", "rds:DeleteDBCluster"],
      Resource: [
        { "Fn::Sub": "arn:aws:rds:*:${AWS::AccountId}:cluster:stem-pr-*" },
        { "Fn::Sub": "arn:aws:rds:*:${AWS::AccountId}:db:stem-pr-*" },
      ],
    },
  ]
}

function roleResource(trustedAccountId: string, externalIdRef: unknown) {
  return {
    Type: "AWS::IAM::Role",
    Properties: {
      RoleName: "stem-access-role",
      AssumeRolePolicyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: `arn:aws:iam::${trustedAccountId}:root` },
            Action: "sts:AssumeRole",
            Condition: { StringEquals: { "sts:ExternalId": externalIdRef } },
          },
        ],
      },
      Policies: [
        {
          PolicyName: "stem-rds-branching",
          PolicyDocument: { Version: "2012-10-17", Statement: rolePolicyStatements() },
        },
      ],
    },
  }
}

const TEMPLATE_OUTPUTS = {
  RoleArn: {
    Description: "Paste this ARN back into STEM to finish connecting.",
    Value: { "Fn::GetAtt": ["StemAccessRole", "Arn"] },
  },
}

/** Personalized template — the user's ExternalId baked in. For manual download. */
export function cloudFormationTemplate(trustedAccountId: string, externalId: string): string {
  return JSON.stringify(
    {
      AWSTemplateFormatVersion: "2010-09-09",
      Description:
        "STEM cross-account access role — grants the STEM control plane scoped RDS access for PR database branching.",
      Resources: { StemAccessRole: roleResource(trustedAccountId, externalId) },
      Outputs: TEMPLATE_OUTPUTS,
    },
    null,
    2,
  )
}

/**
 * Parameterized template — same role, ExternalId supplied as a stack
 * parameter. Served publicly (contains no user data) so CloudShell can
 * fetch it without an authenticated browser session.
 */
export function parameterizedTemplate(trustedAccountId: string): string {
  return JSON.stringify(
    {
      AWSTemplateFormatVersion: "2010-09-09",
      Description:
        "STEM cross-account access role — grants the STEM control plane scoped RDS access for PR database branching.",
      Parameters: {
        ExternalId: {
          Type: "String",
          MinLength: 8,
          Description: "Your STEM ExternalId (shown on the Connect page).",
        },
      },
      Resources: { StemAccessRole: roleResource(trustedAccountId, { Ref: "ExternalId" }) },
      Outputs: TEMPLATE_OUTPUTS,
    },
    null,
    2,
  )
}

/**
 * One-paste AWS CloudShell command: fetches the template, deploys the stack,
 * and prints the role ARN as the final line. The user copies that ARN back.
 */
export function cloudShellCommand(origin: string, externalId: string): string {
  const templateUrl = `${origin.replace(/\/+$/, "")}/api/aws/template`
  return [
    `curl -fsSL ${templateUrl} -o /tmp/stem-role.json`,
    `aws cloudformation deploy --stack-name stem-access --template-file /tmp/stem-role.json --capabilities CAPABILITY_NAMED_IAM --parameter-overrides ExternalId=${externalId}`,
    `aws cloudformation describe-stacks --stack-name stem-access --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" --output text`,
  ].join(" && ")
}

/** Deep link to AWS CloudShell in the pipeline's region. */
export function cloudShellUrl(): string {
  const region = process.env.AWS_REGION || "us-east-1"
  return `https://${region}.console.aws.amazon.com/cloudshell/home?region=${region}`
}

/** Deep link to the CloudFormation console for the manual path. */
export function consoleCreateStackUrl(): string {
  const region = process.env.AWS_REGION || "us-east-1"
  return `https://${region}.console.aws.amazon.com/cloudformation/home?region=${region}#/stacks/create`
}

interface AssumedCreds {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
}

async function assume(roleArn: string, externalId: string, region: string): Promise<{ accountId: string; credentials: AssumedCreds }> {
  const { STSClient, AssumeRoleCommand } = await import("@aws-sdk/client-sts")
  const sts = new STSClient({ region })
  const out = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "stem-connect-verify",
      ExternalId: externalId,
      DurationSeconds: 900,
    }),
  )
  const c = out.Credentials
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
    throw new Error("AssumeRole returned no credentials")
  }
  const accountId =
    out.AssumedRoleUser?.Arn?.match(/arn:aws:sts::(\d{12}):/)?.[1] ?? parseRoleArn(roleArn)?.accountId ?? ""
  if (!accountId) throw new Error("Could not resolve account id from assumed role")
  return {
    accountId,
    credentials: { accessKeyId: c.AccessKeyId, secretAccessKey: c.SecretAccessKey, sessionToken: c.SessionToken },
  }
}

/**
 * Verify the customer role by actually assuming it. Returns the resolved
 * account id on success. The AWS SDK is dynamically imported so it never gets
 * bundled into the Edge middleware.
 */
export async function verifyAssumeRole(
  roleArn: string,
  externalId: string,
): Promise<{ accountId: string }> {
  const { accountId } = await assume(roleArn, externalId, process.env.AWS_REGION || "us-east-1")
  return { accountId }
}

/**
 * Confirm the assumed role can actually see the named Aurora cluster
 * (rds:DescribeDBClusters). Proves the cluster id + region are right and the
 * role's policy covers RDS before we persist the connection.
 */
export async function verifyClusterAccess(
  roleArn: string,
  externalId: string,
  region: string,
  clusterId: string,
): Promise<{ accountId: string; status: string }> {
  const { accountId, credentials } = await assume(roleArn, externalId, region)
  const { RDSClient, DescribeDBClustersCommand } = await import("@aws-sdk/client-rds")
  const rds = new RDSClient({ region, credentials })
  const out = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: clusterId }))
  const cluster = out.DBClusters?.[0]
  if (!cluster) throw new Error(`Cluster ${clusterId} not found in ${region}`)
  return { accountId, status: cluster.Status ?? "unknown" }
}
