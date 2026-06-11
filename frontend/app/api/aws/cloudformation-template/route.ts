import { NextRequest, NextResponse } from "next/server"
import { readSession, SESSION_COOKIE } from "@/lib/auth"
import { cloudFormationTemplate, deriveExternalId, resolveStemAccountId } from "@/lib/aws-connect"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Personalized template (ExternalId baked in) for the manual console path.
// Auth-gated so the ExternalId is only ever shown to its owner.
export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

  const accountId = await resolveStemAccountId()
  if (!accountId) {
    return NextResponse.json(
      { error: "STEM control-plane AWS account not configured (set STEM_AWS_ACCOUNT_ID or AWS credentials)" },
      { status: 503 },
    )
  }

  const externalId = await deriveExternalId(session.sub)
  return new NextResponse(cloudFormationTemplate(accountId, externalId), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="stem-access-role.template.json"',
      "Cache-Control": "no-store",
    },
  })
}
