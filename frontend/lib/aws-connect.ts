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

export function stemAwsAccountId(): string {
  // STEM's own account id — the trusted principal in the customer's role.
  return process.env.STEM_AWS_ACCOUNT_ID || "000000000000"
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

/** Least-privilege role the customer grants STEM, as a CloudFormation template. */
export function cloudFormationTemplate(externalId: string): string {
  return JSON.stringify(
    {
      AWSTemplateFormatVersion: "2010-09-09",
      Description: "STEM cross-account access role — grants the STEM control plane scoped RDS access for PR database branching.",
      Resources: {
        StemAccessRole: {
          Type: "AWS::IAM::Role",
          Properties: {
            RoleName: "stem-access-role",
            AssumeRolePolicyDocument: {
              Version: "2012-10-17",
              Statement: [
                {
                  Effect: "Allow",
                  Principal: { AWS: `arn:aws:iam::${stemAwsAccountId()}:root` },
                  Action: "sts:AssumeRole",
                  Condition: { StringEquals: { "sts:ExternalId": externalId } },
                },
              ],
            },
            Policies: [
              {
                PolicyName: "stem-rds-branching",
                PolicyDocument: {
                  Version: "2012-10-17",
                  Statement: [
                    {
                      Sid: "RdsCloneLifecycle",
                      Effect: "Allow",
                      Action: [
                        "rds:RestoreDBClusterToPointInTime",
                        "rds:CreateDBInstance",
                        "rds:DeleteDBInstance",
                        "rds:DeleteDBCluster",
                        "rds:DescribeDBClusters",
                        "rds:DescribeDBInstances",
                        "rds:AddTagsToResource",
                        "rds:ListTagsForResource",
                      ],
                      Resource: "*",
                    },
                  ],
                },
              },
            ],
          },
        },
      },
      Outputs: {
        RoleArn: { Description: "Paste this ARN back into STEM to finish connecting.", Value: { "Fn::GetAtt": ["StemAccessRole", "Arn"] } },
      },
    },
    null,
    2,
  )
}

/** Deep link to the CloudFormation console pre-filled with the template body. */
export function consoleCreateStackUrl(): string {
  return "https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create"
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
  const { STSClient, AssumeRoleCommand } = await import("@aws-sdk/client-sts")
  const sts = new STSClient({ region: process.env.AWS_REGION || "us-east-1" })
  const out = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "stem-connect-verify",
      ExternalId: externalId,
      DurationSeconds: 900,
    }),
  )
  const assumedArn = out.AssumedRoleUser?.Arn ?? ""
  const accountId = assumedArn.match(/arn:aws:sts::(\d{12}):/)?.[1] ?? parseRoleArn(roleArn)?.accountId ?? ""
  if (!accountId) throw new Error("Could not resolve account id from assumed role")
  return { accountId }
}
