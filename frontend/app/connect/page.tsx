import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { readSession, toPublicSession, SESSION_COOKIE } from "@/lib/auth"
import { appInstallUrl, isGitHubOAuthConfigured } from "@/lib/github-oauth"
import { consoleCreateStackUrl, deriveExternalId, isStsConfigured, stemAwsAccountId } from "@/lib/aws-connect"
import { ConnectClient } from "./connect-client"

export const metadata: Metadata = {
  title: "STEM / Connect",
  description: "Install the STEM GitHub App and connect your AWS account.",
}

export default async function ConnectPage() {
  const session = await readSession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!session) redirect("/login?next=/connect")

  const externalId = await deriveExternalId(session.sub)

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
            stemAccountId: stemAwsAccountId(),
            consoleUrl: consoleCreateStackUrl(),
            stsConfigured: isStsConfigured(),
          }}
        />
      </div>
    </main>
  )
}
