# Stem

**Isolated, PII-anonymized database branches for every pull request.**

Stem gives each GitHub pull request its own Aurora PostgreSQL copy-on-write clone, anonymizes the personal data inside it, and tears it down when the PR closes. Clones are provisioned in the customer's own AWS account through a scoped cross-account role, so production-shaped data never leaves the customer's boundary and no raw PII is exposed to reviewers.

Built for the H0 hackathon (Vercel and AWS Databases), engineered as a deployable multi-tenant product.

---

## The problem

Teams that handle regulated data (GDPR, HIPAA, SOC 2, PCI) face a forced choice when reviewing pull requests:

- **Test against an empty seed database** and miss the bugs that only appear at production data volumes — slow queries, lock contention, real edge-case rows.
- **Test against production** and expose customer PII to every reviewer, contractor, and preview deployment attached to the PR.

Stem removes the trade-off. Every PR gets a full-shaped clone of production with the personal data replaced by realistic fakes, ready in roughly 30 seconds, destroyed automatically on merge or close.

---

## How it works

```
GitHub PR opened
      |  (HMAC-verified webhook)
      v
Webhook (Next.js API route)
  - Resolve repo owner to their stored AWS connection (Aurora DSQL)
  - STS AssumeRole into the owner's AWS account (ExternalId-scoped, 15 min)
  - RestoreDBClusterToPointInTime: copy-on-write clone of their source cluster
  - Persist branch state = cluster_ready
      |
      v
Cron / operator trigger: /api/cron/advance-pipeline  (re-assumes the role each run)
  Stage 1: cluster_ready       -> CreateDBInstance        -> instance_creating
  Stage 2: instance available  -> reset clone master password (scoped to stem-pr-*)
                               -> detect and mask PII inside the clone
                               -> if zero PII columns matched: HOLD (fail closed)
                               -> otherwise post PR comment + expose endpoint -> active
      |
      v
PR merged or closed
  - AssumeRole -> DeleteDBInstance + DeleteDBCluster -> destroyed
```

Two AWS databases, two responsibilities:

- **Aurora PostgreSQL Serverless v2** is the data plane. Copy-on-write clones share unchanged pages with the source cluster, so a clone of a multi-terabyte database moves almost no data and costs storage only for pages the branch modifies. This is what makes sub-30-second provisioning possible.
- **Aurora DSQL** is the control plane. Branch state and per-user AWS connections live in a serverless, IAM-authenticated store with no connection pool to operate.

The browser only ever talks to the frontend. The frontend's API routes proxy server-to-server to the backend, so there is no cross-origin surface and the backend requires no CORS configuration.

---

## Multi-tenancy and isolation

Stem is multi-tenant by account, not by row in a shared database.

| Boundary | Mechanism |
| --- | --- |
| Compute and data | Each tenant's clones run in that tenant's own AWS account via cross-account STS `AssumeRole`. Stem stores no long-lived tenant credentials — only a role ARN and an ExternalId. |
| Blast radius | The role's destructive and modifying permissions (`DeleteDBCluster`, `DeleteDBInstance`, `ModifyDBCluster`) are IAM-scoped to `stem-pr-*` resources. Stem cannot read, modify, or delete the tenant's source cluster or any non-Stem resource. |
| Confused deputy | Every role assumption requires a per-user, server-derived ExternalId. |
| Dashboard | Branch queries are scoped to the authenticated user's GitHub login. One tenant cannot enumerate another's branches. |
| Operator | The operator login uses an environment-configured cluster, keeping the single-tenant demo path independent of any customer. |

---

## Data safety: anonymization that fails closed

The anonymizer runs inside the clone before any credentials are issued. It operates in two layers:

1. **Explicit rules** for known high-confidence columns.
2. **Generic detection** across any schema: it scans `information_schema` and masks text columns whose names match PII patterns (email, phone, SSN/national ID/tax ID, card number, names, address, postal code, IP address, date of birth, secrets/tokens) with type-appropriate fake data.

The design bias is deliberate: writing fake data into a non-sensitive column of a throwaway clone is harmless, while leaving one real PII column unmasked is a breach. Over-masking is acceptable; under-masking is not.

**Fail closed.** If the anonymizer scans a populated schema and matches zero PII columns, the branch is **not** exposed. It moves to a `masking_failed` state, no connection string is published, and the PR receives a comment explaining that masking configuration is required. Stem never hands out a clone it could not anonymize.

