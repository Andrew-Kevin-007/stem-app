# STEM Frontend

Next.js 16 App Router dashboard for [STEM](../README.md) — isolated, PII-anonymized Aurora
database branches for every PR. Deployed as its own Vercel project (`vercel --prod` from this
directory).

## What lives here

- `/` — marketing/landing pages (static)
- `/login` — Sign in with GitHub (GitHub App OAuth)
- `/connect` — onboarding: install the GitHub App, connect AWS via cross-account IAM role
- `/dashboard` — live branch state, polled every 10 s through same-origin proxy routes
- `app/api/dashboard`, `app/api/cron/*` — server-side proxies to the STEM backend (no CORS needed)
- `app/api/auth/*` — OAuth flow + session management (AES-256-GCM cookie sessions)
- `app/api/aws/*` — CloudFormation template + STS AssumeRole verification
- `middleware.ts` — session gate for the dashboard and data routes

## Run locally

```bash
cp .env.example .env.local   # fill in — see comments in the file
npm install
npm run dev
```

Type-check with `npx tsc --noEmit`. Build with `npm run build`.

## Deploy

```bash
npx vercel --prod
```

Set the env vars from `.env.example` in the Vercel project. `APP_BASE_URL` should be the
production origin; the GitHub App's callback URL must be `{APP_BASE_URL}/api/auth/github/callback`.
