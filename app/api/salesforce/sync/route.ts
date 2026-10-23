import { NextResponse } from 'next/server';
import { getCotizacionByIdAsync, saveCotizacionAsync } from '@/lib/cotizaciones-db';
import { syncCotizacionToSalesforce } from '@/lib/salesforce/salesforce-sync-service';
import { getCurrentUser } from '@/lib/auth';
import { auditRequest } from '@/lib/audit-db';
import { sanitizeSectorProyecto, sanitizeSubsectorProyecto, sanitizeZonaProyecto } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cotizacionId, seccion, centroCosto, sectorProyecto, subsectorProyecto, zonaProyecto } = body;

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

    // Si se enviaron datos de clasificación actualizados desde el modal, persistirlos en la plataforma
    let cotizacionToSync = { ...cotizacion };
    if (seccion || centroCosto || sectorProyecto || subsectorProyecto || zonaProyecto) {
      cotizacionToSync = {
        ...cotizacionToSync,
        ...(seccion ? { seccion } : {}),
        ...(centroCosto ? { centroCosto } : {}),
        ...(sectorProyecto ? { sectorProyecto: sanitizeSectorProyecto(sectorProyecto) } : {}),
        ...(subsectorProyecto ? { subsectorProyecto: sanitizeSubsectorProyecto(subsectorProyecto) } : {}),
        ...(zonaProyecto ? { zonaProyecto: sanitizeZonaProyecto(zonaProyecto) } : {}),
      };
      await saveCotizacionAsync(cotizacionToSync);
    }

    const result = await syncCotizacionToSalesforce(cotizacionToSync);
    await auditRequest(req, await getCurrentUser(), {
      action: 'SALESFORCE_SYNC',
      module: 'Salesforce',
      description: 'Envío de la cotización ' + cotizacion.code + ' (' + cotizacion.clientName + ') a Salesforce.',
      details: { cotizacionId, code: cotizacion.code, cliente: cotizacion.clientName, centroCosto: cotizacionToSync.centroCosto, sector: sectorProyecto || null },
    });

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