| Category | Replacement |
| --- | --- |
| email | `user_NNNNNN@example.com` |
| phone | random E.164-style US number |
| ssn / national id / tax id | `NNN-NN-NNNN` |
| card number | `****-****-****-NNNN` |
| name | value from a fixed synthetic pool |
| address | `NNN Example St, Anytown USA 10001` |
| postal code | random 5-digit |
| ip address | RFC 1918 random address |
| date of birth | fixed placeholder date |
| password / secret / token | `redacted_<hash>` |

Rules and patterns live in [`lib/anonymizer.ts`](lib/anonymizer.ts) and extend to any table or column.

---

## Security model

- **Transport.** HSTS (two years, `includeSubDomains`, `preload`) and a Content-Security-Policy (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, scoped script/img/connect sources), plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and restrictive referrer and permissions policies on every response.
- **Sessions.** AES-256-GCM sealed, `httpOnly`, `SameSite=Lax` cookies with a 12-hour TTL. The GitHub token is carried inside the encrypted payload and never reaches the browser. Decryption fails closed in production: with no `AUTH_ENCRYPTION_KEY` configured, authenticated requests error rather than fall back to a weak key.
- **OAuth.** GitHub App user authorization with a single-use, sealed `state` cookie for CSRF. The code-to-token exchange happens server-side with the client secret; scopes are minimal (`read:user user:email`) because repository access comes from installing the App, not from OAuth scopes. Internal errors are logged server-side and never reflected into redirect URLs.
- **Webhook.** HMAC-SHA256 signatures verified with a length guard and constant-time comparison; a missing secret or malformed header returns 401, never 500.
- **Pipeline trigger.** `/api/cron/advance-pipeline` requires a `CRON_SECRET` bearer token (sent by Vercel Cron and forwarded by the session-gated dashboard proxy). Unauthenticated callers are rejected; with no secret configured it is disabled in production.
- **Internal write path.** `/api/connections`, which controls where a tenant's clones provision, is guarded by a shared `STEM_INTERNAL_TOKEN`, compared in constant time, and fails closed in production.
- **Least privilege.** The customer IAM role grants account-wide `Describe*` only (RDS does not support resource scoping for those), creation actions where required, and modify/delete locked to `stem-pr-*`.
- **No unauthenticated state-changing endpoints.** Every route that mutates state requires a session, the internal token, a valid webhook signature, or the cron secret.
- **Database TLS.** The masking connection uses TLS; supply `AURORA_CA_CERT` (the RDS CA bundle) to enforce full certificate verification.

---

## Stack

Next.js 16 (App Router), TypeScript (strict), Tailwind CSS, Vercel, AWS Aurora PostgreSQL Serverless v2, Aurora DSQL, GitHub App (`@octokit/app`), `@aws-sdk/client-rds`, `@aws-sdk/client-sts`, `@aws-sdk/dsql-signer`.

---

## Deployment

Two Vercel projects: the backend (repository root) and the frontend (`frontend/`).

```bash
git clone https://github.com/Andrew-Kevin-007/stem-app
cd stem-app

# Backend
cp .env.example .env.local            # fill in per the table below
npm install
npx vercel --prod

# Frontend
cd frontend
cp .env.example .env.local            # set NEXT_PUBLIC_API_BASE to the backend URL
npm install
npx vercel --prod
```

**GitHub App (one-time).** Create a GitHub App with `Pull requests: write` and `Contents: read`, subscribe it to the `pull_request` webhook, point the webhook at `{backend}/api/webhook/github`, set the OAuth callback URL to `{frontend}/api/auth/github/callback`, and generate a client secret and a private key.

`STEM_INTERNAL_TOKEN` and `CRON_SECRET` must be identical on both projects. After deploying, request `/api/health` on each: the frontend should report `ready: true` and the backend should report an all-true `config` object.

### Backend environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Yes | Control-plane credentials (DSQL, operator cluster, STS) |
| `DSQL_ENDPOINT` | Yes | Aurora DSQL endpoint (no scheme) |
| `AURORA_SOURCE_CLUSTER_ID`, `AURORA_SUBNET_GROUP`, `AURORA_SECURITY_GROUP_ID` | Operator path | Operator's source cluster for the operator login's repos |
| `AURORA_MASTER_USER`, `AURORA_MASTER_PASSWORD` | Operator path | Operator clone database credentials |
| `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET` | Yes | GitHub App identity and webhook HMAC |
| `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` | Operator path | `DATABASE_URL` injection into the preview project |
| `STEM_INTERNAL_TOKEN` | Yes | Guards `/api/connections`; must match the frontend |
| `CRON_SECRET` | Yes | Guards the pipeline trigger; must match the frontend |
| `STEM_OPERATOR_LOGIN` | No | Login that uses the environment cluster (default `Andrew-Kevin-007`) |
| `STEM_TENANT_DB_SECRET` | No | Derives per-clone master passwords (falls back to the webhook secret) |
| `STEM_TEAM_ID` | No | DSQL `team_id` (defaults to the all-zeros UUID) |
| `AURORA_CA_CERT` | No | RDS CA bundle (PEM) to enforce TLS verification during masking |

