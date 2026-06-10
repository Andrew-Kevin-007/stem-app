import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { SupportContent } from "@/components/support/support-content"

export const metadata: Metadata = {
  title: "Support — STEM",
  description:
    "Troubleshooting runbooks, frequently asked questions, and escalation paths for STEM database branches.",
}

export default function SupportPage() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 pt-16">
        <SupportContent />
      </div>
    </main>
  )
}
