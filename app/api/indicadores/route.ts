import { NextRequest, NextResponse } from 'next/server';
import { getEconomicIndicators } from '@/lib/uf';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  const indicators = await getEconomicIndicators(forceRefresh);
  return NextResponse.json(indicators);
}

