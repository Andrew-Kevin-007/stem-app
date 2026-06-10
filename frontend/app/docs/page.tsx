import type { Metadata } from "next"
import { Navbar } from "@/components/navbar"
import { DocsContent } from "@/components/docs/docs-content"

export const metadata: Metadata = {
  title: "Documentation — STEM",
  description:
    "Set up isolated, PII-anonymized database branches for every pull request. Quickstart, configuration reference, anonymization rules, and architecture deep-dive.",
}

export default function DocsPage() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 pt-16">
        <DocsContent />
      </div>
    </main>
  )
}
