import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { getTarifario } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { TarifarioItem } from '@/lib/types';

function sanitizeForExcel(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+@-]/i.test(str)) {
    return `'${str}`;
  }
  return str;
}

function populateWorksheet(worksheet: ExcelJS.Worksheet, items: TarifarioItem[]) {
  worksheet.views = [{ showGridLines: true }];

  worksheet.columns = [
    { header: 'Código', key: 'code', width: 12 },
    { header: 'Categoría', key: 'category', width: 32 },
    { header: 'Subcategoría', key: 'subcategory', width: 36 },
    { header: 'Designación', key: 'designation', width: 62 },
    { header: 'Norma o Procedimiento', key: 'norm', width: 48 },
    { header: 'Peso Material (kg)', key: 'minWeightKg', width: 20 },
    { header: 'Unidad', key: 'unit', width: 14 },
    { header: 'Valor UF Oficial', key: 'ufPrice', width: 18 },
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Centro Costo (CC)', key: 'cc', width: 32 },
    { header: 'Última Actualización', key: 'updatedAt', width: 22 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF004C87' }, // Corporate Dark Blue
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 30;

  // Add rows with sanitized strings
  items.forEach((item) => {
    const row = worksheet.addRow({
      code: sanitizeForExcel(item.code),
      category: sanitizeForExcel(item.category),
      subcategory: sanitizeForExcel(item.subcategory),
      designation: sanitizeForExcel(item.designation),
      norm: sanitizeForExcel(item.norm),
      minWeightKg: item.minWeightKg,
      unit: sanitizeForExcel(item.unit),
      ufPrice: item.ufPrice,
      sku: sanitizeForExcel(item.sku),
      cc: sanitizeForExcel(item.cc),
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('es-CL') : '',
    });

    row.getCell('ufPrice').numFmt = '#,##0.00 "UF"';
    row.alignment = { vertical: 'middle', wrapText: true };
  });
}

function buildExcelResponse(items: TarifarioItem[], separateSheets: boolean, titleHint?: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Laboratorio Geotécnico DGL';
  workbook.created = new Date();

  const distinctCcs = Array.from(new Set(items.map((it) => it.cc))).filter(Boolean);

  if (separateSheets && distinctCcs.length > 1) {
    // 1. General Sheet with all filtered items
    const generalSheet = workbook.addWorksheet('Todos los Ensayos');
    populateWorksheet(generalSheet, items);

    // 2. Individual sheet per Centro de Costo
    distinctCcs.forEach((ccName) => {
      const ccItems = items.filter((it) => it.cc === ccName);
      if (ccItems.length > 0) {
        const safeSheetName = ccName.slice(0, 30).replace(/[:\/\\?*\[\]]/g, '_');
        const sheet = workbook.addWorksheet(safeSheetName);
        populateWorksheet(sheet, ccItems);
      }
    });
  } else {
    // Single sheet
    const sheetName =
      distinctCcs.length === 1
        ? distinctCcs[0].slice(0, 30).replace(/[:\/\\?*\[\]]/g, '_')
        : 'Tarifado Oficial';
    const worksheet = workbook.addWorksheet(sheetName);
    populateWorksheet(worksheet, items);
  }

  let filenamePrefix = 'TARIFADO_OFICIAL_DGL';
  if (titleHint) {
    filenamePrefix = `TARIFADO_${titleHint}`;
  } else if (distinctCcs.length === 1) {
    filenamePrefix = `TARIFADO_${distinctCcs[0].split('-')[0].trim()}`;
  } else if (distinctCcs.length > 1 && distinctCcs.length <= 3) {
    filenamePrefix = `TARIFADO_${distinctCcs.map((c) => c.split('-')[0].trim()).join('_')}`;
  }

  const filename = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return workbook.xlsx.writeBuffer().then((buffer) => {
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  });
}

// GET handler (legacy and URL query parameter exports)
export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ccsParam = searchParams.get('ccs');
  const categoriesParam = searchParams.get('categories');
  const separateSheets = searchParams.get('separateSheets') === 'true';

  let items = getTarifario();

  const selectedCcs = ccsParam
    ? ccsParam.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean)
    : [];
  const selectedCategories = categoriesParam
    ? categoriesParam.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean)
    : [];

  if (selectedCcs.length > 0) {
    items = items.filter((it) => selectedCcs.includes(it.cc));
  }

  if (selectedCategories.length > 0) {
    items = items.filter((it) => selectedCategories.includes(it.category));
  }

  return buildExcelResponse(items, separateSheets);
}

// POST handler (advanced hierarchical granular selections)
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { selectedCombinations, separateSheets = false } = body;

    let items = getTarifario();

    if (Array.isArray(selectedCombinations) && selectedCombinations.length > 0) {
      items = items.filter((it) =>
        selectedCombinations.some((comb: { cc: string; category?: string; subcategory?: string }) => {
          if (comb.cc && comb.cc !== it.cc) return false;
          if (comb.category && comb.category !== it.category) return false;
          if (comb.subcategory && comb.subcategory !== it.subcategory) return false;
          return true;
        })
      );
    }

    return await buildExcelResponse(items, !!separateSheets, 'PERSONALIZADO');
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al exportar a Excel.' }, { status: 500 });
  }
}
