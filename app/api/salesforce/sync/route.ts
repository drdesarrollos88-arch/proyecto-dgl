import { NextResponse } from 'next/server';
import { getCotizacionByIdAsync } from '@/lib/cotizaciones-db';
import { syncCotizacionToSalesforce } from '@/lib/salesforce/salesforce-sync-service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cotizacionId } = body;

    if (!cotizacionId) {
      return NextResponse.json(
        { success: false, error: 'cotizacionId es requerido.' },
        { status: 400 }
      );
    }

    const cotizacion = await getCotizacionByIdAsync(cotizacionId);
    if (!cotizacion) {
      return NextResponse.json(
        { success: false, error: `No se encontró la cotización con ID ${cotizacionId}.` },
        { status: 404 }
      );
    }

    // Validación 1: No permitir Borradores
    if (cotizacion.status === 'Borrador') {
      return NextResponse.json(
        {
          success: false,
          error: `La cotización ${cotizacion.code} se encuentra en estado "Borrador". Debe cambiar el estado a "Finalizada" antes de enviarla a Salesforce.`,
        },
        { status: 400 }
      );
    }

    const result = await syncCotizacionToSalesforce(cotizacion);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Error sincronizando cotización con Salesforce:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Error inesperado al sincronizar con Salesforce.',
      },
      { status: 500 }
    );
  }
}

