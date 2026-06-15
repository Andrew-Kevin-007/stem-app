// Backend contract — shapes returned by GET /api/dashboard.

export type BranchState =
  | "cluster_ready"
  | "instance_creating"
  | "active"
  | "masking_failed"
  | "destroyed"

export interface Branch {
  pr_number: number
  clone_cluster_id: string
  endpoint: string
  state: BranchState
  anonymized_columns: string[]
  cost_estimate_daily: number
  ready_in_seconds: number
  owner: string
  repo: string
  created_at: string
}

export interface PoolSlot {
  slot_id: string
  state: "warm" | "in_use" | "provisioning"
  branch_id?: string
}

export interface DashboardData {
  branches: Branch[]
  poolSlots: PoolSlot[]
}
