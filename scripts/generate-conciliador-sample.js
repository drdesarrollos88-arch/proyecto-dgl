const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

const UF_PROMEDIO_DEFAULT = 38500;

function normalizeRut(rut) {
  if (!rut) return '';
  return String(rut).replace(/[^0-9kK]/g, '').toUpperCase().trim();
}

function extractCodigoOportunidad(text) {
  if (!text) return undefined;
  const match = String(text).match(/(PR\.[A-Z0-9\.\-_]+)/i);
  return match ? match[1].toUpperCase() : undefined;
}

function parseExcelDate(val) {
  if (!val) {
    const now = new Date();
    return {
      fechaIso: now.toISOString().slice(0, 10),
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
    };
  }

  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number') {
    d = new Date((val - 25569) * 86400 * 1000);
  } else {
    d = new Date(String(val));
  }

  if (isNaN(d.getTime())) {
    d = new Date();
  }

  return {
    fechaIso: d.toISOString().slice(0, 10),
    mes: d.getUTCMonth() + 1,
    anio: d.getUTCFullYear(),
  };
}

function classifyComprobante(comprobante) {
  if (!comprobante) return 'facturacion';
  const str = String(comprobante).toUpperCase();
  if (str.includes('TI') || str.includes('TRASPASO')) return 'traspaso_interno';
  if (str.includes('PROV') && !str.includes('REV')) return 'provision';
  if (str.includes('REV')) return 'reversion';
  if (str.includes('FACT') || str.includes('BOL') || str.includes('CVI')) return 'facturacion';
  return 'otro';
}

