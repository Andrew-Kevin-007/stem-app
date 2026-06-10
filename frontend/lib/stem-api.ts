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
  { label: string; tone: "accent" | "amber" | "muted" }
> = {
  active: { label: "ACTIVE", tone: "accent" },
  instance_creating: { label: "PROVISIONING", tone: "amber" },
  cluster_ready: { label: "QUEUED", tone: "muted" },
}

/** Dashboard display order: live first, then provisioning, then queued. */
export const STATE_RANK: Record<BranchState, number> = {
  active: 0,
  instance_creating: 1,
  cluster_ready: 2,
  destroyed: 3,
}
