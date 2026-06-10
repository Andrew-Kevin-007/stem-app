import { NextRequest, NextResponse } from "next/server"
import { readSession, SESSION_COOKIE } from "@/lib/auth"
import { cloudFormationTemplate, deriveExternalId } from "@/lib/aws-connect"

export const dynamic = "force-dynamic"

// Serves the per-user CloudFormation template (ExternalId baked in) for
// download / copy. Auth-gated so the ExternalId is only ever shown to its owner.
export async function GET(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

  const externalId = await deriveExternalId(session.sub)
  return new NextResponse(cloudFormationTemplate(externalId), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="stem-access-role.template.json"',
      "Cache-Control": "no-store",
    },
  })
}
