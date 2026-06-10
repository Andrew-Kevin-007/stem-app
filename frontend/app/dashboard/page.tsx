import type { Metadata } from "next"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { DashboardClient } from "@/components/dashboard/dashboard-client"
import { AccountMenu } from "./account-menu"

export const metadata: Metadata = {
  title: "STEM / Mission Control",
  description: "Live branch dashboard — isolated database branches for every PR. Zero PII.",
}

export default function DashboardPage() {
  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <AccountMenu />

      <div className="relative z-10 flex min-h-screen flex-col">
        <DashboardHeader />
        <DashboardClient />
      </div>
    </main>
  )
}
