import type { Branch, BranchState, DashboardData, PoolSlot } from "./types"

// The browser always talks to same-origin proxy routes (app/api/*), which
// forward server-side to the STEM backend at NEXT_PUBLIC_API_BASE. The
// backend sends no CORS headers, so a direct cross-origin fetch would be
// blocked — the proxy hop removes that failure mode entirely.
export const DASHBOARD_URL = "/api/dashboard"
export const ADVANCE_PIPELINE_URL = "/api/cron/advance-pipeline"

const BRANCH_STATES: BranchState[] = ["cluster_ready", "instance_creating", "active", "masking_failed", "destroyed"]
const SLOT_STATES: PoolSlot["state"][] = ["warm", "in_use", "provisioning"]

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number)
  return typeof n === "number" && Number.isFinite(n) ? n : fallback
}

function asStringArray(value: unknown): string[] {
  // DSQL may hand the column back as a JSON-encoded string.
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
      return []
    }
  }
  return Array.isArray(value) ? value.map(String) : []
}

function normalizeBranch(raw: Record<string, unknown>): Branch {
  const state = BRANCH_STATES.includes(raw.state as BranchState) ? (raw.state as BranchState) : "cluster_ready"
  return {
    pr_number: asNumber(raw.pr_number),
    clone_cluster_id: String(raw.clone_cluster_id ?? ""),
    endpoint: String(raw.endpoint ?? ""),
    state,
    anonymized_columns: asStringArray(raw.anonymized_columns),
    cost_estimate_daily: asNumber(raw.cost_estimate_daily),
    ready_in_seconds: asNumber(raw.ready_in_seconds),
    owner: String(raw.owner ?? ""),
    repo: String(raw.repo ?? ""),
    created_at: typeof raw.created_at === "string" ? raw.created_at : "",
  }
}

function normalizeSlot(raw: Record<string, unknown>, index: number): PoolSlot {
  // Tolerate legacy field names (status / cluster_id) from older payloads.
  const state = (raw.state ?? raw.status) as PoolSlot["state"]
  const branchId = raw.branch_id ?? raw.cluster_id
  return {
    slot_id: String(raw.slot_id ?? `slot-${String(index + 1).padStart(2, "0")}`),
    state: SLOT_STATES.includes(state) ? state : "warm",
    ...(branchId ? { branch_id: String(branchId) } : {}),
  }
}

export function normalizeDashboard(raw: unknown): DashboardData {
  const data = (raw ?? {}) as { branches?: unknown; poolSlots?: unknown }
  const branches = Array.isArray(data.branches)
    ? data.branches.map((b) => normalizeBranch(b as Record<string, unknown>))
    : []
  const poolSlots = Array.isArray(data.poolSlots)
    ? data.poolSlots.map((s, i) => normalizeSlot(s as Record<string, unknown>, i))
    : []
  return { branches, poolSlots }
}

export async function fetchDashboard(): Promise<DashboardData> {
  const res = await fetch(DASHBOARD_URL, { cache: "no-store" })
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`)
  return normalizeDashboard(await res.json())
}

export async function advancePipeline(): Promise<{ ok: boolean }> {
  const res = await fetch(ADVANCE_PIPELINE_URL, { cache: "no-store" })
  if (!res.ok) throw new Error(`Pipeline advance failed: ${res.status}`)
  return res.json()
}
