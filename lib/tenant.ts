// Multi-tenant plumbing: per-customer AWS access via STS AssumeRole.
//
// Customers never hand STEM long-lived credentials. They deploy a
// CloudFormation stack creating a role that trusts STEM's account, gated by
// a per-user ExternalId. Every pipeline operation against a tenant account
// assumes that role for 15 minutes; each pipeline stage finishes well inside
// that window, and the next cron tick re-assumes from scratch.

import crypto from 'crypto';
import type { UserConnection } from './dsql';

export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

/** GitHub login whose repos use the operator's own env-configured cluster. */
export function operatorLogin(): string {
  return process.env.STEM_OPERATOR_LOGIN || 'Andrew-Kevin-007';
}

export async function assumeTenantRole(
  connection: UserConnection,
  sessionName: string,
): Promise<AwsCredentials> {
  const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
  const sts = new STSClient({ region: connection.aurora_region });
  const assumed = await sts.send(
    new AssumeRoleCommand({
      RoleArn: connection.aws_role_arn,
      // Session names surface in the customer's CloudTrail — keep them legible.
      RoleSessionName: sessionName.replace(/[^\w+=,.@-]/g, '-').slice(0, 64),
      ExternalId: connection.aws_external_id,
      DurationSeconds: 900,
    }),
  );
  const c = assumed.Credentials;
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
    throw new Error(`AssumeRole returned no credentials for ${connection.github_login}`);
  }
  return {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
  };
}

/**
 * Deterministic master password for a tenant CLONE cluster. Clones inherit
 * the customer's master password, which STEM does not know — so the pipeline
 * resets the clone's password (rds:ModifyDBCluster, scoped to stem-pr-*) to
 * this derived value before anonymizing. Derived, not stored: any pipeline
 * stage can recompute it from the clone id. The customer's source cluster is
 * never touched.
 */
export function derivedClonePassword(cloneId: string): string {
  const secret =
    process.env.STEM_TENANT_DB_SECRET || process.env.GITHUB_WEBHOOK_SECRET || 'stem-tenant-db';
  const digest = crypto.createHmac('sha256', secret).update(`clone:${cloneId}`).digest('base64url');
  // RDS master passwords: 8-100 printable ASCII chars excluding / @ " and space.
  return `S7em.${digest.slice(0, 32)}`;
}

/** Shared-secret check for frontend → backend internal calls. */
export function verifyInternalToken(header: string | null): { ok: boolean; reason?: string } {
  const expected = process.env.STEM_INTERNAL_TOKEN;
  if (!expected) {
    // Fail closed in production: an open write path would let anyone re-route
    // a victim's webhooks into an attacker-controlled AWS account.
    if (process.env.NODE_ENV === 'production' && process.env.VERCEL) {
      return { ok: false, reason: 'STEM_INTERNAL_TOKEN not configured on the backend' };
    }
    return { ok: true }; // local development
  }
  if (!header) return { ok: false, reason: 'missing internal token' };
  const a = crypto.createHash('sha256').update(header).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b) ? { ok: true } : { ok: false, reason: 'invalid internal token' };
}
