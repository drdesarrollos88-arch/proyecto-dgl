import { NextResponse } from 'next/server';
import { closeOpportunityWon, closeOpportunityLost } from '@/lib/salesforce/salesforce-sync-service';
import { getCotizacionByIdAsync } from '@/lib/cotizaciones-db';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, cotizacionId, ...params } = body;

    if (!cotizacionId) {
      return NextResponse.json(
        { success: false, error: 'cotizacionId es requerido.' },
        { status: 400 }
      );
    }

    if (!action || !['ganada', 'perdida'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action debe ser "ganada" o "perdida".' },
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

    if (action === 'ganada') {
      const { closingUf, closingClp, fechaCierre, cantidadCuotas, fechaPrimeraFacturacion, cuotas, userName } = params;

      if (!closingUf || !closingClp) {
        return NextResponse.json(
          { success: false, error: 'Debe especificar el monto de cierre en UF y CLP.' },
          { status: 400 }
        );
      }

      if (!cuotas || !Array.isArray(cuotas) || cuotas.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Debe ingresar al menos 1 cuota de facturación.' },
          { status: 400 }
        );
      }

      const result = await closeOpportunityWon({
        cotizacionId,
        closingUf: Number(closingUf),
        closingClp: Number(closingClp),
        fechaCierre: fechaCierre || new Date().toISOString().split('T')[0],
        cantidadCuotas: Number(cantidadCuotas) || cuotas.length,
        fechaPrimeraFacturacion: fechaPrimeraFacturacion || fechaCierre || new Date().toISOString().split('T')[0],
        cuotas,
        userName,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    if (action === 'perdida') {
      const { fechaCierre, motivoRechazo, observaciones, userName } = params;

      if (!motivoRechazo) {
        return NextResponse.json(
          { success: false, error: 'Debe seleccionar un motivo de rechazo de la lista de Salesforce.' },
          { status: 400 }
        );
      }

      const result = await closeOpportunityLost({
        cotizacionId,
        fechaCierre: fechaCierre || new Date().toISOString().split('T')[0],
        motivoRechazo,
        observaciones,
        userName,
      });

      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    return NextResponse.json({ success: false, error: 'Acción no soportada.' }, { status: 400 });
  } catch (err: any) {
    console.error('Error en cierre de oportunidad Salesforce:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Error inesperado al registrar cierre en Salesforce.',
      },
      { status: 500 }
    );
  }
}

