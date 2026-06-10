import { NextRequest, NextResponse } from "next/server"
import {
  readSession,
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions,
  type AwsConnection,
} from "@/lib/auth"
import { deriveExternalId, isStsConfigured, parseRoleArn, verifyAssumeRole } from "@/lib/aws-connect"

export const dynamic = "force-dynamic"
export const runtime = "nodejs" // AWS SDK + STS AssumeRole

export async function POST(req: NextRequest) {
  const session = await readSession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

  let body: { roleArn?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const roleArn = typeof body.roleArn === "string" ? body.roleArn.trim() : ""
  const parsed = parseRoleArn(roleArn)
  if (!parsed) {
    return NextResponse.json({ error: "Enter a valid IAM role ARN (arn:aws:iam::<account>:role/<name>)" }, { status: 400 })
  }

  const externalId = await deriveExternalId(session.sub)

  let accountId = parsed.accountId
  let verified = false
  if (isStsConfigured()) {
    try {
      const result = await verifyAssumeRole(roleArn, externalId)
      accountId = result.accountId
      verified = true
    } catch (err) {
      return NextResponse.json(
        {
          error:
            "Could not assume the role. Confirm the CloudFormation stack deployed and the trust policy/ExternalId match, then retry.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 422 },
      )
    }
  }

  const aws: AwsConnection = { accountId, roleArn, externalId, verified, connectedAt: Date.now() }
  const res = NextResponse.json({ ok: true, accountId, verified })
  res.cookies.set(
    SESSION_COOKIE,
    await createSessionToken({
      sub: session.sub,
      login: session.login,
      name: session.name,
      email: session.email,
      avatarUrl: session.avatarUrl,
      ghToken: session.ghToken,
      installations: session.installations,
      aws,
      demo: session.demo,
    }),
    sessionCookieOptions,
  )
  return res
}
