import { NextRequest, NextResponse } from 'next/server';
import { verifyInternalToken } from '@/lib/tenant';
import {
  saveUserConnection,
  getUserConnectionByLogin,
  deleteUserConnection,
  type UserConnection,
} from '@/lib/dsql';

export const dynamic = 'force-dynamic';

// Internal endpoint: the frontend persists a user's AWS+Aurora connection here
// after verifying the role and cluster. Shared-secret authenticated — this is
// a write path that controls where a user's clones provision, so it must not
// be publicly callable.

function auth(req: NextRequest): NextResponse | null {
  const { ok, reason } = verifyInternalToken(req.headers.get('x-stem-internal-token'));
  return ok ? null : NextResponse.json({ error: `Forbidden: ${reason}` }, { status: 403 });
}

const REGION_RE = /^[a-z]{2}-[a-z]+-\d$/;
const ARN_RE = /^arn:aws:iam::\d{12}:role\/[\w+=,.@/-]+$/;

export async function GET(req: NextRequest) {
  const denied = auth(req);
  if (denied) return denied;
  const login = req.nextUrl.searchParams.get('login');
  if (!login) return NextResponse.json({ error: 'login required' }, { status: 400 });
  const conn = await getUserConnectionByLogin(login);
  return NextResponse.json({ connected: !!conn, connection: conn });
}

export async function POST(req: NextRequest) {
  const denied = auth(req);
  if (denied) return denied;

  let body: Partial<UserConnection>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const required: (keyof UserConnection)[] = [
    'github_login', 'aws_role_arn', 'aws_external_id', 'aws_account_id',
    'aurora_cluster_id', 'aurora_subnet_group', 'aurora_sg_id', 'aurora_region',
  ];
  for (const k of required) {
    if (typeof body[k] !== 'string' || !(body[k] as string).trim()) {
      return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 });
    }
  }
  if (!ARN_RE.test(body.aws_role_arn!)) {
    return NextResponse.json({ error: 'Invalid role ARN' }, { status: 400 });
  }
  if (!REGION_RE.test(body.aurora_region!)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const conn: UserConnection = {
    github_login: body.github_login!.trim(),
    aws_role_arn: body.aws_role_arn!.trim(),
    aws_external_id: body.aws_external_id!.trim(),
    aws_account_id: body.aws_account_id!.trim(),
    aurora_cluster_id: body.aurora_cluster_id!.trim(),
    aurora_subnet_group: body.aurora_subnet_group!.trim(),
    aurora_sg_id: body.aurora_sg_id!.trim(),
    aurora_region: body.aurora_region!.trim(),
    aurora_master_user: (body.aurora_master_user || 'postgres').trim(),
    aurora_database: (body.aurora_database || 'postgres').trim(),
    connected_at: Date.now(),
  };

  await saveUserConnection(conn);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = auth(req);
  if (denied) return denied;
  const login = req.nextUrl.searchParams.get('login');
  if (!login) return NextResponse.json({ error: 'login required' }, { status: 400 });
  await deleteUserConnection(login);
  return NextResponse.json({ ok: true });
}
