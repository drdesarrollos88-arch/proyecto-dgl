import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import {
  EerrRegistro,
  SalesforceCuotaRegistro,
  ConciliacionItem,
  ConciliacionResumen,
  TipoComprobanteEerr,
} from './conciliador-types';
import { getValidSalesforceClient } from './salesforce/salesforce-client';
import { sfRequest } from './salesforce/salesforce-sync-service';
import { GoogleGenAI } from '@google/genai';

const UF_PROMEDIO_DEFAULT = 38500;

export function normalizeRut(rut: any): string {
  if (!rut) return '';
  return String(rut)
    .replace(/[^0-9kK]/g, '')
    .toUpperCase()
    .trim();
}

export function extractCodigoOportunidad(text: any): string | undefined {
  if (!text) return undefined;
  const str = String(text);
  // Patrones típicos de IDIEM / DGL
  // ej: PR.DGL.2340.2025.0715, DGL.PRE.2340.2025.0486, PR.DHI.SHI.2026-0777
  const match = str.match(/([A-Z0-9]{2,4}\.[A-Z0-9]{2,4}\.[0-9A-Z\.-]{4,20})/i);
  if (match) return match[1].trim();

  const matchAlt = str.match(/(DGL\.[A-Z0-9\.-]{6,25})/i);
  if (matchAlt) return matchAlt[1].trim();

  return undefined;
}

