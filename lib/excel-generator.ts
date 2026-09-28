import ExcelJS from 'exceljs';
import { Cotizacion } from './types';

function sanitizeForExcel(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+@-]/i.test(str)) {
    return `'${str}`;
  }
  return str;
}

export async function generateCotizacionExcel(cotizacion: Cotizacion): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Laboratorio Geotécnico DGL';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('PRESUPUESTO', {
    views: [{ showGridLines: true }],
  });

  // Set column widths
  ws.columns = [
    { width: 14 }, // A: CODIGO
    { width: 4 },  // B: space
    { width: 10 }, // C: Item
    { width: 48 }, // D: Designacion
    { width: 4 },  // E: space
    { width: 30 }, // F: Contact info / values
    { width: 32 }, // G: Norma
    { width: 18 }, // H: Cant Min kg
    { width: 12 }, // I: Unidad
    { width: 16 }, // J: Precio Unitario UF
    { width: 14 }, // K: Cantidad Ensayos
    { width: 18 }, // L: Subtotal UF
    { width: 4 },  // M: space
    { width: 16 }, // N: Label UF
    { width: 16 }, // O: Valor UF
  ];

  // Header Code and Date
  ws.getCell('H7').value = cotizacion.code || 'PR.DGL.CCCC.2026.XXXX';
  ws.getCell('H7').font = { bold: true, size: 11 };
  ws.getCell('G8').value = cotizacion.date ? new Date(cotizacion.date).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');

  // Client Details
  ws.getCell('D12').value = 'Señores';
  ws.getCell('D13').value = cotizacion.clientName || 'RAZON SOCIAL';
  ws.getCell('D13').font = { bold: true, size: 11 };
  ws.getCell('D14').value = `Rut: ${cotizacion.clientRut || '---'}`;
  ws.getCell('D15').value = 'Presente';

  ws.getCell('D17').value = 'Atención';
  ws.getCell('E17').value = ':';
  ws.getCell('F17').value = cotizacion.clientAttention || '---';

  ws.getCell('D19').value = 'N° Teléfono Móvil';
  ws.getCell('E19').value = ':';
  ws.getCell('F19').value = cotizacion.clientPhone || '---';

  ws.getCell('D21').value = 'E-Mail';
  ws.getCell('E21').value = ':';
  ws.getCell('F21').value = cotizacion.clientEmail || '---';

  ws.getCell('D23').value = 'Referencia';
  ws.getCell('E23').value = ':';
  ws.getCell('F23').value = cotizacion.reference || 'Ensayos Geotécnicos';

  ws.getCell('D25').value = 'Nombre Obra/Proyecto';
  ws.getCell('E25').value = ':';
  ws.getCell('F25').value = cotizacion.projectName || '---';

  // Letter body
  ws.getCell('D28').value = 'De nuestra consideración:';
  ws.getCell('D30').value = 'Adjunto a la presente, presupuesto solicitado por ensayos de la referencia';
  ws.getCell('D33').value = 'Quedando atento a aclarar cualquier consulta relacionada con la presente información,';
  ws.getCell('D35').value = 'Saluda atentamente a Ud.,';

  ws.getCell('H44').value = cotizacion.commercialName || 'Diego Román Araneda';
  ws.getCell('H44').font = { bold: true };
  ws.getCell('H45').value = cotizacion.commercialTitle || 'Analista Comercial';
  ws.getCell('H46').value = 'División Geotecnia Laboratorio';
  ws.getCell('H47').value = 'IDIEM - Universidad de Chile';

  // UF and Dolar values
  ws.getCell('N53').value = 'Valor UF';
  ws.getCell('O53').value = cotizacion.ufValue || 40879.04;
  ws.getCell('O53').numFmt = '$#,##0.00';

  ws.getCell('N54').value = 'Valor Dólar';
  ws.getCell('O54').value = cotizacion.dollarValue || 933.47;
  ws.getCell('O54').numFmt = '$#,##0.00';

  ws.getCell('D55').value = cotizacion.commercialInitials || 'PCM/DRA';

  // Title
  ws.getCell('C57').value = 'PRESUPUESTO ENSAYOS DE LABORATORIO';
  ws.getCell('C57').font = { bold: true, size: 12, color: { argb: 'FF004C87' } };

  // Table Headers (Row 59)
  const headers = [
    { col: 'A', val: 'CODIGO ENSAYO' },
    { col: 'C', val: 'Item' },
    { col: 'D', val: 'Designación' },
    { col: 'G', val: 'Norma o Proced.' },
    { col: 'H', val: 'Cantidad Mín.\nMaterial (kg)' },
    { col: 'I', val: 'Unidad' },
    { col: 'J', val: 'Precio\nUnitario (UF)' },
    { col: 'K', val: 'Cantidad Ensayos\nEstimada' },
    { col: 'L', val: 'Sub Total\n(UF)' },
  ];

  headers.forEach((h) => {
    const cell = ws.getCell(`${h.col}59`);
    cell.value = h.val;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF004C87' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  ws.getRow(59).height = 30;

  // Section Header
  ws.getCell('C60').value = '1.1';
  ws.getCell('D60').value = 'Valores de ensayos de laboratorio';
  ws.getCell('D60').font = { bold: true };

  // Items rows
  let rowIdx = 61;
  cotizacion.items.forEach((item, idx) => {
    const r = ws.getRow(rowIdx);
    r.getCell('A').value = sanitizeForExcel(item.code);
    r.getCell('C').value = `1.1.${idx + 1}`;
    r.getCell('D').value = sanitizeForExcel(item.designation);
    r.getCell('G').value = sanitizeForExcel(item.norm);
    r.getCell('H').value = item.minWeightKg ? Number(item.minWeightKg) || item.minWeightKg : '';
    r.getCell('I').value = sanitizeForExcel(item.unit);

    const unitPrice = Number(item.ufPrice) * Number(item.factor || 1);
    r.getCell('J').value = Math.round(unitPrice * 100) / 100;
    r.getCell('J').numFmt = '#,##0.00';

    r.getCell('K').value = Number(item.quantity);
    r.getCell('L').value = Math.round(unitPrice * Number(item.quantity) * 100) / 100;
    r.getCell('L').numFmt = '#,##0.00';

    // Thin borders
    ['A', 'C', 'D', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((c) => {
      r.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
      };
    });

    rowIdx++;
  });

  // Total Row
  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell('C').value = 'Total Ensayos';
  totalRow.getCell('C').font = { bold: true };
  totalRow.getCell('L').value = cotizacion.totalUf || 0;
  totalRow.getCell('L').numFmt = '#,##0.00 "UF"';
  totalRow.getCell('L').font = { bold: true, color: { argb: 'FF004C87' } };
  rowIdx += 2;

  // Observations
  ws.getCell(`C${rowIdx}`).value = '1.2';
  ws.getCell(`D${rowIdx}`).value = 'Observaciones de ensayos de Geotécnia';
  ws.getCell(`D${rowIdx}`).font = { bold: true };
  rowIdx++;

  ws.getCell(`C${rowIdx}`).value = '1.2.1';
  ws.getCell(`D${rowIdx}`).value =
    'Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de su recepción.';
  rowIdx++;

  ws.getCell(`C${rowIdx}`).value = '1.2.2';
  ws.getCell(`D${rowIdx}`).value =
    'La presente propuesta esta generada a carácter informativo. La determinación de ensayo y sus cantidades dependerá de la estimación del cliente, a lo cual, la propuesta deberá ser ajustada a dicho detalle de ensayo.';
  rowIdx++;

  ws.getCell(`C${rowIdx}`).value = '1.2.3';
  ws.getCell(`D${rowIdx}`).value =
    '(*) Los ensayos realizados bajo esta normativa no cuentan con acreditación bajo el alcance LE304';
  rowIdx++;

  ws.getCell(`C${rowIdx}`).value =
    'El laboratorio tiene la capacidad y recursos para realizar las actividades?   [X] SI    [ ] NO';
  ws.getCell(`C${rowIdx}`).font = { bold: true };

  return workbook.xlsx.writeBuffer();
}

