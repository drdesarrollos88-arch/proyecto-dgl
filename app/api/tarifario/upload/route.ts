import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getCurrentUser } from '@/lib/auth';
import { replaceTarifario } from '@/lib/db';
import { TarifarioItem } from '@/lib/types';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Solo administradores pueden cargar un nuevo archivo de tarifario.' },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return NextResponse.json({ error: 'El archivo Excel no contiene hojas de datos.' }, { status: 400 });
    }

    let currentCat = 'ENSAYOS GENERALES';
    let currentSubcat = '';
    const items: TarifarioItem[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return; // Skip header

      const codeVal = row.getCell(1).value;
      const desigVal = row.getCell(2).value;
      const normVal = row.getCell(3).value;
      const weightVal = row.getCell(4).value;
      const unitVal = row.getCell(5).value;
      const ufVal = row.getCell(6).value;
      const skuVal = row.getCell(9).value;
      const ccVal = row.getCell(10).value;

      const codeStr = codeVal !== null && codeVal !== undefined ? String(codeVal).trim() : '';
      const desigStr = desigVal !== null && desigVal !== undefined ? String(desigVal).trim() : '';

      if (!desigStr && !codeStr) return;

      // Header row check (no UF price)
      const numUf = typeof ufVal === 'number' ? ufVal : parseFloat(String(ufVal || ''));
      if (isNaN(numUf) || ufVal === null || ufVal === '') {
        if (['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].includes(codeStr) || desigStr.toUpperCase().includes('ENSAYOS')) {
          currentCat = codeStr ? `${codeStr} - ${desigStr}` : desigStr;
          currentSubcat = '';
        } else {
          currentSubcat = codeStr ? `${codeStr} ${desigStr}` : desigStr;
        }
        return;
      }

      items.push({
        id: `item-${items.length + 1}`,
        code: codeStr,
        category: currentCat,
        subcategory: currentSubcat || currentCat,
        designation: desigStr,
        norm: normVal !== null && normVal !== undefined ? String(normVal).trim() : '',
        minWeightKg: typeof weightVal === 'number' ? weightVal : (weightVal ? String(weightVal) : 0),
        unit: unitVal !== null && unitVal !== undefined ? String(unitVal).trim() : 'c/u',
        ufPrice: Math.round(numUf * 10000) / 10000,
        sku: skuVal !== null && skuVal !== undefined ? String(skuVal).trim() : '',
        cc: ccVal !== null && ccVal !== undefined ? String(ccVal).trim() : '',
        isOfficial: true,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.name,
      });
    });

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No se encontraron ensayos válidos en el archivo Excel.' },
        { status: 400 }
      );
    }

    replaceTarifario(items, currentUser.name);

    return NextResponse.json({
      success: true,
      count: items.length,
      message: `Tarifario oficial actualizado con éxito (${items.length} ensayos procesados).`,
    });
  } catch (err) {
    console.error('Error uploading tarifario Excel:', err);
    return NextResponse.json({ error: 'Error al procesar el archivo Excel.' }, { status: 500 });
  }
}

