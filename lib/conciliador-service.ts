import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import {
  EerrRegistro,
  SalesforceCuotaRegistro,
  ConciliacionItem,
  ConciliacionGroup,
  ConciliacionResumen,
  TipoComprobanteEerr,
  ConsolidadoDivisionControl,
  FiltroCuentaComercial,
  ScoreBreakdown,
  CandidatoSugerido,
  OportunidadClienteRef,
  WorkflowStage,
} from './conciliador-types';
import { getValidSalesforceClient } from './salesforce/salesforce-client';
import { sfRequest } from './salesforce/salesforce-sync-service';
import { GoogleGenAI } from '@google/genai';
import { isOportunidadDgl } from './types';

const UF_PROMEDIO_DEFAULT = 38500;

const RUTS_INTERNOS_IDIEM = new Set([
  '609100001',
  '60910000',
  '60910000K',
]);

const STOPWORDS_RUBRO = new Set([
  'servicio',
  'servicios',
  'ensayo',
  'ensayos',
  'idiem',
  'factura',
  'facturacion',
  'estado',
  'pago',
  'muestreo',
  'muestra',
  'muestras',
  'solicitud',
  'proyecto',
  'estudio',
  'laboratorio',
  'geotecnia',
  'geotecnico',
  'geotecnica',
  'analisis',
  'materiales',
  'spa',
  'ltda',
  'limitada',
  'sa',
  's.a',
  's.a.',
  'scm',
  'eirl',
  'empresa',
  'constructora',
  'ingenieria',
  'minera',
  'compania',
  'sociedad',
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'para',
  'por',
  'con',
  'en',
  'al',
  'un',
  'una',
  'cvi',
  'bol',
  'ing',
  'fact',
  'vta',
  'dgl',
  'sgl',
  'slgp',
  'pre',
  'pr',
]);

export function normalizeRut(rut: unknown): string {
  if (!rut) return '';
  return String(rut)
    .replace(/[^0-9kK]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Fase 0.2 - Normalización Fuzzy de Códigos de Proyecto.
 * Extrae tanto el código completo como el Núcleo Numérico del Proyecto.
 * Soporta formatos compuestos IDIEM (ej. "PR.DGL.2340.2025.0617", "DGL.PRE.2340.2025-0486")
 * y formatos cortos (ej. "PR.DGL.2340.2025", "OT-2340 Ensayo", "COT-1234").
 */
export function extractProyectoCodigos(text: unknown): {
  codigoCompleto?: string;
  codigoNucleo?: string;
  nucleoCorto?: string;
} {
  if (!text) return {};
  const str = String(text).toUpperCase().trim();
  if (!str) return {};

  // 1. Detectar código largo estructurado IDIEM con Año + Correlativo: ej. PR.DGL.2340.2025.0617 o DGL.PRE.2340.2025-0486
  const longCodeMatch = str.match(/((?:PR|PRE|DGL|COT|OT|PROY)[A-Z0-9.\-_]{5,28})/i);
  const yearCorrelativoMatch = str.match(/(?:PR|PRE|DGL|COT|OT|PROY)[A-Z0-9.\-_]*?(20[12]\d)[.\-_](\d{2,5})(?![0-9])/i);

  if (yearCorrelativoMatch) {
    const year = yearCorrelativoMatch[1];
    const corrRaw = yearCorrelativoMatch[2];
    const corrPadded = corrRaw.padStart(4, '0');
    const fullClean = longCodeMatch
      ? longCodeMatch[1].replace(/[.\-_]+$/, '')
      : `${year}-${corrPadded}`;

    return {
      codigoCompleto: fullClean,
      codigoNucleo: `${year}-${corrPadded}`,
      nucleoCorto: corrPadded,
    };
  }

  // 2. Detectar formato sin correlativo posterior al año (ej. "PR.DGL.2340.2025" -> núcleo "2340")
  const codeEndingInYear = str.match(/(?:PR|PRE|OT|DGL|COT|PROY)[\s.\-_]*([A-Z]{2,4}[\s.\-_]*)?(\d{3,5})[\s.\-_]+(20[12]\d)(?![.\-_]?\d)/i);
  if (codeEndingInYear) {
    const numCore = codeEndingInYear[2].padStart(4, '0');
    return {
      codigoCompleto: longCodeMatch ? longCodeMatch[1].replace(/[.\-_]+$/, '') : codeEndingInYear[0].trim(),
      codigoNucleo: numCore,
      nucleoCorto: numCore,
    };
  }

  // 3. Extractor Regex Tolerante general: (?:PR|OT|DGL|COT|PROY|PY)[\s.\-_]*([A-Z]{2,4}[\s.\-_]*)?(\d{3,5})
  const generalMatch = str.match(/(?:PR|PRE|OT|DGL|COT|PROY|PY)[\s.\-_]*([A-Z]{2,4}[\s.\-_]*)?(\d{3,5})/i);
  if (generalMatch) {
    const numCore = generalMatch[2].padStart(4, '0');
    return {
      codigoCompleto: longCodeMatch ? longCodeMatch[1].replace(/[.\-_]+$/, '') : generalMatch[0].trim(),
      codigoNucleo: numCore,
      nucleoCorto: numCore,
    };
  }

  return {};
}

export function extractCodigoOportunidad(text: unknown): string | undefined {
  const { codigoCompleto } = extractProyectoCodigos(text);
  return codigoCompleto;
}

export function esCuentaComercialSalesforce(cuota?: { cuenta?: string; opportunityName?: string } | null): boolean {
  if (!cuota) return false;
  const texto = `${cuota.cuenta || ''} ${cuota.opportunityName || ''}`.toLowerCase();
  return texto.includes('cuenta comercial salesforce');
}

export function isTraspasoInternoEerr(e: EerrRegistro): boolean {
  if (e.tipo === 'traspaso_interno') return true;
  const comp = (e.comprobante || '').toUpperCase();
  if (/\bTI\b/.test(comp) || comp.includes('TRASPASO')) return true;
  const rutClean = normalizeRut(e.rut);
  if (rutClean && RUTS_INTERNOS_IDIEM.has(rutClean)) return true;
  const razon = (e.razonSocial || '').toUpperCase();
  if (razon.includes('IDIEM') || razon.includes('UNIVERSIDAD DE CHILE')) return true;
  return false;
}

export function isNotaCreditoOReversion(e: EerrRegistro): boolean {
  if (e.esNotaCredito || e.tipo === 'nota_credito' || e.tipo === 'reversion') return true;
  const comp = `${e.comprobante || ''} ${e.referenciaExterna || ''} ${e.glosa || ''}`.toUpperCase();
  if (/\bNC\b/.test(comp) || comp.includes('NOTA DE CREDITO') || comp.includes('NOTA DE CRÉDITO') || comp.includes('ANULA')) {
    return true;
  }
  return false;
}

export function parseExcelDate(val: unknown): { fechaIso: string; mes: number; anio: number } {
  if (!val) {
    const now = new Date();
    return {
      fechaIso: now.toISOString().slice(0, 10),
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
    };
  }

  let d: Date | null = null;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number') {
    d = new Date((val - 25569) * 86400 * 1000);
  } else if (typeof val === 'string') {
    const str = val.trim();
    const latamMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (latamMatch) {
      const day = parseInt(latamMatch[1], 10);
      const month = parseInt(latamMatch[2], 10);
      const year = parseInt(latamMatch[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        d = new Date(Date.UTC(year, month - 1, day));
      }
    }
    if (!d) {
      const isoMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (isoMatch) {
        const year = parseInt(isoMatch[1], 10);
        const month = parseInt(isoMatch[2], 10);
        const day = parseInt(isoMatch[3], 10);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          d = new Date(Date.UTC(year, month - 1, day));
        }
      }
    }
    if (!d) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }
  }

  if (!d || isNaN(d.getTime())) {
    const now = new Date();
    return {
      fechaIso: now.toISOString().slice(0, 10),
      mes: now.getMonth() + 1,
      anio: now.getFullYear(),
    };
  }

  return {
    fechaIso: d.toISOString().slice(0, 10),
    mes: d.getUTCMonth() + 1,
    anio: d.getUTCFullYear(),
  };
}

