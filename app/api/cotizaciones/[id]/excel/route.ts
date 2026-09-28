import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCotizacionById } from '@/lib/db';
import { generateCotizacionExcel } from '@/lib/excel-generator';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const cotizacion = getCotizacionById(id);

  if (!cotizacion) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }

  const buffer = await generateCotizacionExcel(cotizacion);
  const cleanCode = cotizacion.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Cotizacion_${cleanCode}_${cotizacion.clientName.slice(0, 15).replace(/\s+/g, '_')}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

