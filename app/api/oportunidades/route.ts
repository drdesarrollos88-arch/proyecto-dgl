import { NextRequest, NextResponse } from 'next/server';
import {
  getConsolidadoOportunidades,
  syncSalesforceOportunidades,
  saveMetasComerciales,
} from '@/lib/oportunidades-service';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const anio = Number(searchParams.get('anio') || new Date().getFullYear());
    const mes = Number(searchParams.get('mes') || 0); // 0 = acumulado YTD
    const division = searchParams.get('division') || 'DGL';
    const source = (searchParams.get('source') || 'TODOS') as 'TODOS' | 'WEB_DGL' | 'SALESFORCE';
    const estado = (searchParams.get('estado') || 'TODOS') as 'TODOS' | 'ganada' | 'perdida' | 'en_curso';
    const comercial = searchParams.get('comercial') || 'TODOS';
    const search = searchParams.get('search') || '';

    const data = await getConsolidadoOportunidades({
      anio,
      mes,
      division,
      source,
      estado,
      comercial,
      search,
    });

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error en GET /api/oportunidades:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al obtener oportunidades y KPIs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const action = body.action;

    if (action === 'sync_salesforce') {
      const anio = Number(body.anio || new Date().getFullYear());
      const division = body.division || 'DGL';
      const result = await syncSalesforceOportunidades(anio, division);
      return NextResponse.json({
        success: true,
        message: `Sincronizadas exitosamente ${result.count} oportunidades de Salesforce para ${division} (${anio})`,
        count: result.count,
      });
    }

    if (action === 'save_metas') {
      const metas = body.metas;
      if (!Array.isArray(metas)) {
        return NextResponse.json({ error: 'Formato de metas inválido' }, { status: 400 });
      }
      saveMetasComerciales(metas);
      return NextResponse.json({ success: true, message: 'Metas comerciales actualizadas correctamente' });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en POST /api/oportunidades:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}

