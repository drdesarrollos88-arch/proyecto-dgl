import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCotizacionByIdAsync } from '@/lib/cotizaciones-db';
import { generateCotizacionExcel } from '@/lib/excel-generator';
import { auditRequest } from '@/lib/audit-db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const cotizacion = await getCotizacionByIdAsync(id);

  if (!cotizacion) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }

  const buffer = await generateCotizacionExcel(cotizacion);
  const cleanCode = cotizacion.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Cotizacion_${cleanCode}_${cotizacion.clientName.slice(0, 15).replace(/\s+/g, '_')}.xlsx`;

  await auditRequest(req, currentUser, {
    action: 'COTIZACION_DESCARGAR',
    module: 'Cotizaciones',
    description: 'Descarga de Excel de la cotización ' + cotizacion.code + ' - ' + cotizacion.clientName + '.',
    details: { id, code: cotizacion.code, cliente: cotizacion.clientName, formato: 'xlsx' },
  });

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

