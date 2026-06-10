# 🌿 Stem — Isolated Database Branches for Every PR

Every GitHub PR gets its own Aurora PostgreSQL copy-on-write clone, PII-anonymized in 28 seconds.

## What It Does

Stem is a DevTool for teams in regulated industries (GDPR / HIPAA / SOC 2) who can't hand production data to every contractor and preview deployment. When a PR opens, Stem restores an Aurora copy-on-write clone of the production cluster via `RestoreDBClusterToPointInTime` (~28s to a usable branch), bulk-updates PII columns with realistic fake data, injects the clone's `DATABASE_URL` into the Vercel preview environment, and posts a summary comment on the PR through a GitHub App. When the PR closes, the clone and all associated resources are destroyed automatically.

## Live Demo

Dashboard: **<https://stem-frontend-six.vercel.app>**

The dashboard sits behind **Sign in with GitHub**. Authenticated operators see live branch state, copy clone connection endpoints, and connect the repos + AWS account STEM provisions into. When GitHub OAuth isn't configured on a deployment, a clearly-labeled demo session is offered instead so the UI is still explorable.

The demo is connected to a real Aurora PostgreSQL source database and a real GitHub App: opening a PR on [`Andrew-Kevin-007/stem-test-repo`](https://github.com/Andrew-Kevin-007/stem-test-repo) triggers the actual pipeline.

## Architecture

```
GitHub PR opened
      │
      ▼
Webhook (Next.js API Route)
  └─ Creates Aurora COW clone (RestoreDBClusterToPointInTime)
  └─ Saves to Aurora DSQL: state = cluster_ready
      │
      ▼
Cron: /api/cron/advance-pipeline
  Stage 1: cluster_ready → CreateDBInstance → state = instance_creating
  Stage 2: instance_creating (available) →
    ├─ Run PII anonymization (bulk UPDATE)
    ├─ Inject DATABASE_URL into Vercel env
    ├─ Post PR comment via GitHub App bot
    └─ state = active
      │
      ▼
PR merged/closed
  └─ Delete instance + cluster
  └─ Remove Vercel env var
```

Stem uses two AWS databases for two different jobs:

- **Aurora PostgreSQL Serverless v2** — the product. Copy-on-write clones of the source cluster give each PR full production-shaped data without duplicating storage.
- **Aurora DSQL** — the control plane. Branch and pool-slot metadata lives in a serverless, IAM-authenticated SQL store with no connection management.

The frontend dashboard polls the backend through same-origin proxy routes (`frontend/app/api/*`), so the browser never makes a cross-origin call and the backend needs no CORS configuration.

## Stack

Next.js 16 App Router · TypeScript · Tailwind · Vercel · AWS Aurora PostgreSQL Serverless v2 · Aurora DSQL · GitHub App (`@octokit/app`) · `@aws-sdk/client-rds` · `@aws-sdk/dsql-signer`

## Self-Hosting Prerequisites

- AWS account with an Aurora PostgreSQL Serverless v2 source cluster and an Aurora DSQL cluster, both in `us-east-1`
- GitHub App installed on your org/repo with `pull_requests: write` and `contents: read` permissions, subscribed to the `pull_request` webhook event
- Vercel account with two projects: backend (`stem-app`) and frontend (`stem-app/frontend`)
- Node.js 18+

## Setup

```bash
git clone https://github.com/Andrew-Kevin-007/stem-app
cd stem-app
cp .env.example .env.local
# Fill in .env.local
npm install
npx vercel --prod

cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_BASE to your deployed backend URL
npm install
npx vercel --prod
```

Both projects deploy directly with `vercel --prod`; no GitHub auto-deploy integration is required.

### Authentication & account connection

The frontend gates `/dashboard`, `/connect`, and the data/AWS routes behind a real **GitHub App OAuth** sign-in (enforced in `middleware.ts`). After signing in, operators complete a two-step `/connect` onboarding:

1. **GitHub repository access** — install the STEM App on chosen repos (`pull_requests: write`, `contents: read`). Access comes from the App installation, *not* broad OAuth scopes; the OAuth step only reads the public profile.
2. **AWS account access** — connect via a **cross-account IAM role** (the Datadog/Vercel pattern). The user deploys a CloudFormation stack (template generated per-user with their unique, server-derived **ExternalId**) that creates a least-privilege role trusting STEM's AWS account. STEM verifies the connection by performing an STS `AssumeRole`. No long-lived AWS keys ever leave the customer account.

Security properties: sessions are **AES-256-GCM-encrypted** `httpOnly` `SameSite=Lax` cookies (12 h TTL) — the GitHub token is never exposed to the browser; OAuth uses a sealed, single-use `state` cookie for CSRF; the ExternalId guards against confused-deputy; security headers (`nosniff`, `X-Frame-Options: DENY`, referrer + permissions policy) are set globally.

Environment (see `frontend/.env.example`):

- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — the GitHub App's OAuth credentials. Unset = demo mode. Set the App's callback URL to `{APP_BASE_URL}/api/auth/github/callback`.
- `GITHUB_APP_SLUG` — used to build the App install link.
- `AUTH_ENCRYPTION_KEY` (or `SESSION_SECRET`) — 32+ random bytes for session encryption.
- `STEM_AWS_ACCOUNT_ID` / `STEM_AWS_EXTERNAL_ID_SECRET` — trusted principal + ExternalId derivation.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — STEM's control-plane creds used to verify the assumed role.

## How the Pipeline Works

1. Webhook fires on PR open → `RestoreDBClusterToPointInTime` (~10s) → state: `cluster_ready`
2. Cron / manual advance → `CreateDBInstance` (~5–10 min) → state: `instance_creating`
3. Cron / manual advance again → instance `available` → bulk PII `UPDATE` → Vercel env inject → GitHub PR comment → state: `active`
4. PR closed → `DeleteDBInstance` + `DeleteDBCluster` + remove Vercel env var → state: `destroyed`

The state machine is staged across cron runs because a single Vercel function invocation can't outlive the instance-provisioning window. On the Vercel Hobby plan, cron is daily-only — use the **ADVANCE PIPELINE** button in the dashboard's operator console to step the pipeline manually during development or a demo.

## PII Anonymization Rules

| Column | Replacement |
|---|---|
| `users.email` | random `user_XXXXXX@example.com` |
| `users.phone` | random US phone |
| `users.full_name` | random from a fixed pool of names |
| `payments.card_number` | `****-****-****-XXXX` |
| `payments.billing_address` | `NNN Example St, Anytown USA 10001` |

Rules are defined in [`lib/anonymizer.ts`](lib/anonymizer.ts) and can be extended for any table/column.

## Known Constraints

- Vercel Hobby: cron max `0 0 * * *` (daily) — trigger manually for demo
- Aurora DSQL: no FK constraints, limited `ALTER TABLE` support (no `DROP NOT NULL`)
- DSQL `numeric` columns serialize as strings over node-postgres — the frontend normalizes all payloads in `frontend/lib/api.ts`
- `team_id` hardcoded as `00000000-0000-0000-0000-000000000001` in DSQL inserts
- Vercel project not connected to a GitHub repo → no `gitBranch` scoping on env vars

## Hackathon

Built for **H0: Hack the Zero Stack** — Vercel v0 + AWS Databases. Submission deadline June 30, 2026.
