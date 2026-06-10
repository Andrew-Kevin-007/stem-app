# 🌿 Stem — Isolated Database Branches for Every PR

Every GitHub PR gets its own Aurora PostgreSQL copy-on-write clone, PII-anonymized in 28 seconds.

## What It Does

Stem is a DevTool for teams in regulated industries (GDPR / HIPAA / SOC 2) who can't hand production data to every contractor and preview deployment. When a PR opens, Stem restores an Aurora copy-on-write clone of the production cluster via `RestoreDBClusterToPointInTime` (~28s to a usable branch), bulk-updates PII columns with realistic fake data, injects the clone's `DATABASE_URL` into the Vercel preview environment, and posts a summary comment on the PR through a GitHub App. When the PR closes, the clone and all associated resources are destroyed automatically.

## Live Demo

Dashboard: **<https://stem-frontend-six.vercel.app>**

The dashboard sits behind a login gate. On the public demo instance, sign in with any email and access key `stem-demo`. Authenticated operators see live branch state and can copy clone connection endpoints.

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

### Dashboard authentication

The frontend gates `/dashboard` and its data routes behind `/login`. Sessions are HMAC-signed, `httpOnly`, `SameSite=Lax` cookies (12 h TTL); login attempts are rate-limited and the access key is compared in constant time.

- `DASHBOARD_ACCESS_KEY` — the access key your users enter at `/login`. Unset = demo mode, which accepts the public key `stem-demo`.
- `SESSION_SECRET` — cookie-signing secret. Set a long random value in production.

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
