// Server-side helper to persist a user's AWS+Aurora connection to the STEM
// backend's DSQL store, authenticated with the shared internal token.

import { backendBase } from "./backend"

export interface PersistConnectionInput {
  github_login: string
  aws_role_arn: string
  aws_external_id: string
  aws_account_id: string
  aurora_cluster_id: string
  aurora_subnet_group: string
  aurora_sg_id: string
  aurora_region: string
  aurora_master_user: string
  aurora_database: string
}

export async function persistConnection(input: PersistConnectionInput): Promise<void> {
  const token = process.env.STEM_INTERNAL_TOKEN
  const res = await fetch(`${backendBase()}/api/connections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-stem-internal-token": token } : {}),
    },
    body: JSON.stringify(input),
    cache: "no-store",
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`Backend rejected connection (${res.status}): ${detail.slice(0, 200)}`)
  }
}
