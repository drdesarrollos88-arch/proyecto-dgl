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
  const isUsd = cotizacion.currency === 'USD';
  const isClp = cotizacion.currency === 'CLP';
  const currencyLabel = cotizacion.currency || 'UF';
  const ufVal = cotizacion.ufValue || 40879.04;
  const usdVal = cotizacion.dollarValue || 933.47;

  const headers = [
    { col: 'A', val: 'CODIGO ENSAYO' },
    { col: 'C', val: 'Item' },
    { col: 'D', val: 'Designación' },
    { col: 'G', val: 'Norma o Proced.' },
    { col: 'H', val: 'Cantidad Mín.\nMaterial (kg)' },
    { col: 'I', val: 'Unidad' },
    { col: 'J', val: `Precio\nUnitario (${currencyLabel})` },
    { col: 'K', val: 'Cantidad Ensayos\nEstimada' },
    { col: 'L', val: `Sub Total\n(${currencyLabel})` },
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

  const hasDividers = cotizacion.items.some((it) => it.isDivider);
  let rowIdx = 61;

  if (!hasDividers) {
    cotizacion.items.forEach((item, idx) => {
      const r = ws.getRow(rowIdx);
      r.getCell('A').value = sanitizeForExcel(item.code);
      r.getCell('C').value = `1.1.${idx + 1}`;
      r.getCell('D').value = sanitizeForExcel(item.designation);
      r.getCell('G').value = sanitizeForExcel(item.norm);
      r.getCell('H').value = item.minWeightKg ? Number(item.minWeightKg) || item.minWeightKg : '';
      r.getCell('I').value = sanitizeForExcel(item.unit);

      const unitPriceUf = Number(item.ufPrice) * Number(item.factor || 1);
      const qty = Number(item.quantity);
      const subtotalUf = unitPriceUf * qty;

      const unitPrice = isUsd
        ? (unitPriceUf * ufVal) / usdVal
        : isClp
        ? Math.round(unitPriceUf * ufVal)
        : unitPriceUf;

      const subtotal = isUsd
        ? (subtotalUf * ufVal) / usdVal
        : isClp
        ? Math.round(subtotalUf * ufVal)
        : subtotalUf;

      r.getCell('J').value = isClp ? unitPrice : Math.round(unitPrice * 100) / 100;
      r.getCell('J').numFmt = isClp ? '$#,##0' : '#,##0.00';

      r.getCell('K').value = qty;
      r.getCell('L').value = isClp ? subtotal : Math.round(subtotal * 100) / 100;
      r.getCell('L').numFmt = isClp ? '$#,##0' : '#,##0.00';

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
  } else {
    let dividerIndex = 0;
    let itemInDividerIndex = 0;
    let currentPartidaSubtotal = 0;
    let currentPartidaTitle = '';
    let currentPartidaNum = '';

    const pushPartidaSubtotalExcel = () => {
      if (currentPartidaNum && itemInDividerIndex > 0) {
        const subRow = ws.getRow(rowIdx);
        subRow.getCell('D').value = `Subtotal ${currentPartidaNum} (${currentPartidaTitle}):`;
        subRow.getCell('D').font = { bold: true, color: { argb: 'FF334155' } };
        subRow.getCell('D').alignment = { horizontal: 'right' };

        subRow.getCell('L').value = isClp
          ? Math.round(currentPartidaSubtotal)
          : Math.round(currentPartidaSubtotal * 100) / 100;
        subRow.getCell('L').font = { bold: true, color: { argb: 'FF004C87' } };
        subRow.getCell('L').numFmt = isClp ? '$#,##0' : '#,##0.00';

        ['C', 'D', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
          subRow.getCell(col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF1F5F9' },
          };
          subRow.getCell(col).border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          };
        });
        rowIdx++;
      }
    };

    cotizacion.items.forEach((item) => {
      if (item.isDivider) {
        pushPartidaSubtotalExcel();

        dividerIndex++;
        itemInDividerIndex = 0;
        currentPartidaSubtotal = 0;
        currentPartidaNum = `1.1.${dividerIndex}`;
        currentPartidaTitle = item.dividerTitle || item.designation || `Partida ${dividerIndex}`;

        const divRow = ws.getRow(rowIdx);
        divRow.getCell('C').value = currentPartidaNum;
        divRow.getCell('C').font = { bold: true, color: { argb: 'FF004C87' } };
        divRow.getCell('D').value = currentPartidaTitle.toUpperCase();
        divRow.getCell('D').font = { bold: true, color: { argb: 'FF004C87' } };

        ['C', 'D', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
          divRow.getCell(col).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' },
          };
          divRow.getCell(col).border = {
            top: { style: 'medium', color: { argb: 'FF004C87' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
          };
        });

        rowIdx++;
      } else {
        if (dividerIndex === 0) {
          dividerIndex = 1;
          currentPartidaNum = '1.1.1';
          currentPartidaTitle = 'Partida 1';
          const divRow = ws.getRow(rowIdx);
          divRow.getCell('C').value = '1.1.1';
          divRow.getCell('C').font = { bold: true, color: { argb: 'FF004C87' } };
          divRow.getCell('D').value = 'PARTIDA 1';
          divRow.getCell('D').font = { bold: true, color: { argb: 'FF004C87' } };
          ['C', 'D', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((col) => {
            divRow.getCell(col).fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFE2E8F0' },
            };
          });
          rowIdx++;
        }

        itemInDividerIndex++;
        const itemNum = `1.1.${dividerIndex}.${itemInDividerIndex}`;

        const r = ws.getRow(rowIdx);
        r.getCell('A').value = sanitizeForExcel(item.code);
        r.getCell('C').value = itemNum;
        r.getCell('D').value = sanitizeForExcel(item.designation);
        r.getCell('G').value = sanitizeForExcel(item.norm);
        r.getCell('H').value = item.minWeightKg ? Number(item.minWeightKg) || item.minWeightKg : '';
        r.getCell('I').value = sanitizeForExcel(item.unit);

        const unitPriceUf = Number(item.ufPrice) * Number(item.factor || 1);
        const qty = Number(item.quantity);
        const subtotalUf = unitPriceUf * qty;

        const unitPrice = isUsd
          ? (unitPriceUf * ufVal) / usdVal
          : isClp
          ? Math.round(unitPriceUf * ufVal)
          : unitPriceUf;

        const subtotal = isUsd
          ? (subtotalUf * ufVal) / usdVal
          : isClp
          ? Math.round(subtotalUf * ufVal)
          : subtotalUf;

        currentPartidaSubtotal += subtotal;

        r.getCell('J').value = isClp ? unitPrice : Math.round(unitPrice * 100) / 100;
        r.getCell('J').numFmt = isClp ? '$#,##0' : '#,##0.00';

        r.getCell('K').value = qty;
        r.getCell('L').value = isClp ? subtotal : Math.round(subtotal * 100) / 100;
        r.getCell('L').numFmt = isClp ? '$#,##0' : '#,##0.00';

        ['A', 'C', 'D', 'G', 'H', 'I', 'J', 'K', 'L'].forEach((c) => {
          r.getCell(c).border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
          };
        });

        rowIdx++;
      }
    });

    pushPartidaSubtotalExcel();
  }

  // Total Row
  const totalRow = ws.getRow(rowIdx);
  totalRow.getCell('C').value = 'Total Ensayos';
  totalRow.getCell('C').font = { bold: true };
  if (isClp) {
    totalRow.getCell('L').value = cotizacion.totalClp || Math.round((cotizacion.totalUf || 0) * ufVal);
    totalRow.getCell('L').numFmt = '$#,##0 "CLP"';
  } else if (isUsd) {
    totalRow.getCell('L').value = cotizacion.totalUsd ?? Math.round((((cotizacion.totalUf || 0) * ufVal) / usdVal) * 100) / 100;
    totalRow.getCell('L').numFmt = '#,##0.00 "USD"';
  } else {
    totalRow.getCell('L').value = cotizacion.totalUf || 0;
    totalRow.getCell('L').numFmt = '#,##0.00 "UF"';
  }
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

