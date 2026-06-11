# 🌿 Stem — Isolated Database Branches for Every PR

Every GitHub PR gets its own Aurora PostgreSQL copy-on-write clone, PII-anonymized in ~28 seconds — provisioned in **your** AWS account, torn down on close.

[![status](https://img.shields.io/badge/status-production-success)](https://stem-frontend-six.vercel.app) · Built for **H0: Hack the Zero Stack** (Vercel + AWS Databases)

---

## What It Does

Stem is a multi-tenant DevTool for teams in regulated industries (GDPR / HIPAA / SOC 2) who can't hand production data to every contractor and preview deployment. When a PR opens, Stem restores an Aurora copy-on-write clone of the source cluster (`RestoreDBClusterToPointInTime`), bulk-replaces PII columns with realistic fake data, injects the clone's `DATABASE_URL` into the preview environment, and posts a summary comment on the PR through a GitHub App. When the PR closes, every resource is destroyed.

Each customer connects their **own** GitHub account and their **own** AWS account: clones provision in the customer's account against the customer's cluster, billed to them, isolated from every other tenant.

## Live Instance

Dashboard: **<https://stem-frontend-six.vercel.app>** · Health: `/api/health`

Sign in with GitHub, then complete the three-step Connect flow (install App → connect AWS role → name your Aurora cluster). Open a PR on a connected repo and watch the pipeline run live.

---

## Architecture

```
GitHub PR opened
      │  (HMAC-verified webhook)
      ▼
Webhook (Next.js API Route)
  ├─ Resolve repo owner → tenant AWS connection (DSQL)
  ├─ STS AssumeRole into the tenant's account (ExternalId-gated, 15 min)
  ├─ RestoreDBClusterToPointInTime (copy-on-write) in THEIR cluster
  └─ DSQL: branch state = cluster_ready
      │
      ▼
Cron: /api/cron/advance-pipeline   (re-assumes the role each tick)
  Stage 1: cluster_ready      → CreateDBInstance → instance_creating
  Stage 2: instance available →
    ├─ ModifyDBCluster: reset clone master password (scoped to stem-pr-*)
    ├─ Bulk PII UPDATE inside the clone
    ├─ Inject DATABASE_URL (operator path) + post PR comment
    └─ branch state = active
      │
      ▼
PR merged/closed
  └─ AssumeRole → DeleteDBInstance + DeleteDBCluster → state = destroyed
```

**Two AWS databases, two jobs:**
- **Aurora PostgreSQL Serverless v2** — the data plane. Copy-on-write clones give each PR full production-shaped data without duplicating storage.
- **Aurora DSQL** — the control plane. Branch state and per-user AWS connections live in a serverless, IAM-authenticated store with no connection pool to manage.

The browser only ever talks to the frontend; the frontend's API routes proxy server-to-server to the backend, so there is no CORS surface and the backend needs no CORS config.

## Multi-Tenancy & Isolation

| Boundary | Mechanism |
|---|---|
| **Compute / data** | Each tenant's clones run in **their** AWS account via cross-account STS `AssumeRole`. STEM holds no tenant long-lived credentials — only a role ARN + ExternalId. |
| **Blast radius** | The role's destructive actions (`Delete*`, `ModifyDBCluster`) are IAM-scoped to `stem-pr-*` resources. STEM **cannot** touch a tenant's source cluster or any non-Stem resource. |
| **Confused deputy** | Every role assumption requires a per-user, server-derived `ExternalId`. |
| **Dashboard** | Branch queries are scoped to the signed-in user's GitHub login (`?owner=`). One tenant can never see another's branches. |
| **Operator** | `STEM_OPERATOR_LOGIN`'s repos use the env-configured cluster (original single-tenant path), so the operator's own demo is independent of any tenant. |

## Security Model

- **Transport** — HSTS (`max-age=63072000; includeSubDomains; preload`) + a Content-Security-Policy (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `nosniff`, restrictive `Referrer-Policy` and `Permissions-Policy`, applied to every response.
- **Sessions** — AES-256-GCM **sealed** `httpOnly` `SameSite=Lax` cookies (12 h TTL). The GitHub token rides inside the encrypted payload and is never exposed to the browser. Decryption **fails closed in production**: if no `AUTH_ENCRYPTION_KEY`/`SESSION_SECRET` is set, auth-bearing requests error rather than fall back to a weak key.
- **OAuth** — GitHub App user-authorization with a single-use, sealed `state` cookie for CSRF; the code↔token exchange happens server-side with the client secret; minimal `read:user user:email` scopes (repo access comes from installing the App, not scopes). Internal errors are logged, never reflected into redirect URLs.
- **Webhook** — HMAC-SHA256 signature verified with a length guard + constant-time compare; a missing secret or malformed header yields a clean 401, never a 500.
- **Internal write path** — `/api/connections` (which controls where a tenant's clones provision) is guarded by a shared `STEM_INTERNAL_TOKEN`, compared in constant time and **fail-closed in production**.
- **Least privilege** — the customer IAM role grants account-wide `Describe*` only (RDS has no resource scoping there); create is unscoped by necessity; modify/delete are locked to `stem-pr-*`.
- **No dangerous endpoints** — there is no unauthenticated provisioning route; every state-changing route requires a session, the internal token, or a valid webhook signature.

## Stack

Next.js 16 App Router · TypeScript (strict) · Tailwind · Vercel · AWS Aurora PostgreSQL Serverless v2 · Aurora DSQL · GitHub App (`@octokit/app`) · `@aws-sdk/client-rds` · `@aws-sdk/client-sts` · `@aws-sdk/dsql-signer`

## Deploy

Two Vercel projects: **backend** (repo root) and **frontend** (`frontend/`).

```bash
git clone https://github.com/Andrew-Kevin-007/stem-app
cd stem-app

# 1) Backend
cp .env.example .env.local            # fill in — see table below
npm install
npx vercel --prod

# 2) Frontend
cd frontend
cp .env.example .env.local            # set NEXT_PUBLIC_API_BASE to the backend URL
npm install
npx vercel --prod
```

**GitHub App** (one-time): create an App with `Pull requests: write` + `Contents: read`, subscribe to the `pull_request` webhook, point the webhook at `{backend}/api/webhook/github`, set the OAuth **Callback URL** to `{frontend}/api/auth/github/callback`, generate a client secret + private key.

**`STEM_INTERNAL_TOKEN` must be identical on both projects.** After deploy, hit `/api/health` on each — `ready: true` (frontend) and all-true `config` (backend) means you're set.

> Existing tenants who deployed their IAM role before the `ModifyDBCluster` permission was added must re-run the CloudShell command from the Connect page once.

### Environment — backend (repo root)

| Var | Required | Purpose |
|---|---|---|
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | ✓ | Control-plane creds (DSQL, operator cluster, STS) |
| `AWS_REGION` | ✓ | Default `us-east-1` |
| `DSQL_ENDPOINT` | ✓ | Aurora DSQL endpoint (no `https://`) |
| `AURORA_SOURCE_CLUSTER_ID` / `AURORA_SUBNET_GROUP` / `AURORA_SECURITY_GROUP_ID` | operator path | Operator's source cluster for `STEM_OPERATOR_LOGIN`'s repos |
| `AURORA_MASTER_USER` / `AURORA_MASTER_PASSWORD` | operator path | Operator clone DB credentials |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_WEBHOOK_SECRET` | ✓ | GitHub App identity + webhook HMAC |
| `VERCEL_TOKEN` / `VERCEL_PROJECT_ID` | operator path | `DATABASE_URL` injection into the preview project |
| `STEM_INTERNAL_TOKEN` | ✓ | Guards `/api/connections`; must match frontend |
| `STEM_OPERATOR_LOGIN` | – | Login that uses the env cluster (default `Andrew-Kevin-007`) |
| `STEM_TENANT_DB_SECRET` | – | Derives per-clone master passwords (falls back to webhook secret) |
| `STEM_TEAM_ID` | – | DSQL `team_id` (defaults to all-zeros UUID) |

### Environment — frontend (`frontend/`)

| Var | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | ✓ | Backend URL (no trailing slash) |
| `APP_BASE_URL` | ✓ in prod | Public frontend origin for OAuth redirect URIs |
| `AUTH_ENCRYPTION_KEY` (or `SESSION_SECRET`) | ✓ | 32+ random bytes; seals session cookies. **App fails closed without it in prod.** |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | ✓ | GitHub App OAuth credentials |
| `GITHUB_APP_SLUG` | – | Install-link slug (defaults to the deployed App) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | ✓ | Used to STS `AssumeRole` when verifying a tenant's role/cluster |
| `STEM_AWS_ACCOUNT_ID` | – | Trusted principal; auto-derived via STS `GetCallerIdentity` |
| `STEM_AWS_EXTERNAL_ID_SECRET` | – | ExternalId derivation (falls back to session secret) |
| `STEM_INTERNAL_TOKEN` | ✓ | Must match the backend |
| `STEM_PROTECTION_BYPASS` | – | Vercel Deployment Protection bypass, if the backend has SSO on |

## How the Pipeline Works

1. PR opened/reopened → webhook (HMAC verified) → AssumeRole → `RestoreDBClusterToPointInTime` (~10 s) → `cluster_ready`
2. Cron / **Advance Pipeline** button → `CreateDBInstance` (~5–10 min) → `instance_creating`
3. Cron again → instance `available` → reset clone password → bulk PII `UPDATE` → PR comment → `active`
4. PR closed → `DeleteDBInstance` + `DeleteDBCluster` → `destroyed`

The state machine is staged across cron runs because a single serverless invocation can't outlive instance provisioning. On Vercel Hobby (daily cron), use the **Advance Pipeline** button in the dashboard's operator console to step it manually for a demo.

## PII Anonymization

| Column | Replacement |
|---|---|
| `users.email` | random `user_XXXXXX@example.com` |
| `users.phone` | random US phone |
| `users.full_name` | random from a fixed pool of names |
| `payments.card_number` | `****-****-****-XXXX` |
| `payments.billing_address` | `NNN Example St, Anytown USA 10001` |

Defined in [`lib/anonymizer.ts`](lib/anonymizer.ts), applied inside the clone before any credentials are issued. The pass is schema-tolerant: tables/columns a tenant doesn't have are skipped (per-rule savepoints), so it runs against arbitrary schemas without failing.

## Operations

- **Health** — `GET /api/health` on both apps returns `ok` plus config-presence booleans (never secret values). The frontend probe also reports backend reachability. Point an uptime monitor here.
- **Monitoring** — pipeline and auth errors are `console.error`'d to Vercel function logs; the dashboard event stream shows live state transitions.
- **Cron** — `vercel.json` schedules `/api/cron/advance-pipeline` daily (Hobby ceiling); upgrade the plan for minute-level cron in production.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Sign-in shows "not configured" | Set `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `AUTH_ENCRYPTION_KEY`, redeploy. Check `/api/health`. |
| `state_mismatch` on sign-in | Retry in the same tab; allow cookies for the dashboard origin. |
| AWS connect can't assume the role | IAM is eventually consistent — wait ~30 s and retry; confirm the stack deployed in the intended account and the ExternalId matches. |
| Cluster step fails | Confirm cluster ID + region and that the role allows `rds:DescribeDBClusters`. |
| `stem-ci` never comments | Install the App on the repo (Connect page); no workflow file is needed. |
| Branch stuck in QUEUED | Source cluster hit Aurora's 15-clone limit — close stale PRs; queue drains FIFO. |

## Known Constraints

- **Vercel Hobby cron is daily** — use the Advance Pipeline button for demos, or upgrade for automatic minute-level progression.
- **Aurora clone limit** is 15 per source cluster; excess PRs queue.
- Aurora DSQL has no FK constraints and limited `ALTER TABLE`; `numeric` columns serialize as strings over node-postgres (the frontend normalizes payloads in `frontend/lib/api.ts`).
- Tenant clone anonymization requires the clone's master **username** + **database** name (collected on the Connect page, defaulted to `postgres`).

## Hackathon

Built for **H0: Hack the Zero Stack** — Vercel + AWS Databases. Submission deadline June 30, 2026.