### Frontend environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE` | Yes | Backend URL (no trailing slash) |
| `APP_BASE_URL` | Yes in production | Public frontend origin for OAuth redirect URIs |
| `AUTH_ENCRYPTION_KEY` (or `SESSION_SECRET`) | Yes | 32+ random bytes; seals session cookies. Without it, the app fails closed in production. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Yes | GitHub App OAuth credentials |
| `GITHUB_APP_SLUG` | No | Install-link slug (defaults to the deployed App) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Yes | Used to verify a tenant's role and cluster via STS |
| `STEM_AWS_ACCOUNT_ID` | No | Trusted principal; auto-derived via STS `GetCallerIdentity` |
| `STEM_AWS_EXTERNAL_ID_SECRET` | No | ExternalId derivation (falls back to the session secret) |
| `STEM_INTERNAL_TOKEN` | Yes | Must match the backend |
| `CRON_SECRET` | Yes | Must match the backend |
| `STEM_PROTECTION_BYPASS` | No | Vercel Deployment Protection bypass, if the backend has SSO enabled |

---

## Onboarding (per tenant)

1. **Sign in with GitHub.** The OAuth flow reads only the public profile.
2. **Install the Stem App** on the repositories that should receive database branches.
3. **Connect AWS.** From the Connect page, run the single AWS CloudShell command shown there. It deploys a CloudFormation stack containing one least-privilege role and prints the role ARN. Paste the ARN back; Stem verifies it with `AssumeRole`.
4. **Name the Aurora cluster.** Provide the source cluster ID, subnet group, security group, and region. Stem confirms the role can describe the cluster before saving.

Open a pull request on a connected repository. Stem comments with the branch endpoint once masking completes.

---

## Operations

- **Health.** `GET /api/health` on both applications returns `ok` plus configuration-presence booleans (never secret values). The frontend probe also reports backend reachability. Use these for uptime monitoring and as the post-deployment checklist.
- **Cron.** `vercel.json` schedules `/api/cron/advance-pipeline` daily (the Vercel Hobby ceiling). On a paid plan, schedule it every few minutes for automatic progression; otherwise use the dashboard's Advance Pipeline control during a demo.
- **Logging.** Pipeline and authentication errors are written to the platform function logs. The dashboard event stream shows live state transitions.

---

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Sign-in reports "not configured" | Set `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `AUTH_ENCRYPTION_KEY`; redeploy. Confirm with `/api/health`. |
| `state_mismatch` during sign-in | Retry in the same tab and allow cookies for the dashboard origin. |
| AWS connect cannot assume the role | IAM is eventually consistent; wait around 30 seconds and retry. Confirm the stack deployed in the intended account and the ExternalId matches. |
| Cluster step fails | Verify the cluster ID and region, and that the role allows `rds:DescribeDBClusters`. |
| Branch shows "Needs Masking" | The schema had no columns Stem recognized as PII. Add masking rules or align column names, then reopen the PR. Stem withheld the clone intentionally. |
| stem-ci never comments | Install the App on the repository from the Connect page. No workflow file is required. |
| Branch stuck in Queued | The source cluster reached Aurora's 15-clone limit. Close stale PRs; the queue drains in order. |

---

## Known constraints

- Vercel Hobby cron runs daily; use the Advance Pipeline control for demos or upgrade for automatic minute-level progression.
- Aurora allows up to 15 clones per source cluster; additional PRs queue.
- Aurora DSQL has no foreign-key constraints and limited `ALTER TABLE` support; numeric columns serialize as strings over the PostgreSQL driver, and the frontend normalizes all payloads.
- Tenant clone anonymization requires the clone's master username and database name, collected on the Connect page (both default to `postgres`).

---

## License and status

Hackathon submission for H0 (Vercel and AWS Databases), submission deadline June 30, 2026. Engineered for real-world multi-tenant deployment.
