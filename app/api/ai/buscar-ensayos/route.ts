import { NextRequest, NextResponse } from 'next/server';
import { buscarEnsayosConIA } from '@/lib/ai-service';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const query = typeof body.query === 'string' ? body.query : '';
    const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;

    if (!query.trim()) {
      return NextResponse.json({ sugerencias: [] });
    }

    const sugerencias = await buscarEnsayosConIA(query.trim(), apiKey);

    return NextResponse.json({
      query: query.trim(),
      sugerencias,
    });
  } catch (err: any) {
    console.error('Error en /api/ai/buscar-ensayos:', err);
    return NextResponse.json(
      { error: err.message || 'Error al buscar ensayos con IA' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';

    if (!query.trim()) {
      return NextResponse.json({ sugerencias: [] });
    }

    const sugerencias = await buscarEnsayosConIA(query.trim());

    return NextResponse.json({
      query: query.trim(),
      sugerencias,
    });
  } catch (err: any) {
    console.error('Error en /api/ai/buscar-ensayos GET:', err);
    return NextResponse.json(
      { error: err.message || 'Error al buscar ensayos con IA' },
      { status: 500 }
    );
  }
}

