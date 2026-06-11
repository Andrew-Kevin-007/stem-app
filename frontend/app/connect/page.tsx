import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies, headers } from "next/headers"
import { readSession, toPublicSession, SESSION_COOKIE } from "@/lib/auth"
import { appInstallUrl, isGitHubOAuthConfigured } from "@/lib/github-oauth"
import {
  cloudShellCommand,
  cloudShellUrl,
  consoleCreateStackUrl,
  deriveExternalId,
  isStsConfigured,
  resolveStemAccountId,
} from "@/lib/aws-connect"
import { ConnectClient } from "./connect-client"

export const metadata: Metadata = {
  title: "STEM / Connect",
  description: "Install the STEM GitHub App and connect your AWS account.",
}

async function requestOrigin(): Promise<string> {
  const configured = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL
  if (configured) return configured.replace(/\/+$/, "")
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  return `${proto}://${host}`
}

export default async function ConnectPage() {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect("/login?next=/connect")

  const [externalId, stemAccountId, origin] = await Promise.all([
    deriveExternalId(session.sub),
    resolveStemAccountId(),
    requestOrigin(),
  ])

  return (
    <main className="relative min-h-screen">
      <div className="grid-bg fixed inset-0 opacity-30" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
        <ConnectClient
          session={toPublicSession(session)}
          oauthEnabled={isGitHubOAuthConfigured()}
          installUrl={appInstallUrl()}
          aws={{
            externalId,
            stemAccountId,
            shellCommand: cloudShellCommand(origin, externalId),
            shellUrl: cloudShellUrl(),
            consoleUrl: consoleCreateStackUrl(),
            stsConfigured: isStsConfigured(),
          }}
        />
      </div>
    </main>
  )
}
