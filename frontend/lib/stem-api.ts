// STEM API client — single import surface for the dashboard components.
// Contract types live in lib/types.ts, transport in lib/api.ts.

export type { BranchState, Branch, PoolSlot, DashboardData } from "./types"
export {
  fetchDashboard,
  advancePipeline,
  normalizeDashboard,
  DASHBOARD_URL,
  ADVANCE_PIPELINE_URL,
} from "./api"

import type { BranchState } from "./types"

export const STATE_CONFIG: Record<
  Exclude<BranchState, "destroyed">,
  { label: string; tone: "accent" | "amber" | "muted" | "destructive" }
> = {
  active: { label: "ACTIVE", tone: "accent" },
  masking_failed: { label: "NEEDS MASKING", tone: "destructive" },
  instance_creating: { label: "PROVISIONING", tone: "amber" },
  cluster_ready: { label: "QUEUED", tone: "muted" },
}

/** Dashboard display order: live first, then attention-needed, then in-flight. */
export const STATE_RANK: Record<BranchState, number> = {
  active: 0,
  masking_failed: 1,
  instance_creating: 2,
  cluster_ready: 3,
  destroyed: 4,
}
