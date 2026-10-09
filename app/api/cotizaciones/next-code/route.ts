import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getNextCorrelativoAsync } from '@/lib/configuracion-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const centroCosto = searchParams.get('centroCosto') || '2339';
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  try {
    const next = await getNextCorrelativoAsync(centroCosto, year);
    return NextResponse.json({ success: true, ...next });
  } catch (err) {
    console.error('Error getting next correlativo:', err);
    return NextResponse.json({ error: 'Error al generar siguiente correlativo' }, { status: 500 });
  }
}

