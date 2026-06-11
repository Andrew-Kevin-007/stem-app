import { NextResponse } from "next/server"
import { parameterizedTemplate, resolveStemAccountId } from "@/lib/aws-connect"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// PUBLIC route (allow-listed in middleware): the parameterized CloudFormation
// template CloudShell fetches. Contains no user data — the ExternalId is a
// stack parameter the user supplies in the deploy command.
export async function GET() {
  const accountId = await resolveStemAccountId()
  if (!accountId) {
    return NextResponse.json(
      { error: "STEM control-plane AWS account not configured (set STEM_AWS_ACCOUNT_ID or AWS credentials)" },
      { status: 503 },
    )
  }
  return new NextResponse(parameterizedTemplate(accountId), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  })
}