export function classifyComprobante(comprobante: unknown): TipoComprobanteEerr {
  if (!comprobante) return 'facturacion';
  const str = String(comprobante).toUpperCase();
  if (/\bTI\b/.test(str) || str.includes('TRASPASO') || str.includes('TRAS')) return 'traspaso_interno';
  if (/\bNC\b/.test(str) || str.includes('NOTA DE CREDITO') || str.includes('NOTA CRÉDITO')) return 'nota_credito';
  if (str.includes('PROV') && !str.includes('REV')) return 'provision';
  if (str.includes('REV')) return 'reversion';
  if (str.includes('FACT') || str.includes('BOL') || str.includes('CVI')) return 'facturacion';
  return 'otro';
}

export function detectPredominantPeriod(items: Array<{ mes: number; anio: number }>): {
  mes: number;
  anio: number;
  meses: number[];
  anios: number[];
  distribucion: Record<string, number>;
} | null {
  if (!items || items.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const it of items) {
    if (!it.mes || !it.anio) continue;
    const key = `${it.anio}-${it.mes}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) return null;

  entries.sort((a, b) => b[1] - a[1]);
  const [topKey] = entries[0];
  const [anioStr, mesStr] = topKey.split('-');

  const allMeses = Array.from(new Set(items.map((i) => i.mes).filter(Boolean))).sort((a, b) => a - b);
  const allAnios = Array.from(new Set(items.map((i) => i.anio).filter(Boolean))).sort((a, b) => a - b);

  return {
    mes: parseInt(mesStr, 10),
    anio: parseInt(anioStr, 10),
    meses: allMeses,
    anios: allAnios,
    distribucion: counts,
  };
}

/**
 * Similitud Jaro-Winkler entre dos cadenas (0.0 a 1.0)
 */
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Limpieza de stopwords del rubro y extracción de tokens significativos
 */
function extractCleanTokens(rawText: string): string[] {
  const normalized = rawText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

  return normalized
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS_RUBRO.has(t) && !/^\d{4}$/.test(t));
}

/**
 * Calcula similitud semántica entre la glosa/referencia EERR y el nombre de Oportunidad SF (0 a 15 pts)
 */
function computeSemanticTextScore(e: EerrRegistro, s: SalesforceCuotaRegistro): number {
  const textE = `${e.referenciaInterna || ''} ${e.glosa || ''}`;
  const textS = `${s.opportunityName || ''} ${s.cuenta || ''}`;

  const tokensE = extractCleanTokens(textE);
  const tokensS = extractCleanTokens(textS);

  if (tokensE.length === 0 || tokensS.length === 0) return 0;

  const cleanStrE = tokensE.join(' ');
  const cleanStrS = tokensS.join(' ');

  const jw = jaroWinkler(cleanStrE, cleanStrS);
  const setS = new Set(tokensS);
  const intersection = tokensE.filter((t) =>
    Array.from(setS).some((st) => st === t || (t.length >= 4 && st.length >= 4 && (st.includes(t) || t.includes(st))))
  );

  const overlapRatio = intersection.length / Math.max(1, Math.min(tokensE.length, tokensS.length));
  const rawPts = jw * 7 + overlapRatio * 8;
  return Math.min(15, Math.round(rawPts));
}

/**
 * Fase 3 - Matriz de Scoring Ponderado (0 a 100 pts)
 */
export function calcularScorePar(
  e: EerrRegistro,
  s: SalesforceCuotaRegistro
): ScoreBreakdown {
  const codE = extractProyectoCodigos(e.codigoOportunidadExtraido || e.referenciaInterna || e.glosa);
  const codS = extractProyectoCodigos(s.codigoOportunidadExtraido || s.opportunityName);

  const fullE = (e.codigoOportunidadExtraido || codE.codigoCompleto || '').toUpperCase();
  const fullS = (s.codigoOportunidadExtraido || codS.codigoCompleto || '').toUpperCase();
  const nucE = (e.codigoNucleo || codE.codigoNucleo || '').toUpperCase();
  const nucS = (s.codigoNucleo || codS.codigoNucleo || '').toUpperCase();

  // 1. Código (45 pts máx, o -100 pts si ambos tienen código de proyecto y son distintos)
  let codigoScore = 0;
  let razonCodigo = 'Sin código en uno o ambos registros';

  if (nucE && nucS) {
    if (fullE && fullS && fullE === fullS) {
      codigoScore = 45;
      razonCodigo = `Código exacto (${fullE})`;
    } else if (nucE === nucS || (codE.nucleoCorto && codE.nucleoCorto === codS.nucleoCorto)) {
      codigoScore = 35;
      razonCodigo = `Núcleo de proyecto coincidente (${nucE})`;
    } else {
      // Penalización crítica: evita cruzar Proyecto A con Proyecto B en Codelco/BHP
      codigoScore = -100;
      razonCodigo = `Colisión de proyectos distintos (${nucE} ≠ ${nucS})`;
    }
  }

  // 2. Monto (25 pts máx)
  let montoScore = 0;
  const diffAbs = Math.abs(e.montoClp - s.montoClp);
  const maxMonto = Math.max(e.montoClp, s.montoClp, 1);
  const diffPct = diffAbs / maxMonto;

  if (diffAbs <= 2000) {
    montoScore = 25;
  } else if (diffPct <= 0.035) {
    montoScore = 20;
  } else if (diffPct < 0.25) {
    montoScore = Math.max(0, Math.round(20 * ((0.25 - diffPct) / (0.25 - 0.035))));
  } else {
    montoScore = 0;
  }

  // 3. Similitud Semántica (15 pts máx)
  const textoScore = computeSemanticTextScore(e, s);

  // 4. Ventana Temporal (10 pts máx)
  const mesesDist = Math.abs((e.anio * 12 + e.mes) - (s.anio * 12 + s.mes));
  let tiempoScore = 0;
  if (mesesDist === 0) tiempoScore = 10;
  else if (mesesDist === 1) tiempoScore = 6;
  else if (mesesDist === 2) tiempoScore = 2;

  // 5. Sección / Centro de Costo (5 pts máx)
  let seccionScore = 0;
  const ccE = String(e.centroCosto || '').trim();
  const unidadS = String(s.unidad || '').trim();
  const secE = String(e.seccion || '').toUpperCase();
  const secS = String(s.seccion || '').toUpperCase();

  if (ccE && unidadS && unidadS.includes(ccE)) {
    seccionScore = 5;
  } else if (secE && secS && (secS.includes(secE) || secE.includes(secS))) {
    seccionScore = 5;
  } else if (e.division && s.division && e.division.toUpperCase() === s.division.toUpperCase()) {
    seccionScore = 3;
  }

  const rawTotal = codigoScore + montoScore + textoScore + tiempoScore + seccionScore;
  const totalScore = Math.max(0, Math.min(100, rawTotal));

  return {
    totalScore,
    codigoScore,
    montoScore,
    textoScore,
    tiempoScore,
    seccionScore,
    matchType: codigoScore >= 35 ? 'EXACTO' : 'SCORING_PROBABLE',
    explicacion: `${razonCodigo} | Δ Monto: ${(diffPct * 100).toFixed(1)}% (${montoScore}/25) | Texto: ${textoScore}/15 | Mes: ${tiempoScore}/10`,
  };
}

/**
 * Fase 2 - Solver Ligero de Subset Sum con poda (máx 5 elementos, tolerancia ±2.5% o <= $2.000 CLP)
 */
function findSubsetSumMatch<T extends { id: string; montoClp: number }>(
  candidates: T[],
  targetAmount: number,
  maxElements = 5,
  tolerancePct = 0.025
): T[] | null {
  if (targetAmount <= 0 || candidates.length < 2) return null;

  // Ordenar de mayor a menor para podar rápido
  const sorted = [...candidates]
    .filter((c) => c.montoClp > 0 && c.montoClp <= targetAmount * (1 + tolerancePct) + 2000)
    .sort((a, b) => b.montoClp - a.montoClp)
    .slice(0, 14); // Limitar universo por cliente para evitar explosión combinatoria

  if (sorted.length < 2) return null;

  let bestSubset: T[] | null = null;
  let bestDiff = Infinity;

  function backtrack(startIdx: number, current: T[], currentSum: number) {
    if (current.length >= 2) {
      const diff = Math.abs(currentSum - targetAmount);
      const relDiff = diff / Math.max(targetAmount, 1);
      if (diff <= 2000 || relDiff <= tolerancePct) {
        if (diff < bestDiff) {
          bestDiff = diff;
          bestSubset = [...current];
        }
        if (diff <= 500) return; // Suficientemente exacto
      }
    }

    if (current.length >= maxElements) return;
    if (bestDiff <= 500) return;

    for (let i = startIdx; i < sorted.length; i++) {
      const nextSum = currentSum + sorted[i].montoClp;
      if (nextSum > targetAmount * (1 + tolerancePct) + 2000) continue;
      current.push(sorted[i]);
      backtrack(i + 1, current, nextSum);
      current.pop();
    }
  }

  backtrack(0, [], 0);
  return bestSubset;
}

/**
 * Lee y extrae los datos del libro Excel (ya sea un buffer en memoria o el archivo del servidor).
 */
export async function parseLibroEerr(
  input: Buffer | string
): Promise<{
  eerrItems: EerrRegistro[];
  sfItems: SalesforceCuotaRegistro[];
  consolidadoDivisiones?: Record<string, ConsolidadoDivisionControl>;
}> {
  const workbook = new ExcelJS.Workbook();

  if (Buffer.isBuffer(input)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  const consolidadoDivisiones: Record<string, ConsolidadoDivisionControl> = {};

  const isSalesforceWs = (ws: ExcelJS.Worksheet): boolean => {
    const name = ws.name.toLowerCase();
    if (name.includes('cuota') || name.includes('vta') || name.includes('salesforce') || name.includes('sf')) {
      return true;
    }
    for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
      const row = ws.getRow(r);
      let hasOpp = false;
      let hasCuotaMarker = false;
      row.eachCell((c) => {
        const s = String(c.value || '').toLowerCase();
        if (s.includes('oportunidad')) hasOpp = true;
        if (s.includes('cuota') || s.includes('fecha de pago') || s.includes('etapa') || s.includes('presupuesto')) {
          hasCuotaMarker = true;
        }
      });
      if (hasOpp && hasCuotaMarker) return true;
    }
    return false;
  };

  const isEerrWs = (ws: ExcelJS.Worksheet): boolean => {
    if (['Selectores', 'Cuadratura', 'Año_reporte', 'Indicaciones SGC', 'BBDD Gráficos'].includes(ws.name)) {
      return false;
    }
    if (isSalesforceWs(ws)) return false;

    const name = ws.name.toLowerCase();
    if (name.includes('facturaci') || name.includes('eerr') || name.includes('sin ti') || name === 'hoja1') {
      return true;
    }

    for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
      const row = ws.getRow(r);
      let hasEerrMarker = false;
      row.eachCell((c) => {
        const s = String(c.value || '').toLowerCase();
        if (
          s.includes('resultado[') ||
          s.includes('glosa') ||
          s.includes('comprobante') ||
          s.includes('referencia interna')
        ) {
          hasEerrMarker = true;
        }
      });
      if (hasEerrMarker) return true;
    }
    return false;
  };

  const wsSf = workbook.worksheets.find(isSalesforceWs);
  const wsFact = workbook.worksheets.find(isEerrWs);

  if (wsFact) {
    let headerRowIdx = 1;
    for (let r = 1; r <= Math.min(10, wsFact.rowCount); r++) {
      const row = wsFact.getRow(r);
      let found = false;
      row.eachCell((c) => {
        const val = String(c.value || '').toLowerCase();
        if (
          val.includes('ingreso') ||
          val.includes('monto') ||
          val.includes('rut') ||
          val.includes('division') ||
          val.includes('resultado[')
        ) {
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
      colMap[clean.toLowerCase()] = col;

      const match = clean.match(/Resultado\[(.*)\]/i);
      if (match) {
        colMap[match[1].trim()] = col;
        colMap[match[1].trim().toLowerCase()] = col;
      }
    });

    const colDiv = colMap['div'] || colMap['sigladivision'] || colMap['division'] || 20;
    const colSec = colMap['siglaseccion'] || colMap['seccion'] || 2;
    const colCc = colMap['centro de costo'] || colMap['centro_costo_id'] || colMap['centrocosto'] || 6;
    const colDate = colMap['fecha'] || colMap['date'] || 3;
    const colComp = colMap['comprobante'] || colMap['tipo'] || 23;
    const colRut = colMap['rut_id'] || colMap['rut'] || colMap['rut empresa'] || 14;
    const colRazon =
      colMap['razón social'] || colMap['razon social'] || colMap['cliente'] || colMap['nombre de la cuenta'] || 22;
    const colRefInt = colMap['referencia interna'] || colMap['proyecto'] || colMap['glosa'] || 8;
    const colRefExt = colMap['referencia externa'] || colMap['n° factura'] || colMap['factura'] || 7;
    const colGlosa = colMap['glosa/detalle'] || colMap['detalle'] || colMap['glosa'] || 12;
    const colCta = colMap['cuenta contable'] || colMap['cuenta_contable_id'] || 15;
    const colClasif = colMap['clasificación'] || colMap['clasificacion'] || 9;
    const colServ = colMap['tiposervicio'] || colMap['tipo servicio'] || 10;
    const colIngreso = colMap['monto'] || colMap['ingreso'] || colMap['total'] || 13;

    for (let r = headerRowIdx + 1; r <= wsFact.rowCount; r++) {
      const row = wsFact.getRow(r);
      const ingresoRaw = row.getCell(colIngreso).value;
      if (ingresoRaw === null || ingresoRaw === undefined || ingresoRaw === '') continue;

      const rawMonto = Number(ingresoRaw) || 0;
      if (rawMonto === 0) continue;
      const montoClp = Math.abs(rawMonto);

      const divVal = String(row.getCell(colDiv).value || 'DGL').trim();
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

      const codInfo = extractProyectoCodigos(`${refIntVal} ${glosaVal}`);
      const tipoComp = classifyComprobante(compVal);

      eerrItems.push({
        id: `eerr-${r}-${Date.now()}`,
        division: divVal || 'DGL',
        seccion: secVal,
        centroCosto: ccVal,
        fecha: fechaIso,
        mes,
        anio,
        comprobante: compVal,
        tipo: tipoComp,
        rut: rutVal,
        razonSocial: razonVal,
        referenciaInterna: refIntVal,
        codigoOportunidadExtraido: codInfo.codigoCompleto,
        codigoNucleo: codInfo.codigoNucleo,
        referenciaExterna: refExtVal,
        glosa: glosaVal,
        cuentaContable: String(row.getCell(colCta).value || ''),
        clasificacion: String(row.getCell(colClasif).value || ''),
        tipoServicio: String(row.getCell(colServ).value || ''),
        montoClp,
        montoUfAprox: Number((montoClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
        esNotaCredito: tipoComp === 'nota_credito' || tipoComp === 'reversion',
      });
    }
  }

  if (wsSf) {
    let headerRowIdxSf = 1;
    for (let r = 1; r <= Math.min(10, wsSf.rowCount); r++) {
      const row = wsSf.getRow(r);
      let found = false;
      row.eachCell((c) => {
        const val = String(c.value || '').toLowerCase();
        if (val.includes('oportunidad') || val.includes('cuota') || val.includes('fecha de pago')) {
          found = true;
        }
      });
      if (found) {
        headerRowIdxSf = r;
        break;
      }
    }

    const colMapSf: Record<string, number> = {};
    const headerRowSf = wsSf.getRow(headerRowIdxSf);
    headerRowSf.eachCell((c, col) => {
      const clean = String(c.value || '').trim();
      colMapSf[clean] = col;
      colMapSf[clean.toLowerCase()] = col;
    });

    const colRutSf = colMapSf['rut empresa'] || colMapSf['rut'] || colMapSf['rut_id'] || 1;
    const colCuentaSf = colMapSf['nombre de la cuenta'] || colMapSf['cuenta'] || colMapSf['cliente'] || 2;
    const colOppSf = colMapSf['nombre de la oportunidad'] || colMapSf['oportunidad'] || 3;
    const colEtapaSf = colMapSf['etapa'] || 4;
    const colMontoSf = colMapSf['monto'] || colMapSf['ingreso'] || 5;
    const colCuotaNumSf =
      colMapSf['número de cuota'] || colMapSf['numero de cuota'] || colMapSf['contador de cuotas'] || colMapSf['cuota'] || 6;
    const colSecSf = colMapSf['sección'] || colMapSf['seccion'] || 8;
    const colPresupuestoSf = colMapSf['presupuesto sincronizado'] || colMapSf['presupuesto'] || 9;
    const colDivSf = colMapSf['división'] || colMapSf['division'] || colMapSf['div'] || 10;
    const colFechaPagoSf = colMapSf['fecha de pago'] || colMapSf['fecha'] || 11;
    const colUnidadSf = colMapSf['unidad'] || 12;
    const colTraspasoSf =
      colMapSf['interno/externo'] || colMapSf['traspaso interno'] || colMapSf['traspaso'] || 13;

    for (let r = headerRowIdxSf + 1; r <= wsSf.rowCount; r++) {
      const row = wsSf.getRow(r);
      const montoraw = row.getCell(colMontoSf).value;
      if (montoraw === null || montoraw === undefined || montoraw === '') continue;

      const montoClp = Number(montoraw) || 0;
      const rawDate = row.getCell(colFechaPagoSf).value;
      const { fechaIso, mes, anio } = parseExcelDate(rawDate);
      const oppName = String(row.getCell(colOppSf).value || '').trim();
      const prespSinc = String(row.getCell(colPresupuestoSf).value || '').trim();
      const divVal = String(row.getCell(colDivSf).value || 'DGL').trim();
      const rutVal = normalizeRut(row.getCell(colRutSf).value);
      const cuentaVal = String(row.getCell(colCuentaSf).value || '').trim();
      const traspasoRaw = String(row.getCell(colTraspasoSf).value || '').toLowerCase();
      const isTraspaso = traspasoRaw.includes('interno') || traspasoRaw === 'verdadero' || traspasoRaw === 'true';

      const codInfo = extractProyectoCodigos(`${prespSinc} ${oppName}`);

      sfItems.push({
        id: `sf-${r}-${Date.now()}`,
        opportunityId: codInfo.codigoCompleto ? `opp-${codInfo.codigoCompleto}` : `opp-row-${r}`,
        opportunityName: oppName,
        codigoOportunidadExtraido: codInfo.codigoCompleto,
        codigoNucleo: codInfo.codigoNucleo,
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
        traspasoInterno: isTraspaso,
        esCuentaComercial: esCuentaComercialSalesforce({ cuenta: cuentaVal, opportunityName: oppName }),
      });
    }
  }

  const wsGraf = workbook.getWorksheet('BBDD Gráficos');
  if (wsGraf) {
    for (let r = 24; r <= Math.min(38, wsGraf.rowCount); r++) {
      const row = wsGraf.getRow(r);
      const div = String(row.getCell(1).value || '').trim();
      if (!div || div === 'Total general' || div === 'Datos para gráficos') continue;

      const getVal = (cell: ExcelJS.Cell | undefined) => {
        if (!cell) return 0;
        if (cell.result !== undefined && cell.result !== null && typeof cell.result !== 'object') {
          return Number(cell.result) || 0;
        }
        return Number(cell.value) || 0;
      };

      consolidadoDivisiones[div] = {
        division: div,
        backlogSalesforceClp: getVal(row.getCell(2)),
        facturacionEerrClp: getVal(row.getCell(3)),
        traspasosEerrClp: getVal(row.getCell(4)),
        totalIngresosEerrClp: getVal(row.getCell(5)),
        diferenciaClp: getVal(row.getCell(6)),
      };
    }
  }

  return { eerrItems, sfItems, consolidadoDivisiones };
}

/**
 * Consulta en vivo las Cuotas de Facturación de Salesforce vía SOQL (incluyendo ventana M-1 y M+1 para desfases).
 */
export async function fetchLiveSalesforceCuotas(
  mes: number,
  anio: number,
  division = 'DGL'
): Promise<SalesforceCuotaRegistro[]> {
  const { accessToken, instanceUrl } = await getValidSalesforceClient();

  const prevDate = new Date(Date.UTC(anio, mes - 2, 1));
  const nextDate = new Date(Date.UTC(anio, mes + 1, 0));

  const startDay = prevDate.toISOString().slice(0, 10);
  const endDay = nextDate.toISOString().slice(0, 10);

  const dglOppWhere = "(Oportunidad__r.Division__c = 'DGL' OR Oportunidad__r.Name LIKE '%DGL%' OR Oportunidad__r.Name LIKE '%2340%' OR Oportunidad__r.Name LIKE '%2341%' OR Oportunidad__r.Name LIKE '%2344%' OR Oportunidad__r.Name LIKE '%1817%' OR Oportunidad__r.Name LIKE '%2339%' OR Oportunidad__r.Name LIKE '%3340%')";

  let records: any[] = [];
  try {
    const soqlDgl = encodeURIComponent(
      `SELECT Id, Name, Numero_de_cuota__c, Fecha_de_Pago__c, Monto__c, Oportunidad__c, Oportunidad__r.Name, Oportunidad__r.Division__c, Oportunidad__r.StageName, Oportunidad__r.Owner.Name, Oportunidad__r.Account.Name, Oportunidad__r.Account.Rut__c FROM Cuota_de_facturacion__c WHERE Fecha_de_Pago__c >= ${startDay} AND Fecha_de_Pago__c <= ${endDay} AND ${dglOppWhere} ORDER BY Fecha_de_Pago__c ASC LIMIT 2000`
    );
    const res = await sfRequest(instanceUrl, accessToken, `query?q=${soqlDgl}`);
    records = res?.records || [];
  } catch (err1) {
    console.warn('SOQL cuotas con filtro de división DGL falló, reintentando con campos básicos:', err1);
    try {
      const soqlFallback = encodeURIComponent(
        `SELECT Id, Name, Numero_de_cuota__c, Fecha_de_Pago__c, Monto__c, Oportunidad__c, Oportunidad__r.Name, Oportunidad__r.StageName, Oportunidad__r.Owner.Name, Oportunidad__r.Account.Name, Oportunidad__r.Account.Rut__c FROM Cuota_de_facturacion__c WHERE Fecha_de_Pago__c >= ${startDay} AND Fecha_de_Pago__c <= ${endDay} ORDER BY Fecha_de_Pago__c ASC LIMIT 2000`
      );
      const res = await sfRequest(instanceUrl, accessToken, `query?q=${soqlFallback}`);
      records = res?.records || [];
    } catch (err2) {
      console.error('Error consultando cuotas en Salesforce:', err2);
    }
  }

  // Filtrar estrictamente cuotas que pertenezcan a Oportunidades de la División DGL
  const dglRecords = records.filter((rec: any) =>
    isOportunidadDgl({
      Name: rec.Oportunidad__r?.Name,
      Division__c: rec.Oportunidad__r?.Division__c,
    })
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return dglRecords.map((rec: any, idx: number) => {
    const oppName = rec.Oportunidad__r?.Name || 'Oportunidad sin nombre';
    const montoClp = Number(rec.Monto__c) || 0;
    const { fechaIso, mes: recMes, anio: recAnio } = parseExcelDate(rec.Fecha_de_Pago__c);
    const codInfo = extractProyectoCodigos(oppName);

    return {
      id: rec.Id || `live-sf-${idx}`,
      opportunityId: rec.Oportunidad__c || (codInfo.codigoCompleto ? `opp-${codInfo.codigoCompleto}` : `opp-live-${idx}`),
      opportunityName: oppName,
      codigoOportunidadExtraido: codInfo.codigoCompleto,
      codigoNucleo: codInfo.codigoNucleo,
      etapa: rec.Oportunidad__r?.StageName || 'Cerrada ganada',
      numeroCuota: Number(rec.Numero_de_cuota__c) || 1,
      fechaPago: fechaIso,
      mes: recMes,
      anio: recAnio,
      montoClp,
      montoUf: Number((montoClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
      rutEmpresa: normalizeRut(rec.Oportunidad__r?.Account?.Rut__c),
      cuenta: rec.Oportunidad__r?.Account?.Name || '',
      division: 'DGL',
      comercialResponsable: rec.Oportunidad__r?.Owner?.Name || undefined,
      traspasoInterno: false,
      esCuentaComercial: esCuentaComercialSalesforce({
        cuenta: rec.Oportunidad__r?.Account?.Name || '',
        opportunityName: rec.Oportunidad__r?.Name || '',
      }),
    };
  });
}

function buildGroupCardinalidad(eLen: number, sLen: number): ConciliacionGroup['cardinalidad'] {
  if (eLen === 0) return '0:1';
  if (sLen === 0) return '1:0';
  if (eLen === 1 && sLen === 1) return '1:1';
  if (eLen === 1 && sLen > 1) return '1:N';
  if (eLen > 1 && sLen === 1) return 'N:1';
  return 'N:M';
}

function createConciliacionGroup(params: {
  id: string;
  stage: WorkflowStage;
  eerrItems: EerrRegistro[];
  sfItems: SalesforceCuotaRegistro[];
  scoreBreakdown: ScoreBreakdown;
  candidatosSugeridos?: CandidatoSugerido[];
}): ConciliacionGroup {
  const { id, stage, eerrItems, sfItems, scoreBreakdown, candidatosSugeridos } = params;
  const totalEerrClp = eerrItems.reduce((sum, e) => sum + e.montoClp, 0);
  const totalSfClp = sfItems.reduce((sum, s) => sum + s.montoClp, 0);
  const deltaClp = totalEerrClp - totalSfClp;
  const baseDenom = totalSfClp > 0 ? totalSfClp : Math.max(totalEerrClp, 1);
  const deltaPct = Number(((deltaClp / baseDenom) * 100).toFixed(2));

  const firstE = eerrItems[0];
  const firstS = sfItems[0];

  const rut = firstE?.rut || firstS?.rutEmpresa || '';
  const cliente = firstE?.razonSocial || firstS?.cuenta || 'Cliente sin razón social';
  const codigoProyecto =
    firstE?.codigoOportunidadExtraido ||
    firstS?.codigoOportunidadExtraido ||
    extractProyectoCodigos(firstE?.referenciaInterna || firstS?.opportunityName).codigoCompleto;
  const codigoNucleo =
    firstE?.codigoNucleo ||
    firstS?.codigoNucleo ||
    extractProyectoCodigos(firstE?.referenciaInterna || firstS?.opportunityName).codigoNucleo;

  return {
    id,
    stage,
    cardinalidad: buildGroupCardinalidad(eerrItems.length, sfItems.length),
    rut,
    cliente,
    codigoProyecto,
    codigoNucleo,
    eerrItems,
    sfItems,
    totalEerrClp,
    totalEerrUf: Number((totalEerrClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
    totalSfClp,
    totalSfUf: Number((totalSfClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
    deltaClp,
    deltaPct,
    deltaUf: Number((deltaClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
    scoreBreakdown,
    candidatosSugeridos,
    esCuentaComercial: sfItems.some((s) => esCuentaComercialSalesforce(s)),
  };
}

/**
 * Motor Central de Conciliación 2.0: Multicriterio Determinístico N:M, Subset-Sum y Matriz de Scoring.
 */
export async function conciliarPeriodo(params: {
  eerrItems: EerrRegistro[];
  sfItems: SalesforceCuotaRegistro[];
  mes: number;
  anio: number;
  division?: string;
  usarIaGemini?: boolean;
  consolidadoDivisiones?: Record<string, ConsolidadoDivisionControl>;
  filtroCuentaComercial?: FiltroCuentaComercial;
}): Promise<{
  groups: ConciliacionGroup[];
  oportunidadesClientes: OportunidadClienteRef[];
  items: ConciliacionItem[];
  resumen: ConciliacionResumen;
}> {
  const {
    eerrItems,
    sfItems,
    mes,
    anio,
    division = 'DGL',
    consolidadoDivisiones,
    filtroCuentaComercial = 'todas',
  } = params;

  // Normalizar y enriquecer códigos de todos los registros de la división
  const enrichedAllEerr: EerrRegistro[] = eerrItems
    .filter((e) => !division || division === 'TODAS' || (e.division || 'DGL').toUpperCase() === division.toUpperCase())
    .map((e) => {
      const codInfo = extractProyectoCodigos(`${e.codigoOportunidadExtraido || ''} ${e.referenciaInterna || ''} ${e.glosa || ''}`);
      return {
        ...e,
        rut: normalizeRut(e.rut),
        codigoOportunidadExtraido: codInfo.codigoCompleto || e.codigoOportunidadExtraido,
        codigoNucleo: codInfo.codigoNucleo || e.codigoNucleo,
      };
    });

  const enrichedAllSf: SalesforceCuotaRegistro[] = sfItems
    .filter((s) => {
      if (division && division !== 'TODAS' && (s.division || 'DGL').toUpperCase() !== division.toUpperCase()) {
        return false;
      }
      if (!isOportunidadDgl({ Name: s.opportunityName, Division__c: s.division, codigo: s.codigoOportunidadExtraido })) {
        return false;
      }
      const esCta = esCuentaComercialSalesforce(s);
      if (filtroCuentaComercial === 'excluir' && esCta) return false;
      if (filtroCuentaComercial === 'solo' && !esCta) return false;
      return true;
    })
    .map((s, idx) => {
      const codInfo = extractProyectoCodigos(`${s.codigoOportunidadExtraido || ''} ${s.opportunityName || ''}`);
      const oppId =
        s.opportunityId ||
        (codInfo.codigoCompleto
          ? `opp-${codInfo.codigoCompleto}`
          : `opp-${normalizeRut(s.rutEmpresa) || 'norut'}-${idx}`);
      return {
        ...s,
        rutEmpresa: normalizeRut(s.rutEmpresa),
        opportunityId: oppId,
        codigoOportunidadExtraido: codInfo.codigoCompleto || s.codigoOportunidadExtraido,
        codigoNucleo: codInfo.codigoNucleo || s.codigoNucleo,
        esCuentaComercial: esCuentaComercialSalesforce(s),
      };
    });

  // Catálogo de Oportunidades activas por cliente para creación de cuotas con Oportunidad__c obligatorio
  const oppMap = new Map<string, OportunidadClienteRef>();
  for (const s of enrichedAllSf) {
    if (!s.opportunityName) continue;
    const key = `${s.rutEmpresa}::${s.codigoNucleo || s.opportunityName}`;
    if (!oppMap.has(key)) {
      oppMap.set(key, {
        opportunityId: s.opportunityId || `opp-${s.id}`,
        opportunityName: s.opportunityName,
        codigoExtraido: s.codigoOportunidadExtraido,
        codigoNucleo: s.codigoNucleo,
        rutEmpresa: s.rutEmpresa,
        cuenta: s.cuenta || 'Cliente Salesforce',
        etapa: s.etapa || 'Cerrada ganada',
        seccion: s.seccion,
        unidad: s.unidad,
        comercialResponsable: s.comercialResponsable,
      });
    }
  }
  const oportunidadesClientes = Array.from(oppMap.values());

  // Registros del mes seleccionado M
  const periodEerr = enrichedAllEerr.filter((e) => e.mes === mes && e.anio === anio);
  const periodSf = enrichedAllSf.filter((s) => s.mes === mes && s.anio === anio);

  // Registros SF en ventana adyacente (M-1, M+1, M-2, M+2) para detección de desfase temporal
  const adjacentSf = enrichedAllSf.filter((s) => {
    const dist = Math.abs((s.anio * 12 + s.mes) - (anio * 12 + mes));
    return dist >= 1 && dist <= 2;
  });

  const groups: ConciliacionGroup[] = [];
  const usedEerrIds = new Set<string>();
  const usedSfIds = new Set<string>();

  // ============================================================================
  // FASE 0.1 - Aislamiento de Traspasos Internos (TI) y Neteo de Notas de Crédito (NC)
  // ============================================================================
  for (const e of periodEerr) {
    if (isTraspasoInternoEerr(e)) {
      usedEerrIds.add(e.id);
      groups.push(
        createConciliacionGroup({
          id: `grp-ti-eerr-${e.id}`,
          stage: 'TRASPASO_INTERNO',
          eerrItems: [e],
          sfItems: [],
          scoreBreakdown: {
            totalScore: 100,
            codigoScore: 0,
            montoScore: 0,
            textoScore: 0,
            tiempoScore: 10,
            seccionScore: 5,
            matchType: 'EXACTO',
            explicacion: 'Traspaso Interno IDIEM / U. de Chile aislado de KPIs de venta externa.',
          },
        })
      );
    }
  }

  for (const s of periodSf) {
    if (s.traspasoInterno) {
      usedSfIds.add(s.id);
      groups.push(
        createConciliacionGroup({
          id: `grp-ti-sf-${s.id}`,
          stage: 'TRASPASO_INTERNO',
          eerrItems: [],
          sfItems: [s],
          scoreBreakdown: {
            totalScore: 100,
            codigoScore: 0,
            montoScore: 0,
            textoScore: 0,
            tiempoScore: 10,
            seccionScore: 5,
            matchType: 'EXACTO',
            explicacion: 'Cuota marcada como Traspaso Interno en Salesforce.',
          },
        })
      );
    }
  }

  // Detectar Notas de Crédito (NC) o Reversiones que anulan facturas del mismo RUT
  const ncCandidates = periodEerr.filter((e) => !usedEerrIds.has(e.id) && isNotaCreditoOReversion(e));
  for (const nc of ncCandidates) {
    if (usedEerrIds.has(nc.id)) continue;
    const targetInvoice = periodEerr.find(
      (inv) =>
        !usedEerrIds.has(inv.id) &&
        inv.id !== nc.id &&
        !isNotaCreditoOReversion(inv) &&
        inv.rut === nc.rut &&
        Math.abs(inv.montoClp - nc.montoClp) <= 2000
    );

    if (targetInvoice) {
      usedEerrIds.add(nc.id);
      usedEerrIds.add(targetInvoice.id);
      groups.push(
        createConciliacionGroup({
          id: `grp-nc-${targetInvoice.id}-${nc.id}`,
          stage: 'ANULADO_NC',
          eerrItems: [targetInvoice, nc],
          sfItems: [],
          scoreBreakdown: {
            totalScore: 100,
            codigoScore: 45,
            montoScore: 25,
            textoScore: 15,
            tiempoScore: 10,
            seccionScore: 5,
            matchType: 'EXACTO',
            explicacion: `Factura ${targetInvoice.referenciaExterna} neteada por Nota de Crédito / Reversión ${nc.referenciaExterna} (Efecto neto $0).`,
          },
        })
      );
    } else {
      usedEerrIds.add(nc.id);
      groups.push(
        createConciliacionGroup({
          id: `grp-nc-solo-${nc.id}`,
          stage: 'ANULADO_NC',
          eerrItems: [nc],
          sfItems: [],
          scoreBreakdown: {
            totalScore: 100,
            codigoScore: 0,
            montoScore: 25,
            textoScore: 10,
            tiempoScore: 10,
            seccionScore: 5,
            matchType: 'EXACTO',
            explicacion: `Nota de Crédito / Reversión ${nc.referenciaExterna} aislada para no distorsionar facturación activa.`,
          },
        })
      );
    }
  }

  // ============================================================================
  // FASE 1 - Pre-Clustering N:M por (RUT_Limpio + Codigo_Nucleo)
  // ============================================================================
  const activeEerr = () => periodEerr.filter((e) => !usedEerrIds.has(e.id));
  const activeSf = () => periodSf.filter((s) => !usedSfIds.has(s.id));

  // Agrupar por Codigo_Nucleo (verificando compatibilidad de RUT si ambos tienen RUT)
  const coreClusters = new Map<
    string,
    { eerr: EerrRegistro[]; sf: SalesforceCuotaRegistro[] }
  >();

  for (const e of activeEerr()) {
    if (!e.codigoNucleo) continue;
    const key = e.codigoNucleo.toUpperCase();
    const entry = coreClusters.get(key) || { eerr: [], sf: [] };
    entry.eerr.push(e);
    coreClusters.set(key, entry);
  }

  for (const s of activeSf()) {
    if (!s.codigoNucleo) continue;
    const key = s.codigoNucleo.toUpperCase();
    const entry = coreClusters.get(key) || { eerr: [], sf: [] };
    entry.sf.push(s);
    coreClusters.set(key, entry);
  }

  for (const [nucleoKey, cluster] of coreClusters.entries()) {
    if (cluster.eerr.length === 0 || cluster.sf.length === 0) continue;

    // Verificar consistencia de RUT: si hay múltiples RUTs en un núcleo corto genérico, separar por RUT
    const rutsE = new Set(cluster.eerr.map((e) => e.rut).filter(Boolean));
    const rutsS = new Set(cluster.sf.map((s) => s.rutEmpresa).filter(Boolean));

    const hasSharedRut =
      rutsE.size === 0 ||
      rutsS.size === 0 ||
      Array.from(rutsE).some((r) => rutsS.has(r));

    // Si tienen RUTs distintos, solo permitir si el código completo largo (ej. PR.DGL.2340.2025.0617) es idéntico
    const hasExactLongCode = cluster.eerr.some((e) =>
      cluster.sf.some(
        (s) =>
          e.codigoOportunidadExtraido &&
          s.codigoOportunidadExtraido &&
          e.codigoOportunidadExtraido.toUpperCase() === s.codigoOportunidadExtraido.toUpperCase()
      )
    );

    if (!hasSharedRut && !hasExactLongCode) continue;

    for (const e of cluster.eerr) usedEerrIds.add(e.id);
    for (const s of cluster.sf) usedSfIds.add(s.id);

    const sumE = cluster.eerr.reduce((acc, i) => acc + i.montoClp, 0);
    const sumS = cluster.sf.reduce((acc, i) => acc + i.montoClp, 0);
    const diffAbs = Math.abs(sumE - sumS);
    const isCuadrado = diffAbs <= 2000;
    const is1to1 = cluster.eerr.length === 1 && cluster.sf.length === 1;

    groups.push(
      createConciliacionGroup({
        id: `grp-cluster-${nucleoKey}-${cluster.eerr[0].id}`,
        stage: isCuadrado ? 'CUADRADOS' : 'DIFERENCIA_MONTO',
        eerrItems: cluster.eerr,
        sfItems: cluster.sf,
        scoreBreakdown: {
          totalScore: isCuadrado ? 100 : 92,
          codigoScore: 45,
          montoScore: isCuadrado ? 25 : 17,
          textoScore: 15,
          tiempoScore: 10,
          seccionScore: 5,
          matchType: is1to1 && isCuadrado ? 'EXACTO' : 'GRUPAL_PROYECTO',
          explicacion: `Agrupación ${cluster.eerr.length}:${cluster.sf.length} por Código de Proyecto (${nucleoKey}). ${
            isCuadrado
              ? 'Cuadre exacto dentro de tolerancia ($2.000 CLP).'
              : `Diferencia de monto detectada ($${(sumE - sumS).toLocaleString('es-CL')} CLP).`
          }`,
        },
      })
    );
  }

  // ============================================================================
  // FASE 2 - Resolución de Subconjuntos (Subset Sum Problem) por RUT
  // ============================================================================
  const rutsRestantes = Array.from(
    new Set(
      activeEerr()
        .map((e) => e.rut)
        .filter(Boolean)
    )
  );

  for (const rut of rutsRestantes) {
    const eerrForRut = activeEerr().filter((e) => e.rut === rut);
    const sfForRut = activeSf().filter((s) => s.rutEmpresa === rut);

    if (eerrForRut.length === 0 || sfForRut.length === 0) continue;

    // 2A: N facturas EERR suman 1 cuota SF (solo si no tienen códigos de proyecto contradictorios)
    if (eerrForRut.length >= 2) {
      for (const s of sfForRut) {
        if (usedSfIds.has(s.id)) continue;
        const compatibleEerr = eerrForRut.filter(
          (e) =>
            !usedEerrIds.has(e.id) &&
            (!e.codigoNucleo || !s.codigoNucleo || e.codigoNucleo === s.codigoNucleo)
        );
        if (compatibleEerr.length < 2) continue;

        const subset = findSubsetSumMatch(compatibleEerr, s.montoClp, 5, 0.025);
        if (subset && subset.length >= 2) {
          usedSfIds.add(s.id);
          for (const eItem of subset) usedEerrIds.add(eItem.id);

          const sumE = subset.reduce((a, b) => a + b.montoClp, 0);
          const isExact = Math.abs(sumE - s.montoClp) <= 2000;

          groups.push(
            createConciliacionGroup({
              id: `grp-subset-n1-${s.id}`,
              stage: isExact ? 'CUADRADOS' : 'DIFERENCIA_MONTO',
              eerrItems: subset,
              sfItems: [s],
              scoreBreakdown: {
                totalScore: isExact ? 95 : 88,
                codigoScore: 30,
                montoScore: isExact ? 25 : 20,
                textoScore: 15,
                tiempoScore: 10,
                seccionScore: 5,
                matchType: 'SUBSET_SUM',
                explicacion: `Resolución Subset-Sum (${subset.length}:1): ${subset.length} facturas del RUT ${rut} suman $${sumE.toLocaleString('es-CL')} frente a cuota SF de $${s.montoClp.toLocaleString('es-CL')}.`,
              },
            })
          );
        }
      }
    }

    // 2B: 1 factura EERR cubre M cuotas SF del mismo cliente
    const remainingEerrRut = activeEerr().filter((e) => e.rut === rut);
    const remainingSfRut = activeSf().filter((s) => s.rutEmpresa === rut);

    if (remainingSfRut.length >= 2) {
      for (const e of remainingEerrRut) {
        if (usedEerrIds.has(e.id)) continue;
        const compatibleSf = remainingSfRut.filter(
          (s) =>
            !usedSfIds.has(s.id) &&
            (!e.codigoNucleo || !s.codigoNucleo || e.codigoNucleo === s.codigoNucleo)
        );
        if (compatibleSf.length < 2) continue;

        const subsetSf = findSubsetSumMatch(compatibleSf, e.montoClp, 5, 0.025);
        if (subsetSf && subsetSf.length >= 2) {
          usedEerrIds.add(e.id);
          for (const sItem of subsetSf) usedSfIds.add(sItem.id);

          const sumS = subsetSf.reduce((a, b) => a + b.montoClp, 0);
          const isExact = Math.abs(e.montoClp - sumS) <= 2000;

          groups.push(
            createConciliacionGroup({
              id: `grp-subset-1m-${e.id}`,
              stage: isExact ? 'CUADRADOS' : 'DIFERENCIA_MONTO',
              eerrItems: [e],
              sfItems: subsetSf,
              scoreBreakdown: {
                totalScore: isExact ? 95 : 88,
                codigoScore: 30,
                montoScore: isExact ? 25 : 20,
                textoScore: 15,
                tiempoScore: 10,
                seccionScore: 5,
                matchType: 'SUBSET_SUM',
                explicacion: `Resolución Subset-Sum (1:${subsetSf.length}): Factura ${e.referenciaExterna} ($${e.montoClp.toLocaleString('es-CL')}) cubre ${subsetSf.length} cuotas SF ($${sumS.toLocaleString('es-CL')}).`,
              },
            })
          );
        }
      }
    }
  }

  // ============================================================================
  // FASE 3 - Matriz de Scoring Ponderado (0 a 100 pts) incluyendo ventana M-1 / M+1
  // ============================================================================
  interface CandidatePair {
    e: EerrRegistro;
    s: SalesforceCuotaRegistro;
    score: ScoreBreakdown;
    isAdjacentMonth: boolean;
  }

  const candidatePoolSf = [...activeSf(), ...adjacentSf.filter((s) => !usedSfIds.has(s.id))];
  const allPairs: CandidatePair[] = [];

  for (const e of activeEerr()) {
    for (const s of candidatePoolSf) {
      const sameRut = Boolean(e.rut && s.rutEmpresa && e.rut === s.rutEmpresa);
      const sameNucleo = Boolean(
        e.codigoNucleo && s.codigoNucleo && e.codigoNucleo.toUpperCase() === s.codigoNucleo.toUpperCase()
      );
      if (!sameRut && !sameNucleo) continue;

      const score = calcularScorePar(e, s);
      if (score.totalScore > 0) {
        allPairs.push({
          e,
          s,
          score,
          isAdjacentMonth: s.mes !== mes || s.anio !== anio,
        });
      }
    }
  }

  // Ordenar de mayor a menor Score
  allPairs.sort((a, b) => b.score.totalScore - a.score.totalScore);

  for (const pair of allPairs) {
    if (usedEerrIds.has(pair.e.id) || usedSfIds.has(pair.s.id)) continue;
    if (pair.score.totalScore < 70) continue;

    usedEerrIds.add(pair.e.id);
    usedSfIds.add(pair.s.id);

    const diffAbs = Math.abs(pair.e.montoClp - pair.s.montoClp);
    let stage: WorkflowStage = 'DIFERENCIA_MONTO';

    if (pair.isAdjacentMonth) {
      stage = 'DESFASE_TEMPORAL';
    } else if (pair.score.totalScore >= 85 && diffAbs <= 2000) {
      stage = 'CUADRADOS';
    } else {
      stage = 'DIFERENCIA_MONTO';
    }

    groups.push(
      createConciliacionGroup({
        id: `grp-score-${pair.e.id}-${pair.s.id}`,
        stage,
        eerrItems: [pair.e],
        sfItems: [pair.s],
        scoreBreakdown: pair.score,
      })
    );
  }

  // ============================================================================
  // FASE 3.5 - Huérfanos a MESA_CIRUGIA con Top 3 Candidatos Sugeridos
  // ============================================================================
  const finalOrphanEerr = activeEerr();
  const finalOrphanSf = activeSf();
  const availableAdjacentSf = adjacentSf.filter((s) => !usedSfIds.has(s.id));

  for (const e of finalOrphanEerr) {
    const candidatosPool = [...finalOrphanSf, ...availableAdjacentSf];
    const scoredCandidates: CandidatoSugerido[] = candidatosPool
      .map((s) => {
        const sb = calcularScorePar(e, s);
        const rutBonus = e.rut && s.rutEmpresa && e.rut === s.rutEmpresa ? 15 : 0;
        const adjustedScore = Math.min(99, Math.max(0, sb.totalScore + (sb.codigoScore === -100 ? 0 : rutBonus)));
        return {
          targetId: s.id,
          targetType: 'SF_CUOTA' as const,
          titulo: s.opportunityName,
          rut: s.rutEmpresa,
          cliente: s.cuenta,
          montoClp: s.montoClp,
          fecha: s.fechaPago,
          mes: s.mes,
          anio: s.anio,
          codigoExtraido: s.codigoOportunidadExtraido,
          codigoNucleo: s.codigoNucleo,
          scoreBreakdown: {
            ...sb,
            totalScore: adjustedScore,
          },
        };
      })
      .filter((c) => c.scoreBreakdown.totalScore > 0 || (e.rut && c.rut === e.rut))
      .sort((a, b) => b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore)
      .slice(0, 3);

    groups.push(
      createConciliacionGroup({
        id: `grp-orphan-eerr-${e.id}`,
        stage: 'MESA_CIRUGIA',
        eerrItems: [e],
        sfItems: [],
        scoreBreakdown: {
          totalScore: scoredCandidates[0]?.scoreBreakdown.totalScore || 0,
          codigoScore: 0,
          montoScore: 0,
          textoScore: 0,
          tiempoScore: 0,
          seccionScore: 0,
          matchType: 'HUERFANO',
          explicacion: e.codigoNucleo
            ? `Factura con código ${e.codigoOportunidadExtraido || e.codigoNucleo} sin cuota encontrada en Salesforce.`
            : 'Factura en EERR sin código de proyecto ni cuota coincidente en el período.',
        },
        candidatosSugeridos: scoredCandidates,
      })
    );
  }

  for (const s of finalOrphanSf) {
    const scoredCandidates: CandidatoSugerido[] = finalOrphanEerr
      .map((e) => {
        const sb = calcularScorePar(e, s);
        return {
          targetId: e.id,
          targetType: 'EERR_FACTURA' as const,
          titulo: e.referenciaInterna || e.glosa || `Factura ${e.referenciaExterna}`,
          rut: e.rut,
          cliente: e.razonSocial,
          montoClp: e.montoClp,
          fecha: e.fecha,
          mes: e.mes,
          anio: e.anio,
          codigoExtraido: e.codigoOportunidadExtraido,
          codigoNucleo: e.codigoNucleo,
          scoreBreakdown: sb,
        };
      })
      .filter((c) => c.scoreBreakdown.totalScore > 0 || (s.rutEmpresa && c.rut === s.rutEmpresa))
      .sort((a, b) => b.scoreBreakdown.totalScore - a.scoreBreakdown.totalScore)
      .slice(0, 3);

    groups.push(
      createConciliacionGroup({
        id: `grp-orphan-sf-${s.id}`,
        stage: 'MESA_CIRUGIA',
        eerrItems: [],
        sfItems: [s],
        scoreBreakdown: {
          totalScore: scoredCandidates[0]?.scoreBreakdown.totalScore || 0,
          codigoScore: 0,
          montoScore: 0,
          textoScore: 0,
          tiempoScore: 0,
          seccionScore: 0,
          matchType: 'HUERFANO',
          explicacion: `Cuota proyectada en Salesforce (${s.opportunityName}) sin factura emitida en EERR este mes.`,
        },
        candidatosSugeridos: scoredCandidates,
      })
    );
  }

  // ============================================================================
  // Retrocompatibilidad: Mapear grupos a ConciliacionItem[] y calcular KPIs
  // ============================================================================
  const itemsLegacy: ConciliacionItem[] = groups
    .filter((g) => g.stage !== 'TRASPASO_INTERNO' && g.stage !== 'ANULADO_NC')
    .map((g) => {
      const estadoMap: Record<WorkflowStage, ConciliacionItem['estado']> = {
        CUADRADOS: 'conciliado',
        DIFERENCIA_MONTO: 'diferencia_monto',
        DESFASE_TEMPORAL: 'desfase_temporal',
        MESA_CIRUGIA: g.eerrItems.length > 0 ? 'no_proyectado' : 'no_facturado',
        TRASPASO_INTERNO: 'conciliado',
        ANULADO_NC: 'conciliado',
      };

      const accionMap: Record<ConciliacionItem['estado'], ConciliacionItem['accionSugerida']> = {
        conciliado: 'aceptar_match',
        diferencia_monto: 'ajustar_cuota',
        desfase_temporal: 'mover_cuota',
        no_proyectado: 'crear_cuota',
        no_facturado: 'postergar_mes',
      };

      const estado = estadoMap[g.stage];
      return {
        id: g.id,
        estado,
        eerr: g.eerrItems[0],
        cuota: g.sfItems[0],
        diferenciaClp: g.deltaClp,
        diferenciaUf: g.deltaUf,
        criterioMatch:
          g.scoreBreakdown.matchType === 'EXACTO' || g.scoreBreakdown.matchType === 'GRUPAL_PROYECTO'
            ? 'codigo_exacto'
            : g.scoreBreakdown.matchType === 'SUBSET_SUM' || g.scoreBreakdown.matchType === 'SCORING_PROBABLE'
            ? 'rut_monto'
            : 'sin_match',
        confianzaIa: g.scoreBreakdown.totalScore,
        explicacionIa: g.scoreBreakdown.explicacion,
        accionSugerida: accionMap[estado],
        nuevoMontoClp: g.totalEerrClp,
        esCuentaComercial: g.esCuentaComercial,
      };
    });

  // Cálculos de Resumen separando Venta Externa de Traspasos Internos y Anulados NC
  const gruposTi = groups.filter((g) => g.stage === 'TRASPASO_INTERNO');
  const gruposNc = groups.filter((g) => g.stage === 'ANULADO_NC');
  const gruposExternos = groups.filter((g) => g.stage !== 'TRASPASO_INTERNO' && g.stage !== 'ANULADO_NC');

  const montoTiEerr = gruposTi.reduce((acc, g) => acc + g.totalEerrClp, 0);
  const montoTiSf = gruposTi.reduce((acc, g) => acc + g.totalSfClp, 0);
  const montoNc = gruposNc.reduce((acc, g) => acc + g.totalEerrClp, 0);

  const totalEerrVentaExternaClp = gruposExternos.reduce((acc, g) => acc + g.totalEerrClp, 0);
  const totalSfVentaExternaClp = gruposExternos.reduce((acc, g) => acc + g.totalSfClp, 0);
  const brechaVentaExternaClp = totalEerrVentaExternaClp - totalSfVentaExternaClp;

  const totalEerrClp = periodEerr.reduce((acc, it) => acc + it.montoClp, 0);
  const totalSfClp = periodSf.reduce((acc, it) => acc + it.montoClp, 0);
  const difNetaClp = totalEerrClp - totalSfClp;

  const conteoGruposCuadrados = groups.filter((g) => g.stage === 'CUADRADOS').length;
  const conteoGruposDiferenciaMonto = groups.filter((g) => g.stage === 'DIFERENCIA_MONTO').length;
  const conteoGruposDesfaseTemporal = groups.filter((g) => g.stage === 'DESFASE_TEMPORAL').length;
  const conteoGruposMesaCirugia = groups.filter((g) => g.stage === 'MESA_CIRUGIA').length;

  const conteoNoProyectados = groups.filter((g) => g.stage === 'MESA_CIRUGIA' && g.eerrItems.length > 0 && g.sfItems.length === 0).length;
  const conteoNoFacturados = groups.filter((g) => g.stage === 'MESA_CIRUGIA' && g.sfItems.length > 0 && g.eerrItems.length === 0).length;

  // Facturas externas conciliadas (en CUADRADOS, DIFERENCIA_MONTO o DESFASE_TEMPORAL)
  const facturasExternasTotales = gruposExternos.reduce((acc, g) => acc + g.eerrItems.length, 0);
  const facturasExternasEmparejadas = groups
    .filter((g) => g.stage === 'CUADRADOS' || g.stage === 'DIFERENCIA_MONTO' || g.stage === 'DESFASE_TEMPORAL')
    .reduce((acc, g) => acc + g.eerrItems.length, 0);

  const pctCuadratura =
    facturasExternasTotales > 0
      ? Math.round((facturasExternasEmparejadas / facturasExternasTotales) * 100)
      : 100;

  const consolidadoDivisionActual =
    consolidadoDivisiones && division && division !== 'TODAS'
      ? consolidadoDivisiones[division.toUpperCase()]
      : undefined;

  const sfComercialesEnPeriodo = periodSf.filter(esCuentaComercialSalesforce);

  const resumen: ConciliacionResumen = {
    mes,
    anio,
    division,
    totalEerrClp,
    totalEerrUf: Number((totalEerrClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
    totalSalesforceClp: totalSfClp,
    totalSalesforceUf: Number((totalSfClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
    diferenciaNetaClp: difNetaClp,
    diferenciaNetaUf: Number((difNetaClp / UF_PROMEDIO_DEFAULT).toFixed(2)),
    conteoTotal: groups.length,
    conteoConciliados: conteoGruposCuadrados,
    conteoDiferenciaMonto: conteoGruposDiferenciaMonto,
    conteoDesfaseTemporal: conteoGruposDesfaseTemporal,
    conteoNoProyectados,
    conteoNoFacturados,
    porcentajeCuadratura: pctCuadratura,
    consolidadoDivisiones,
    consolidadoDivisionActual,
    filtroCuentaComercial,
    conteoCuentaComercial: sfComercialesEnPeriodo.length,
    montoCuentaComercialClp: sfComercialesEnPeriodo.reduce((acc, c) => acc + c.montoClp, 0),
    // Nuevos KPIs v2.0
    conteoGruposTotal: groups.length,
    conteoGruposCuadrados,
    conteoGruposDiferenciaMonto,
    conteoGruposDesfaseTemporal,
    conteoGruposMesaCirugia,
    conteoTraspasosInternos: gruposTi.length,
    montoTraspasosInternosClp: montoTiEerr,
    montoTraspasosInternosSfClp: montoTiSf,
    conteoAnuladosNc: gruposNc.length,
    montoAnuladosNcClp: montoNc,
    totalEerrVentaExternaClp,
    totalSfVentaExternaClp,
    brechaVentaExternaClp,
  };

  return {
    groups,
    oportunidadesClientes,
    items: itemsLegacy,
    resumen,
  };
}

/**
 * Fase 4 - IA Gemini On-Demand (Invocada únicamente bajo demanda sobre huérfanos en un solo batch JSON)
 */
export async function ejecutarSugerenciasIaOnDemand(params: {
  orphanEerr: EerrRegistro[];
  orphanSf: SalesforceCuotaRegistro[];
}): Promise<
  Array<{
    eerrId: string;
    sfId: string;
    confianza: number;
    explicacion: string;
  }>
> {
  const { orphanEerr, orphanSf } = params;
  if (orphanEerr.length === 0 || orphanSf.length === 0) return [];

  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim();

  if (!apiKey) return [];

  try {
    const ai = new GoogleGenAI({ apiKey });
    const promptText = `Eres un auditor contable-comercial senior de IDIEM / DGL especializado en conciliar EERR contra Salesforce.
Analiza los siguientes registros huérfanos y sugiere emparejamientos probables (evitando cruzar proyectos distintos de un mismo cliente corporativo como Codelco o BHP):

FACTURAS EERR HUÉRFANAS:
${JSON.stringify(
  orphanEerr.slice(0, 20).map((e) => ({
    id: e.id,
    rut: e.rut,
    cliente: e.razonSocial,
    ref: e.referenciaInterna,
    codigoNucleo: e.codigoNucleo,
    montoClp: e.montoClp,
  }))
)}

CUOTAS SALESFORCE HUÉRFANAS:
${JSON.stringify(
  orphanSf.slice(0, 20).map((s) => ({
    id: s.id,
    rut: s.rutEmpresa,
    cliente: s.cuenta,
    oportunidad: s.opportunityName,
    codigoNucleo: s.codigoNucleo,
    montoClp: s.montoClp,
  }))
)}

Responde ÚNICAMENTE en un arreglo JSON válido con este formato:
[
  {
    "eerrId": "string",
    "sfId": "string",
    "confianza": 85,
    "explicacion": "Justificación concisa en 1 línea"
  }
]`;

    const res = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
    });

    const rawJson = (res.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Error en ejecutarSugerenciasIaOnDemand:', err);
    return [];
  }
}
