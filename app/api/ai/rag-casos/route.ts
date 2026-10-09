import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCasosHistoricosRAGAsync, buscarCasosHistoricosSimilaresAsync } from '@/lib/rag-service';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const casos = await getCasosHistoricosRAGAsync();
    return NextResponse.json({ success: true, casos });
  } catch (err) {
    console.error('Error al obtener casos RAG:', err);
    return NextResponse.json(
      { error: 'Error al consultar casos históricos' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { query, centroCosto, limit } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'La consulta no puede estar vacía' },
        { status: 400 }
      );
    }

    const resultado = await buscarCasosHistoricosSimilaresAsync(
      query.trim(),
      centroCosto,
      limit ? Number(limit) : 2
    );

    return NextResponse.json({
      success: true,
      casos: resultado.casos,
      snippet: resultado.promptSnippet,
    });
  } catch (err) {
    console.error('Error al simular búsqueda RAG:', err);
    return NextResponse.json(
      { error: 'Error al simular la búsqueda RAG' },
      { status: 500 }
    );
  }
}

