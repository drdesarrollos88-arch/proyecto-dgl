import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getCurrentUser } from '@/lib/auth';
import { getFormatoSettings, getUsers } from '@/lib/db';
import { getCotizacionByIdAsync } from '@/lib/cotizaciones-db';
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
  const cotizacion = await getCotizacionByIdAsync(id);

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
  const versionParam = req.nextUrl.searchParams.get('version');

  let targetCotizacion = { ...finalCotizacion };
  if (versionParam && Array.isArray(finalCotizacion.versionHistory) && finalCotizacion.versionHistory.length > 0) {
    const found = finalCotizacion.versionHistory.find(
      (v) =>
        String(v.versionNumber) === versionParam ||
        v.versionCode.toLowerCase() === versionParam.toLowerCase() ||
        v.versionCode.toLowerCase().endsWith(`-v${versionParam.toLowerCase()}`) ||
        v.versionCode.endsWith(`.${versionParam}`)
    );
    if (found) {
      targetCotizacion = {
        ...finalCotizacion,
        code: found.versionCode,
        items: found.items || finalCotizacion.items,
        totalUf: found.totalUf,
        totalClp: found.totalClp,
        totalUsd: found.totalUsd,
        totalWeightKg: found.totalWeightKg,
        observations: found.observations || finalCotizacion.observations,
        condicionesComerciales: found.condicionesComerciales || finalCotizacion.condicionesComerciales,
        showEconomicIndicators: found.showEconomicIndicators ?? finalCotizacion.showEconomicIndicators,
        ufValue: found.ufValue || finalCotizacion.ufValue,
        dollarValue: found.dollarValue || finalCotizacion.dollarValue,
        status: found.status || finalCotizacion.status,
      };
    }
  }

  const isDraft = isDraftParam !== null ? isDraftParam === 'true' : targetCotizacion.status === 'Borrador';

  const showIndicatorsParam = req.nextUrl.searchParams.get('showIndicators');
  const showEconomicIndicators =
    showIndicatorsParam !== null
      ? showIndicatorsParam === 'true'
      : targetCotizacion.showEconomicIndicators !== false;

  const doc = generateCotizacionPdf(targetCotizacion, logoBase64, formato, {
    isDraft,
    showEconomicIndicators,
  });
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  const cleanCode = targetCotizacion.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const prefix = isDraft ? 'Borrador_Cotizacion_' : 'Cotizacion_';
  const filename = `${prefix}${cleanCode}_${(targetCotizacion.clientName || 'Cliente').slice(0, 15).replace(/\s+/g, '_')}.pdf`;

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

