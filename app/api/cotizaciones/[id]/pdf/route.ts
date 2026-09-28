import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getCotizacionById, getFormatoSettings, getUsers } from '@/lib/db';
import { generateCotizacionPdf } from '@/lib/pdf-generator';

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

  // Ensure valid signature from creator user profile if missing or placeholder
  const finalCotizacion = { ...cotizacion };
  if (!finalCotizacion.commercialSignature || finalCotizacion.commercialSignature.length < 200) {
    const allUsers = getUsers();
    const creatorUser = allUsers.find(
      (u) =>
        u.name === cotizacion.commercialName ||
        u.name === cotizacion.createdBy ||
        u.commercialInitials === cotizacion.commercialInitials ||
        u.id === currentUser.id
    );
    if (creatorUser?.signature && creatorUser.signature.length > 200) {
      finalCotizacion.commercialSignature = creatorUser.signature;
    }
  }

  const formato = getFormatoSettings();
  let logoBase64: string | undefined = formato.headerImage;
  if (!logoBase64) {
    const logoPath = path.join(process.cwd(), 'public', 'logo_125.png');
    if (fs.existsSync(logoPath)) {
      const raw = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${raw.toString('base64')}`;
    }
  }

  const isDraftParam = req.nextUrl.searchParams.get('draft');
  const isDraft = isDraftParam !== null ? isDraftParam === 'true' : finalCotizacion.status === 'Borrador';

  const showIndicatorsParam = req.nextUrl.searchParams.get('showIndicators');
  const showEconomicIndicators =
    showIndicatorsParam !== null
      ? showIndicatorsParam === 'true'
      : finalCotizacion.showEconomicIndicators !== false;

  const doc = generateCotizacionPdf(finalCotizacion, logoBase64, formato, {
    isDraft,
    showEconomicIndicators,
  });
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  const cleanCode = cotizacion.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = isDraft ? 'Borrador_Cotizacion_' : 'Cotizacion_';
  const filename = `${prefix}${cleanCode}_${(cotizacion.clientName || 'Cliente').slice(0, 15).replace(/\s+/g, '_')}.pdf`;

  const isInline =
    req.nextUrl.searchParams.get('inline') === 'true' ||
    req.nextUrl.searchParams.get('preview') === 'true';

  const disposition = isInline
    ? `inline; filename="${filename}"`
    : `attachment; filename="${filename}"`;

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': disposition,
    },
  });
}

