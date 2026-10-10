import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdminRole } from '@/lib/permissions';
import {
  parseLibroEerr,
  fetchLiveSalesforceCuotas,
  conciliarPeriodo,
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

    if (sampleData && Array.isArray((sampleData as any).eerrItems) && (sampleData as any).eerrItems.length > 0) {
      eerrItems = (sampleData as any).eerrItems;
      sfExcelItems = (sampleData as any).sfItems || [];
    } else {
      const defaultExcelPath = path.join(process.cwd(), 'Formato EERR.xlsx');
      if (fs.existsSync(defaultExcelPath)) {
        const parsed = await parseLibroEerr(defaultExcelPath);
        eerrItems = parsed.eerrItems;
        sfExcelItems = parsed.sfItems;
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
    const file = formData.get('file') as File | null;
    const mes = parseInt(String(formData.get('mes') || '1'), 10);
    const anio = parseInt(String(formData.get('anio') || '2026'), 10);
    const division = String(formData.get('division') || 'DGL');

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo Excel' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { eerrItems, sfItems } = await parseLibroEerr(buffer);

    const { items, resumen } = await conciliarPeriodo({
      eerrItems,
      sfItems,
      mes,
      anio,
      division,
      usarIaGemini: true,
    });

    return NextResponse.json({
      resumen,
      items,
      eerrItems: eerrItems.filter(
        (e) => e.mes === mes && e.anio === anio && (division === 'TODAS' || e.division === division)
      ),
      sfItems: sfItems.filter(
        (s) => s.mes === mes && s.anio === anio && (division === 'TODAS' || s.division === division)
      ),
      nombreArchivo: file.name,
    });
  } catch (err: any) {
    console.error('Error subiendo archivo a /api/conciliador/data:', err);
    return NextResponse.json(
      { error: err?.message || 'Error procesando el archivo Excel subido' },
      { status: 500 }
    );
  }
}