async function run() {
  const filePath = path.join(process.cwd(), 'Formato EERR.xlsx');
  if (!fs.existsSync(filePath)) {
    console.error('No se encontró Formato EERR.xlsx');
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const eerrItems = [];
  const sfItems = [];

  const wsFact = workbook.getWorksheet('Reporte Facturación sin TI') || workbook.worksheets[0];
  if (wsFact) {
    let headerRowIdx = 1;
    for (let r = 1; r <= Math.min(10, wsFact.rowCount); r++) {
      const row = wsFact.getRow(r);
      let found = false;
      row.eachCell((c) => {
        const val = String(c.value || '').toLowerCase();
        if (val.includes('ingreso') || val.includes('rut') || val.includes('division')) {
          found = true;
        }
      });
      if (found) {
        headerRowIdx = r;
        break;
      }
    }

    const headerRow = wsFact.getRow(headerRowIdx);
    const colMap = {};
    headerRow.eachCell((c, col) => {
      colMap[String(c.value || '').trim()] = col;
    });

    const colDiv = colMap['siglaDivision'] || colMap['Division'] || 1;
    const colSec = colMap['siglaSeccion'] || colMap['Seccion'] || 2;
    const colCc = colMap['centroCosto'] || colMap['Centro de Costo'] || 3;
    const colDate = colMap['Date'] || colMap['Fecha'] || 4;
    const colComp = colMap['Comprobante'] || colMap['Tipo'] || 5;
    const colRut = colMap['RUT_Id'] || colMap['RUT'] || colMap['Rut Empresa'] || 6;
    const colRazon = colMap['Razón Social'] || colMap['Razon Social'] || colMap['Cliente'] || 7;
    const colRefInt = colMap['Referencia Interna'] || colMap['Proyecto'] || colMap['Glosa'] || 8;
    const colRefExt = colMap['Referencia Externa'] || colMap['N° Factura'] || colMap['Factura'] || 9;
    const colGlosa = colMap['Glosa/Detalle'] || colMap['Detalle'] || 10;
    const colCta = colMap['Cuenta Contable'] || 11;
    const colClasif = colMap['Clasificación'] || 12;
    const colServ = colMap['tipoServicio'] || 13;
    const colIngreso = colMap['Ingreso'] || colMap['Monto'] || colMap['Total'] || 14;

    for (let r = headerRowIdx + 1; r <= wsFact.rowCount; r++) {
      const row = wsFact.getRow(r);
      const ingresoRaw = row.getCell(colIngreso).value;
      if (ingresoRaw === null || ingresoRaw === undefined || ingresoRaw === '') continue;

      const montoClp = Number(ingresoRaw) || 0;
      if (montoClp === 0) continue;

      const divVal = String(row.getCell(colDiv).value || '').trim();
      const secVal = String(row.getCell(colSec).value || '').trim();
      const ccVal = String(row.getCell(colCc).value || '').trim();
      const rawDate = row.getCell(colDate).value;
      const { fechaIso, mes, anio } = parseExcelDate(rawDate);
      const compVal = String(row.getCell(colComp).value || '').trim();
      const rutVal = normalizeRut(row.getCell(colRut).value);
      const razonVal = String(row.getCell(colRazon).value || '').trim();
      const refIntVal = String(row.getCell(colRefInt).value || '').trim();
      const refExtVal = String(row.getCell(colRefExt).value || '').trim();
      const glosaVal = String(row.getCell(colGlosa).value || '').trim();

      const codExtracted = extractCodigoOportunidad(refIntVal) || extractCodigoOportunidad(glosaVal);

      eerrItems.push({
        id: `eerr-${r}`,
        division: divVal || 'DGL',
        seccion: secVal,
        centroCosto: ccVal,
        fecha: fechaIso,
        mes,
        anio,
        comprobante: compVal,
        tipo: classifyComprobante(compVal),
        rut: rutVal,
        razonSocial: razonVal,
        referenciaInterna: refIntVal,
        codigoOportunidadExtraido: codExtracted,
        referenciaExterna: refExtVal,
        glosa: glosaVal,
        cuentaContable: String(row.getCell(colCta).value || ''),
        clasificacion: String(row.getCell(colClasif).value || ''),
        tipoServicio: String(row.getCell(colServ).value || ''),
        montoClp,
        montoUfAprox: Number((montoClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
      });
    }
  }

  const wsSf = workbook.getWorksheet('Reporte Salesforce');
  if (wsSf) {
    const colMapSf = {};
    const headerRowSf = wsSf.getRow(1);
    headerRowSf.eachCell((c, col) => {
      colMapSf[String(c.value || '').trim()] = col;
    });

    const colRutSf = colMapSf['Rut Empresa'] || 1;
    const colCuentaSf = colMapSf['Nombre de la cuenta'] || 2;
    const colOppSf = colMapSf['Nombre de la oportunidad'] || 3;
    const colEtapaSf = colMapSf['Etapa'] || 4;
    const colMontoSf = colMapSf['Monto'] || 5;
    const colCuotaNumSf = colMapSf['Contador de cuotas'] || 6;
    const colUnidadSf = colMapSf['Unidad'] || 8;
    const colDivSf = colMapSf['División'] || 9;
    const colSecSf = colMapSf['Sección'] || 10;
    const colFechaPagoSf = colMapSf['Fecha de Pago'] || 12;
    const colTraspasoSf = colMapSf['Traspaso interno'] || 13;

    for (let r = 2; r <= wsSf.rowCount; r++) {
      const row = wsSf.getRow(r);
      const montoraw = row.getCell(colMontoSf).value;
      if (montoraw === null || montoraw === undefined || montoraw === '') continue;

      const montoClp = Number(montoraw) || 0;
      const rawDate = row.getCell(colFechaPagoSf).value;
      const { fechaIso, mes, anio } = parseExcelDate(rawDate);
      const oppName = String(row.getCell(colOppSf).value || '').trim();
      const divVal = String(row.getCell(colDivSf).value || '').trim();
      const rutVal = normalizeRut(row.getCell(colRutSf).value);
      const cuentaVal = String(row.getCell(colCuentaSf).value || '').trim();
      const traspasoVal = String(row.getCell(colTraspasoSf).value || '').toUpperCase();

      const codExtracted = extractCodigoOportunidad(oppName);

      sfItems.push({
        id: `sf-${r}`,
        opportunityName: oppName,
        codigoOportunidadExtraido: codExtracted,
        etapa: String(row.getCell(colEtapaSf).value || 'Cerrada ganada'),
        numeroCuota: Number(row.getCell(colCuotaNumSf).value) || 1,
        fechaPago: fechaIso,
        mes,
        anio,
        montoClp,
        montoUf: Number((montoClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
        rutEmpresa: rutVal,
        cuenta: cuentaVal,
        division: divVal || 'DGL',
        seccion: String(row.getCell(colSecSf).value || ''),
        unidad: String(row.getCell(colUnidadSf).value || ''),
        traspasoInterno: traspasoVal === 'VERDADERO' || traspasoVal === 'TRUE',
      });
    }
  }

  // Filtrar o guardar todo; para optimizar tamaño en Cloudflare (< 25MB bundle), guardamos todas las filas
  const outData = { eerrItems, sfItems };
  const outPath = path.join(process.cwd(), 'data', 'conciliador-sample.json');
  fs.writeFileSync(outPath, JSON.stringify(outData), 'utf8');

  console.log(`✓ Archivo generado exitosamente en ${outPath}:`);
  console.log(`- EERR total registros: ${eerrItems.length}`);
  console.log(`- Salesforce total cuotas: ${sfItems.length}`);
  console.log(`- Tamaño archivo: ${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)} MB`);
}

run().catch(console.error);

