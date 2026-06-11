import { NextRequest, NextResponse } from 'next/server';
import { getAllActiveBranches, getAllPoolSlots } from '@/lib/dsql';

export async function GET(req: NextRequest) {
  try {
    // Tenant isolation: ?owner=<github_login> scopes branches to that user.
    // Omitted = operator/global view (back-compat).
    const owner = req.nextUrl.searchParams.get('owner') || undefined;
    const [branches, poolSlots] = await Promise.all([
      getAllActiveBranches(owner),
      getAllPoolSlots(),
    ]);
    return NextResponse.json({ branches, poolSlots });
  } catch (err) {
    console.error('Dashboard fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
