import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdminRole } from '@/lib/permissions';
import {
  parseLibroEerr,
  fetchLiveSalesforceCuotas,
  conciliarPeriodo,
  detectPredominantPeriod,
} from '@/lib/conciliador-service';
import sampleData from '@/data/conciliador-sample.json';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // RESTRICCIÓN SOLICITADA: Solo visible por el administrador Soporte
  const isAuthorized =
    isSuperAdminRole(currentUser.role) || currentUser.profileId === 'superadmin';
  if (!isAuthorized) {
    return NextResponse.json(
      {
        error:
          'Acceso denegado: El módulo Conciliador está temporalmente restringido de forma exclusiva para el rol Administrador / Soporte.',
      },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const mes = parseInt(searchParams.get('mes') || '1', 10);
  const anio = parseInt(searchParams.get('anio') || '2026', 10);
  const division = searchParams.get('division') || 'DGL';
  const source = searchParams.get('source') || 'excel'; // 'excel' | 'salesforce_live'

  try {
    let eerrItems: any[] = [];
    let sfExcelItems: any[] = [];
    let consolidadoDivisiones: any = (sampleData as any)?.consolidadoDivisiones || {};

    if (sampleData && Array.isArray((sampleData as any).eerrItems) && (sampleData as any).eerrItems.length > 0) {
      eerrItems = (sampleData as any).eerrItems;
      sfExcelItems = (sampleData as any).sfItems || [];
    } else {
      const facturacionesDglPath = path.join(process.cwd(), 'FACTURACIONES DGL.xlsx');
      const defaultExcelPath = path.join(process.cwd(), 'Formato EERR.xlsx');
      const targetPath = fs.existsSync(facturacionesDglPath) ? facturacionesDglPath : defaultExcelPath;

      if (fs.existsSync(targetPath)) {
        const parsed = await parseLibroEerr(targetPath);
        eerrItems = parsed.eerrItems;
        sfExcelItems = parsed.sfItems;
        if (parsed.consolidadoDivisiones) consolidadoDivisiones = parsed.consolidadoDivisiones;
      } else {
        return NextResponse.json(
          { error: 'No se encontraron datos de EERR disponibles.' },
          { status: 404 }
        );
      }
    }

    let finalSfItems = sfExcelItems;
    let liveError: string | null = null;

    if (source === 'salesforce_live') {
      try {
        const liveItems = await fetchLiveSalesforceCuotas(mes, anio, division);
        if (liveItems.length > 0) {
          finalSfItems = liveItems;
        }
      } catch (sfErr: any) {
        console.warn('Fallo consultando Salesforce en vivo, usando datos de Excel:', sfErr);
        liveError = sfErr?.message || 'Error conectando con Salesforce API. Usando datos de respaldo.';
      }
    }

    const { items, resumen } = await conciliarPeriodo({
      eerrItems,
      sfItems: finalSfItems,
      mes,
      anio,
      division,
      usarIaGemini: true,
      consolidadoDivisiones,
    });

    // Detectar meses disponibles en el dataset
    const mesesConDatos = Array.from(new Set(eerrItems.map((e) => e.mes))).sort((a, b) => a - b);
    const divisionesConDatos = Array.from(new Set(eerrItems.map((e) => e.division))).sort();

    return NextResponse.json({
      resumen,
      items,
      eerrItems: eerrItems.filter(
        (e) => e.mes === mes && e.anio === anio && (division === 'TODAS' || e.division === division)
      ),
      sfItems: finalSfItems.filter(
        (s) => s.mes === mes && s.anio === anio && (division === 'TODAS' || s.division === division)
      ),
      mesesConDatos,
      divisionesConDatos,
      sourceUtilizado: source === 'salesforce_live' && !liveError ? 'salesforce_live' : 'excel',
      liveError,
    });
  } catch (err: any) {
    console.error('Error en /api/conciliador/data:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al procesar la conciliación' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const isAuthorized =
    isSuperAdminRole(currentUser.role) || currentUser.profileId === 'superadmin';
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Acceso denegado: Se requieren privilegios de Administrador / Soporte.' },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();

    // Soportar carga de hasta 2 archivos: fileEerr y fileSf (o file / files[])
    let fileEerr = (formData.get('fileEerr') || formData.get('file')) as File | null;
    let fileSf = (formData.get('fileSf') || formData.get('fileCuotas')) as File | null;
    const allFiles = formData.getAll('files') as File[];

    if (!fileEerr && allFiles.length > 0) {
      fileEerr = allFiles[0];
      if (allFiles.length > 1) {
        fileSf = allFiles[1];
      }
    }

    if (!fileEerr && !fileSf) {
      return NextResponse.json(
        { error: 'No se envió ningún archivo Excel para procesar.' },
        { status: 400 }
      );
    }

    let eerrItems: any[] = [];
    let sfItems: any[] = [];
    let consolidadoDivisiones: any = undefined;
    let nombreArchivoEerr: string | undefined = undefined;
    let nombreArchivoSf: string | undefined = undefined;

    // 1. Procesar primer archivo (EERR o combinado)
    if (fileEerr) {
      const buf1 = Buffer.from(await fileEerr.arrayBuffer());
      const p1 = await parseLibroEerr(buf1);

      if (p1.eerrItems.length > 0) {
        eerrItems = p1.eerrItems;
        nombreArchivoEerr = fileEerr.name;
        if (p1.consolidadoDivisiones) consolidadoDivisiones = p1.consolidadoDivisiones;
      }

      if (p1.sfItems.length > 0) {
        sfItems = p1.sfItems;
        if (!nombreArchivoSf) nombreArchivoSf = fileEerr.name;
      }

      // Si el archivo 1 sólo traía cuotas de Salesforce sin EERR
      if (p1.eerrItems.length === 0 && p1.sfItems.length > 0) {
        sfItems = p1.sfItems;
        nombreArchivoSf = fileEerr.name;
        nombreArchivoEerr = undefined;
      }
    }

    // 2. Procesar segundo archivo si fue provisto
    if (fileSf) {
      const buf2 = Buffer.from(await fileSf.arrayBuffer());
      const p2 = await parseLibroEerr(buf2);

      if (p2.sfItems.length > 0) {
        sfItems = p2.sfItems;
        nombreArchivoSf = fileSf.name;
      }

      if (p2.eerrItems.length > 0 && eerrItems.length === 0) {
        eerrItems = p2.eerrItems;
        nombreArchivoEerr = fileSf.name;
        if (p2.consolidadoDivisiones) consolidadoDivisiones = p2.consolidadoDivisiones;
      }
    }

    // 3. Detección automática del período predominante en los datos
    const periodoEerr = detectPredominantPeriod(eerrItems);
    const periodoSf = detectPredominantPeriod(sfItems);

    const MESES_NOMBRES = [
      '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    let mesFinal = 1;
    let anioFinal = 2026;
    let coincidePeriodo = true;
    let mensajePeriodo = '';

    if (periodoEerr && periodoSf) {
      const sfTieneMes = periodoSf.meses.includes(periodoEerr.mes);
      const sfTieneAnio = periodoSf.anios.includes(periodoEerr.anio);

      if (sfTieneMes && sfTieneAnio) {
        mesFinal = periodoEerr.mes;
        anioFinal = periodoEerr.anio;
        coincidePeriodo = true;
        mensajePeriodo = `✅ Período detectado: ${MESES_NOMBRES[mesFinal]} ${anioFinal}. Coincide en ambos documentos (${nombreArchivoEerr || 'EERR'} y ${nombreArchivoSf || 'Cuotas'}).`;
      } else {
        mesFinal = periodoEerr.mes;
        anioFinal = periodoEerr.anio;
        coincidePeriodo = false;
        mensajePeriodo = `⚠️ Discrepancia de período: El archivo EERR corresponde a ${MESES_NOMBRES[periodoEerr.mes]} ${periodoEerr.anio}, pero el de Cuotas corresponde a ${MESES_NOMBRES[periodoSf.mes]} ${periodoSf.anio}.`;
      }
    } else if (periodoEerr) {
      mesFinal = periodoEerr.mes;
      anioFinal = periodoEerr.anio;
      coincidePeriodo = true;
      mensajePeriodo = `✅ Período detectado en EERR: ${MESES_NOMBRES[mesFinal]} ${anioFinal} (${nombreArchivoEerr}). Cuotas de Salesforce asociadas para el mismo mes.`;

      if (sfItems.length === 0 && sampleData && Array.isArray((sampleData as any).sfItems)) {
        sfItems = (sampleData as any).sfItems;
      }
    } else if (periodoSf) {
      mesFinal = periodoSf.mes;
      anioFinal = periodoSf.anio;
      coincidePeriodo = true;
      mensajePeriodo = `✅ Período detectado en Cuotas Salesforce: ${MESES_NOMBRES[mesFinal]} ${anioFinal} (${nombreArchivoSf}). EERR asociado para el mismo mes.`;

      if (eerrItems.length === 0 && sampleData && Array.isArray((sampleData as any).eerrItems)) {
        eerrItems = (sampleData as any).eerrItems;
      }
    } else {
      mesFinal = parseInt(String(formData.get('mes') || '1'), 10);
      anioFinal = parseInt(String(formData.get('anio') || '2026'), 10);
      mensajePeriodo = `Período seleccionado: ${MESES_NOMBRES[mesFinal]} ${anioFinal}.`;
    }

    const divisionParam = String(formData.get('division') || 'DGL');
    const divisionesEnEerr = Array.from(new Set(eerrItems.map((e) => e.division).filter(Boolean)));
    const divisionFinal =
      divisionParam === 'TODAS'
        ? 'TODAS'
        : divisionesEnEerr.length === 1
        ? divisionesEnEerr[0]
        : divisionParam;

    const { items, resumen } = await conciliarPeriodo({
      eerrItems,
      sfItems,
      mes: mesFinal,
      anio: anioFinal,
      division: divisionFinal,
      usarIaGemini: true,
      consolidadoDivisiones: consolidadoDivisiones || (sampleData as any)?.consolidadoDivisiones,
    });

    const mesesConDatos = Array.from(new Set(eerrItems.map((e) => e.mes).filter(Boolean))).sort((a, b) => a - b);
    const divisionesConDatos = Array.from(new Set(eerrItems.map((e) => e.division).filter(Boolean))).sort();

    return NextResponse.json({
      success: true,
      mesDetectado: mesFinal,
      anioDetectado: anioFinal,
      divisionDetectada: divisionFinal,
      coincidePeriodo,
      mensajePeriodo,
      nombreArchivoEerr,
      nombreArchivoSf,
      resumen,
      items,
      eerrItems: eerrItems.filter(
        (e) => e.mes === mesFinal && e.anio === anioFinal && (divisionFinal === 'TODAS' || e.division === divisionFinal)
      ),
      sfItems: sfItems.filter(
        (s) => s.mes === mesFinal && s.anio === anioFinal && (divisionFinal === 'TODAS' || s.division === divisionFinal)
      ),
      allEerrItems: eerrItems,
      allSfItems: sfItems,
      mesesConDatos,
      divisionesConDatos,
    });
  } catch (err: any) {
    console.error('Error subiendo archivos a /api/conciliador/data:', err);
    return NextResponse.json(
      { error: err?.message || 'Error procesando los archivos Excel subidos' },
      { status: 500 }
    );
  }
}

