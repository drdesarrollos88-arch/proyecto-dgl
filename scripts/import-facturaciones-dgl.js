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
  const match = String(text).match(/(PR\.[A-Z0-9\.\-_]+|DGL\.PRE\.[A-Z0-9\.\-_]+|PRE\.DGL\.[A-Z0-9\.\-_]+)/i);
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
  if (str.includes('TI') || str.includes('TRASPASO') || str.includes('TRAS INFORMAT')) return 'traspaso_interno';
  if (str.includes('PROV') && !str.includes('REV')) return 'provision';
  if (str.includes('REV')) return 'reversion';
  if (str.includes('FACT') || str.includes('BOL') || str.includes('CVI') || str.includes('ING FACT')) return 'facturacion';
  return 'otro';
}

async function run() {
  const filePath = path.join(process.cwd(), 'FACTURACIONES DGL.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log('Procesando FACTURACIONES DGL.xlsx...');

  // 1. Parsear Hoja1 (Detalle Transaccional EERR)
  const wsHoja1 = wb.getWorksheet('Hoja1');
  const eerrItemsDGL = [];
  if (wsHoja1) {
    const headerRow = wsHoja1.getRow(1);
    const colMap = {};
    headerRow.eachCell((c, col) => {
      let rawName = String(c.value || '').trim();
      colMap[rawName] = col;
      // Normalizar nombre quitando prefijo Resultado[...]
      const match = rawName.match(/Resultado\[(.*)\]/);
      if (match) {
        colMap[match[1].trim().toLowerCase()] = col;
      }
    });

    const colMonto = colMap['monto'] || 13;
    const colFecha = colMap['fecha'] || 3;
    const colPeriodo = colMap['periodo eerr'] || 5;
    const colCc = colMap['centro de costo'] || 6;
    const colRefExt = colMap['referencia externa'] || 7;
    const colRefInt = colMap['referencia interna'] || 8;
    const colGlosa = colMap['glosa/detalle'] || 12;
    const colRut = colMap['rut_id'] || 14;
    const colCta = colMap['cuenta contable'] || 15;
    const colDiv = colMap['div'] || 20;
    const colRazon = colMap['razón social'] || 22;
    const colComp = colMap['comprobante'] || 23;

    for (let r = 2; r <= wsHoja1.rowCount; r++) {
      const row = wsHoja1.getRow(r);
      const montoRaw = row.getCell(colMonto).value;
      if (montoRaw === null || montoRaw === undefined || montoRaw === '') continue;

      const montoClp = Number(montoRaw) || 0;
      const rawDate = row.getCell(colFecha).value;
      const { fechaIso, mes, anio } = parseExcelDate(rawDate);
      const compVal = String(row.getCell(colComp).value || '').trim();
      const divVal = String(row.getCell(colDiv).value || 'DGL').trim();
      const ccVal = String(row.getCell(colCc).value || '').trim();
      const rutVal = normalizeRut(row.getCell(colRut).value);
      const razonVal = String(row.getCell(colRazon).value || '').trim();
      const refIntVal = String(row.getCell(colRefInt).value || '').trim();
      const refExtVal = String(row.getCell(colRefExt).value || '').trim();
      const glosaVal = String(row.getCell(colGlosa).value || '').trim();
      const codExtracted = extractCodigoOportunidad(refIntVal) || extractCodigoOportunidad(glosaVal);

      eerrItemsDGL.push({
        id: `eerr-dgl-${r}-${Date.now()}`,
        division: divVal || 'DGL',
        seccion: '',
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
        clasificacion: '',
        tipoServicio: '',
        montoClp,
        montoUfAprox: Number((montoClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
      });
    }
  }

  console.log(`Registros extraídos de Hoja1: ${eerrItemsDGL.length}`);

  // 2. Parsear BBDD Gráficos (Control Consolidado por División)
  const wsGraf = wb.getWorksheet('BBDD Gráficos');
  const consolidadoDivisiones = {};
  if (wsGraf) {
    // Filas 24 a 38 tienen la tabla resumen por división
    for (let r = 24; r <= Math.min(38, wsGraf.rowCount); r++) {
      const row = wsGraf.getRow(r);
      const div = String(row.getCell(1).value || '').trim();
      if (!div || div === 'Total general') continue;

      const backlogSf = Number(row.getCell(2).result !== undefined ? row.getCell(2).result : row.getCell(2).value) || 0;
      const facturacionEerr = Number(row.getCell(3).result !== undefined ? row.getCell(3).result : row.getCell(3).value) || 0;
      const traspasosEerr = Number(row.getCell(4).result !== undefined ? row.getCell(4).result : row.getCell(4).value) || 0;
      const totalIngresosEerr = Number(row.getCell(5).result !== undefined ? row.getCell(5).result : row.getCell(5).value) || 0;
      const diferencia = Number(row.getCell(6).result !== undefined ? row.getCell(6).result : row.getCell(6).value) || 0;

      consolidadoDivisiones[div] = {
        division: div,
        backlogSalesforceClp: backlogSf,
        facturacionEerrClp: facturacionEerr,
        traspasosEerrClp: traspasosEerr,
        totalIngresosEerrClp: totalIngresosEerr,
        diferenciaClp: diferencia,
      };
    }
  }

  console.log('Consolidado de Divisiones extraído de BBDD Gráficos:', consolidadoDivisiones);

  // 3. Fusionar con data/conciliador-sample.json
  const samplePath = path.join(process.cwd(), 'data', 'conciliador-sample.json');
  let currentSample = { eerrItems: [], sfItems: [] };
  if (fs.existsSync(samplePath)) {
    try {
      currentSample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    } catch (e) {
      console.warn('Error leyendo current sample:', e);
    }
  }

  // Combinar los eerrItemsDGL asegurando que reemplacen o completen los existentes
  // Filtramos los de DGL enero 2026 existentes para no duplicar
  const existingOther = currentSample.eerrItems.filter(
    (item) => !(item.division === 'DGL' && item.mes === 1 && item.anio === 2026)
  );

  const mergedEerrItems = [...eerrItemsDGL, ...existingOther];
  const updatedData = {
    ...currentSample,
    eerrItems: mergedEerrItems,
    consolidadoDivisiones,
    ultimaActualizacion: new Date().toISOString(),
    fuenteArchivo: 'FACTURACIONES DGL.xlsx',
  };

  fs.writeFileSync(samplePath, JSON.stringify(updatedData, null, 2), 'utf8');
  console.log(`✓ Archivo ${samplePath} actualizado exitosamente:`);
  console.log(`- Total eerrItems: ${mergedEerrItems.length}`);
  console.log(`- Total sfItems: ${currentSample.sfItems.length}`);
  console.log(`- Divisiones en consolidado: ${Object.keys(consolidadoDivisiones).length}`);
}

run().catch(console.error);