export function parseExcelDate(val: any): { fechaIso: string; mes: number; anio: number } {
  if (!val) {
    const now = new Date();
    return {
      fechaIso: now.toISOString().slice(0, 10),
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
    };
  }

  let d: Date;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number') {
    // Excel serial date format
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

export function classifyComprobante(comprobante: any): TipoComprobanteEerr {
  if (!comprobante) return 'facturacion';
  const str = String(comprobante).toUpperCase();
  if (str.includes('TI') || str.includes('TRASPASO')) return 'traspaso_interno';
  if (str.includes('PROV') && !str.includes('REV')) return 'provision';
  if (str.includes('REV')) return 'reversion';
  if (str.includes('FACT') || str.includes('BOL') || str.includes('CVI')) return 'facturacion';
  return 'otro';
}

/**
 * Lee y extrae los datos del libro Excel (ya sea un buffer en memoria o el archivo del servidor).
 */
export async function parseLibroEerr(
  input: Buffer | string
): Promise<{ eerrItems: EerrRegistro[]; sfItems: SalesforceCuotaRegistro[] }> {
  const workbook = new ExcelJS.Workbook();

  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input as any);
  } else {
    const fullPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`No se encontró el archivo Excel en la ruta: ${fullPath}`);
    }
    await workbook.xlsx.readFile(fullPath);
  }

  const eerrItems: EerrRegistro[] = [];
  const sfItems: SalesforceCuotaRegistro[] = [];

  // 1. Parsear Hoja de Facturación EERR ('Reporte Facturación sin TI' o búsqueda dinámica)
  let wsFact = workbook.getWorksheet('Reporte Facturación sin TI');
  if (!wsFact) {
    // Buscar hoja que tenga 'facturacion' o 'eerr'
    wsFact = workbook.worksheets.find((w) =>
      /facturaci[oó]n|eerr/i.test(w.name)
    ) || workbook.worksheets[0];
  }

  if (wsFact) {
    // Localizar fila de encabezados (buscar fila que contenga 'siglaDivision' o 'RUT' o 'Ingreso')
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
    const colMap: Record<string, number> = {};
    headerRow.eachCell((c, col) => {
      const clean = String(c.value || '').trim();
      colMap[clean] = col;
    });

    // Mapeo flexible de columnas
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
        id: `eerr-${r}-${Date.now()}`,
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

  // 2. Parsear Hoja de Salesforce si está presente en el libro
  const wsSf = workbook.getWorksheet('Reporte Salesforce');
  if (wsSf) {
    const colMapSf: Record<string, number> = {};
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
        id: `sf-${r}-${Date.now()}`,
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

  return { eerrItems, sfItems };
}

/**
 * Consulta en vivo las Cuotas de Facturación de Salesforce vía SOQL.
 */
export async function fetchLiveSalesforceCuotas(
  mes: number,
  anio: number,
  division = 'DGL'
): Promise<SalesforceCuotaRegistro[]> {
  const { accessToken, instanceUrl } = await getValidSalesforceClient();

  // Rango de fechas del mes seleccionado
  const startDay = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const lastDayOfMonth = new Date(anio, mes, 0).getDate();
  const endDay = `${anio}-${String(mes).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

  const soql = encodeURIComponent(
    `SELECT Id, Name, Numero_de_cuota__c, Fecha_de_Pago__c, Monto__c, Oportunidad__c, Oportunidad__r.Name, Oportunidad__r.StageName, Oportunidad__r.Account.Name, Oportunidad__r.Account.Rut__c FROM Cuota_de_facturacion__c WHERE Fecha_de_Pago__c >= ${startDay} AND Fecha_de_Pago__c <= ${endDay} ORDER BY Fecha_de_Pago__c ASC LIMIT 500`
  );

  const res = await sfRequest(instanceUrl, accessToken, `query?q=${soql}`);
  const records = res?.records || [];

  return records.map((rec: any, idx: number) => {
    const oppName = rec.Oportunidad__r?.Name || 'Oportunidad sin nombre';
    const montoClp = Number(rec.Monto__c) || 0;
    const { fechaIso } = parseExcelDate(rec.Fecha_de_Pago__c);

    return {
      id: rec.Id || `live-sf-${idx}`,
      opportunityId: rec.Oportunidad__c,
      opportunityName: oppName,
      codigoOportunidadExtraido: extractCodigoOportunidad(oppName),
      etapa: rec.Oportunidad__r?.StageName || 'Cerrada ganada',
      numeroCuota: Number(rec.Numero_de_cuota__c) || 1,
      fechaPago: fechaIso,
      mes,
      anio,
      montoClp,
      montoUf: Number((montoClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
      rutEmpresa: normalizeRut(rec.Oportunidad__r?.Account?.Rut__c),
      cuenta: rec.Oportunidad__r?.Account?.Name || '',
      division,
      traspasoInterno: false,
    };
  });
}

/**
 * Motor Central de Conciliación Determinístico + IA Heurística
 */
export async function conciliarPeriodo(params: {
  eerrItems: EerrRegistro[];
  sfItems: SalesforceCuotaRegistro[];
  mes: number;
  anio: number;
  division?: string;
  usarIaGemini?: boolean;
}): Promise<{ items: ConciliacionItem[]; resumen: ConciliacionResumen }> {
  const { eerrItems, sfItems, mes, anio, division = 'DGL', usarIaGemini = true } = params;

  // 1. Filtrar registros para el mes, año y división seleccionada
  const filteredEerr = eerrItems.filter(
    (e) =>
      e.mes === mes &&
      e.anio === anio &&
      (!division || division === 'TODAS' || e.division.toUpperCase() === division.toUpperCase())
  );

  const filteredSf = sfItems.filter(
    (s) =>
      s.mes === mes &&
      s.anio === anio &&
      (!division || division === 'TODAS' || s.division.toUpperCase() === division.toUpperCase())
  );

  const conciliados: ConciliacionItem[] = [];
  const eerrUsados = new Set<string>();
  const sfUsados = new Set<string>();

  // PASO 1: Cruce Exacto por Código de Oportunidad Extraído (ej: PR.DGL.2340...)
  for (const e of filteredEerr) {
    if (!e.codigoOportunidadExtraido) continue;

    const sfMatch = filteredSf.find(
      (s) =>
        !sfUsados.has(s.id) &&
        s.codigoOportunidadExtraido &&
        s.codigoOportunidadExtraido.toUpperCase() === e.codigoOportunidadExtraido!.toUpperCase()
    );

    if (sfMatch) {
      eerrUsados.add(e.id);
      sfUsados.add(sfMatch.id);

      const difClp = e.montoClp - sfMatch.montoClp;
      const difUf = Number((difClp / UF_PROMEDIO_DEFAULT).toFixed(2));
      const esMatchExacto = Math.abs(difClp) <= 2000; // Tolerancia de 2000 CLP por redondeos

      conciliados.push({
        id: `match-cod-${e.id}-${sfMatch.id}`,
        estado: esMatchExacto ? 'conciliado' : 'diferencia_monto',
        eerr: e,
        cuota: sfMatch,
        diferenciaClp: difClp,
        diferenciaUf: difUf,
        criterioMatch: 'codigo_exacto',
        accionSugerida: esMatchExacto ? 'aceptar_match' : 'ajustar_cuota',
        nuevoMontoClp: e.montoClp,
      });
    }
  }

  // PASO 2: Cruce por RUT de Empresa + Monto Similar en el Mismo Mes
  for (const e of filteredEerr) {
    if (eerrUsados.has(e.id) || !e.rut) continue;

    const sfMatch = filteredSf.find((s) => {
      if (sfUsados.has(s.id) || !s.rutEmpresa) return false;
      const mismoRut = s.rutEmpresa === e.rut;
      if (!mismoRut) return false;
      // Monto con diferencia menor al 5% o exacta
      const diffPct = Math.abs(s.montoClp - e.montoClp) / Math.max(s.montoClp, 1);
      return diffPct <= 0.05;
    });

    if (sfMatch) {
      eerrUsados.add(e.id);
      sfUsados.add(sfMatch.id);

      const difClp = e.montoClp - sfMatch.montoClp;
      const difUf = Number((difClp / UF_PROMEDIO_DEFAULT).toFixed(2));
      const esMatchExacto = Math.abs(difClp) <= 2000;

      conciliados.push({
        id: `match-rut-monto-${e.id}-${sfMatch.id}`,
        estado: esMatchExacto ? 'conciliado' : 'diferencia_monto',
        eerr: e,
        cuota: sfMatch,
        diferenciaClp: difClp,
        diferenciaUf: difUf,
        criterioMatch: 'rut_monto',
        confianzaIa: 90,
        explicacionIa: `Coincide por RUT (${e.rut}) y monto similar entre EERR y cuota programada.`,
        accionSugerida: esMatchExacto ? 'aceptar_match' : 'ajustar_cuota',
        nuevoMontoClp: e.montoClp,
      });
    }
  }

  // PASO 3: Detección de Desfase Temporal (cuotas programadas en mes anterior o siguiente pero facturadas aquí)
  const remainingEerr = filteredEerr.filter((e) => !eerrUsados.has(e.id));
  const otherMonthSf = sfItems.filter(
    (s) =>
      !sfUsados.has(s.id) &&
      (s.mes === mes - 1 || s.mes === mes + 1) &&
      s.anio === anio &&
      (!division || division === 'TODAS' || s.division.toUpperCase() === division.toUpperCase())
  );

  for (const e of remainingEerr) {
    if (eerrUsados.has(e.id)) continue;

    const sfMatchDesfase = otherMonthSf.find((s) => {
      if (sfUsados.has(s.id)) return false;
      if (e.codigoOportunidadExtraido && s.codigoOportunidadExtraido) {
        return e.codigoOportunidadExtraido.toUpperCase() === s.codigoOportunidadExtraido.toUpperCase();
      }
      return e.rut && s.rutEmpresa && e.rut === s.rutEmpresa && Math.abs(e.montoClp - s.montoClp) <= 50000;
    });

    if (sfMatchDesfase) {
      eerrUsados.add(e.id);
      sfUsados.add(sfMatchDesfase.id);

      const difClp = e.montoClp - sfMatchDesfase.montoClp;
      const difUf = Number((difClp / UF_PROMEDIO_DEFAULT).toFixed(2));

      conciliados.push({
        id: `match-desfase-${e.id}-${sfMatchDesfase.id}`,
        estado: 'desfase_temporal',
        eerr: e,
        cuota: sfMatchDesfase,
        diferenciaClp: difClp,
        diferenciaUf: difUf,
        criterioMatch: 'ia_semantico',
        confianzaIa: 88,
        explicacionIa: `La cuota estaba programada para el mes ${sfMatchDesfase.mes}/${sfMatchDesfase.anio}, pero fue efectivamente facturada en este mes (${mes}/${anio}).`,
        accionSugerida: 'mover_cuota',
        nuevoMontoClp: e.montoClp,
      });
    }
  }

  // PASO 4: IA Heurística Gemini para Ítems Restantes Complejos (opcional pero muy potente)
  const unmappedEerr = filteredEerr.filter((e) => !eerrUsados.has(e.id));
  const unmappedSf = filteredSf.filter((s) => !sfUsados.has(s.id));

  if (usarIaGemini && unmappedEerr.length > 0 && unmappedSf.length > 0) {
    try {
      const apiKey =
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        process.env.GOOGLE_GENAI_API_KEY?.trim();

      if (apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        const promptText = `Eres un auditor contable-comercial senior de IDIEM / DGL especializado en conciliar EERR contra Salesforce.
Tienes dos listas de registros que no pudieron cruzarse automáticamente:

LISTA 1: FACTURAS/INGRESOS EN EERR (sin emparejar):
${JSON.stringify(
  unmappedEerr.slice(0, 10).map((e) => ({
    id: e.id,
    rut: e.rut,
    razonSocial: e.razonSocial,
    referenciaInterna: e.referenciaInterna,
    montoClp: e.montoClp,
    glosa: e.glosa,
  }))
)}

LISTA 2: CUOTAS EN SALESFORCE (sin emparejar):
${JSON.stringify(
  unmappedSf.slice(0, 10).map((s) => ({
    id: s.id,
    cuenta: s.cuenta,
    rut: s.rutEmpresa,
    oportunidad: s.opportunityName,
    montoClp: s.montoClp,
  }))
)}

Determina si alguna factura de la LISTA 1 corresponde a alguna cuota de la LISTA 2 por similitud semántica de razón social, proyecto o monto.
Responde ÚNICAMENTE en JSON con este formato exacto:
[
  {
    "eerrId": "string",
    "sfId": "string",
    "confianza": 85,
    "explicacion": "Razón clara en 1 frase de por qué corresponden"
  }
]`;

        const aiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
        });

        const rawJson = (aiRes.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(rawJson);

        if (Array.isArray(suggestions)) {
          for (const sug of suggestions) {
            if (sug?.eerrId && sug?.sfId && sug.confianza >= 70) {
              const matchedE = unmappedEerr.find((e) => e.id === sug.eerrId && !eerrUsados.has(e.id));
              const matchedS = unmappedSf.find((s) => s.id === sug.sfId && !sfUsados.has(s.id));

              if (matchedE && matchedS) {
                eerrUsados.add(matchedE.id);
                sfUsados.add(matchedS.id);

                const difClp = matchedE.montoClp - matchedS.montoClp;
                const difUf = Number((difClp / UF_PROMEDIO_DEFAULT).toFixed(2));

                conciliados.push({
                  id: `match-ia-${matchedE.id}-${matchedS.id}`,
                  estado: Math.abs(difClp) <= 2000 ? 'conciliado' : 'diferencia_monto',
                  eerr: matchedE,
                  cuota: matchedS,
                  diferenciaClp: difClp,
                  diferenciaUf: difUf,
                  criterioMatch: 'ia_semantico',
                  confianzaIa: sug.confianza,
                  explicacionIa: sug.explicacion,
                  accionSugerida: Math.abs(difClp) <= 2000 ? 'aceptar_match' : 'ajustar_cuota',
                  nuevoMontoClp: matchedE.montoClp,
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Aviso en análisis heurístico IA del conciliador:', err);
    }
  }

  // PASO 5: Agregar Facturas de EERR No Proyectadas (Facturas sin cuota en SF)
  for (const e of filteredEerr) {
    if (!eerrUsados.has(e.id)) {
      conciliados.push({
        id: `no-proy-${e.id}`,
        estado: 'no_proyectado',
        eerr: e,
        diferenciaClp: e.montoClp,
        diferenciaUf: e.montoUfAprox,
        criterioMatch: 'sin_match',
        accionSugerida: 'crear_cuota',
        nuevoMontoClp: e.montoClp,
      });
    }
  }

  // PASO 6: Agregar Cuotas de Salesforce No Facturadas (Cuotas huérfanas en SF)
  for (const s of filteredSf) {
    if (!sfUsados.has(s.id)) {
      conciliados.push({
        id: `no-fact-${s.id}`,
        estado: 'no_facturado',
        cuota: s,
        diferenciaClp: -s.montoClp,
        diferenciaUf: -s.montoUf,
        criterioMatch: 'sin_match',
        accionSugerida: 'postergar_mes',
        mesDestinoPostergar: mes === 12 ? 1 : mes + 1,
        anioDestinoPostergar: mes === 12 ? anio + 1 : anio,
      });
    }
  }

  // 3. Calcular Resumen y KPIs
  const totalEerrClp = filteredEerr.reduce((acc, it) => acc + it.montoClp, 0);
  const totalEerrUf = Number((totalEerrClp / UF_PROMEDIO_DEFAULT).toFixed(2));

  const totalSfClp = filteredSf.reduce((acc, it) => acc + it.montoClp, 0);
  const totalSfUf = Number((totalSfClp / UF_PROMEDIO_DEFAULT).toFixed(2));

  const difNetaClp = totalEerrClp - totalSfClp;
  const difNetaUf = Number((difNetaClp / UF_PROMEDIO_DEFAULT).toFixed(2));

  const conteoConciliados = conciliados.filter((c) => c.estado === 'conciliado').length;
  const conteoDiferenciaMonto = conciliados.filter((c) => c.estado === 'diferencia_monto').length;
  const conteoDesfaseTemporal = conciliados.filter((c) => c.estado === 'desfase_temporal').length;
  const conteoNoProyectados = conciliados.filter((c) => c.estado === 'no_proyectado').length;
  const conteoNoFacturados = conciliados.filter((c) => c.estado === 'no_facturado').length;

  const pctCuadratura =
    filteredEerr.length > 0
      ? Math.round((conteoConciliados / filteredEerr.length) * 100)
      : 100;

  const resumen: ConciliacionResumen = {
    mes,
    anio,
    division,
    totalEerrClp,
    totalEerrUf,
    totalSalesforceClp: totalSfClp,
    totalSalesforceUf: totalSfUf,
    diferenciaNetaClp: difNetaClp,
    diferenciaNetaUf: difNetaUf,
    conteoTotal: conciliados.length,
    conteoConciliados,
    conteoDiferenciaMonto,
    conteoDesfaseTemporal,
    conteoNoProyectados,
    conteoNoFacturados,
    porcentajeCuadratura: pctCuadratura,
  };

  return { items: conciliados, resumen };
}
