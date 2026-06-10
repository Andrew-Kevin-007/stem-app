import { HeroSection } from "@/components/hero-section"
import { MarqueeTicker } from "@/components/marquee-ticker"
import { SignalsSection } from "@/components/signals-section"
import { WorkSection } from "@/components/work-section"
import { PrinciplesSection } from "@/components/principles-section"
import { TrustSection } from "@/components/trust-section"
import { ColophonSection } from "@/components/colophon-section"
import { Navbar } from "@/components/navbar"

export default function Page() {
  return (
    <main className="relative min-h-screen">
      <Navbar />
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />

      <div className="relative z-10">
        <HeroSection />
        <MarqueeTicker />
        <SignalsSection />
        <WorkSection />
        <PrinciplesSection />
        <TrustSection />
        <ColophonSection />
      </div>
    </main>
  )
}
