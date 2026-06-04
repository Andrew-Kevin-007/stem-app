import { NextResponse } from 'next/server';
import { getAllActiveBranches, getAllPoolSlots } from '@/lib/dsql';

export async function GET() {
  try {
    const [branches, poolSlots] = await Promise.all([
      getAllActiveBranches(),
      getAllPoolSlots(),
    ]);
    return NextResponse.json({ branches, poolSlots });
  } catch (err) {
    console.error('Dashboard fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}