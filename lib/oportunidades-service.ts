import fs from 'fs';
import path from 'path';
import {
  KpisOportunidades,
  MetaComercialPeriodo,
  OportunidadCRM,
} from './oportunidades-types';
import { getValidSalesforceClient } from './salesforce/salesforce-client';
import { sfRequest } from './salesforce/salesforce-sync-service';
import { extractProyectoCodigos } from './conciliador-service';
import { Cotizacion } from './types';
import initialDbData from '../data/db.json';

const UF_DEFAULT = 38500;
const SF_HISTORY_FILE = path.join(process.cwd(), 'data', 'salesforce-oportunidades-history.json');
const METAS_FILE = path.join(process.cwd(), 'data', 'metas-comerciales.json');

const NOMBRES_MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/**
 * Normaliza una etapa de Salesforce o del cotizador a estado macro: 'ganada' | 'perdida' | 'en_curso'
 */
export function clasificarEstadoOportunidad(etapa: string): 'ganada' | 'perdida' | 'en_curso' {
  const norm = (etapa || '').toLowerCase().trim();
  if (norm.includes('ganada') || norm.includes('closed won') || norm.includes('aprobada')) {
    return 'ganada';
  }
  if (norm.includes('perdida') || norm.includes('closed lost') || norm.includes('cancelada') || norm.includes('rechazada')) {
    return 'perdida';
  }
  return 'en_curso';
}

/**
 * Carga metas comerciales guardadas en disco o genera valores base por defecto
 */
export function getMetasComerciales(anio: number, division = 'DGL'): MetaComercialPeriodo[] {
  try {
    if (fs.existsSync(METAS_FILE)) {
      const raw = fs.readFileSync(METAS_FILE, 'utf-8');
      const list: MetaComercialPeriodo[] = JSON.parse(raw);
      const filtered = list.filter((m) => m.anio === anio && (division === 'TODAS' || m.division === division));
      if (filtered.length > 0) return filtered;
    }
  } catch (err) {
    console.warn('Error leyendo metas-comerciales.json:', err);
  }

  // Valores predeterminados referenciales para DGL (ej. $120M CLP / ~3.100 UF mensuales)
  const defaultMetaVentaClp = 120000000;
  const defaultMetaCotizacionClp = 250000000;

  const defaultList: MetaComercialPeriodo[] = [];
  for (let m = 1; m <= 12; m++) {
    defaultList.push({
      id: `meta-${division}-${anio}-${m}`,
      anio,
      mes: m,
      division,
      metaVentaClp: defaultMetaVentaClp,
      metaVentaUf: Math.round(defaultMetaVentaClp / UF_DEFAULT),
      metaCotizacionClp: defaultMetaCotizacionClp,
      metaCotizacionUf: Math.round(defaultMetaCotizacionClp / UF_DEFAULT),
      conteoCotizacionesMeta: 25,
      descripcion: `Meta estándar presupuestada ${NOMBRES_MESES[m]} ${anio}`,
    });
  }
  return defaultList;
}

/**
 * Guarda o actualiza metas comerciales en disco
 */
export function saveMetasComerciales(metasToSave: MetaComercialPeriodo[]): void {
  let existing: MetaComercialPeriodo[] = [];
  try {
    if (fs.existsSync(METAS_FILE)) {
      const raw = fs.readFileSync(METAS_FILE, 'utf-8');
      existing = JSON.parse(raw);
    }
  } catch {
    existing = [];
  }

  for (const meta of metasToSave) {
    const idx = existing.findIndex(
      (m) => m.anio === meta.anio && m.mes === meta.mes && m.division === meta.division
    );
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...meta };
    } else {
      existing.push(meta);
    }
  }

  fs.writeFileSync(METAS_FILE, JSON.stringify(existing, null, 2), 'utf-8');
}

import { getCotizacionesAsync } from './cotizaciones-db';

/**
 * Parsea de manera segura fechas en formatos DD-MM-YYYY, YYYY-MM-DD o ISO
 */
export function parseSafeFecha(rawDate?: string): { anio: number; mes: number; fechaIso: string } {
  if (!rawDate) {
    const now = new Date();
    return { anio: now.getFullYear(), mes: now.getMonth() + 1, fechaIso: now.toISOString().slice(0, 10) };
  }
  const str = String(rawDate).trim();
  // Formato DD-MM-YYYY o DD/MM/YYYY
  const dmy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = parseInt(dmy[3], 10);
    return { anio: year, mes: parseInt(month, 10), fechaIso: `${year}-${month}-${day}` };
  }
  // Formato YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = ymd[2].padStart(2, '0');
    const day = ymd[3].padStart(2, '0');
    return { anio: year, mes: parseInt(month, 10), fechaIso: `${year}-${month}-${day}` };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, fechaIso: d.toISOString().slice(0, 10) };
  }
  const now = new Date();
  return { anio: now.getFullYear(), mes: now.getMonth() + 1, fechaIso: now.toISOString().slice(0, 10) };
}

/**
 * Carga las cotizaciones reales del sistema (Supabase) y las transforma en OportunidadCRM (source: 'WEB_DGL')
 */
export async function getLocalCotizacionesAsOportunidades(): Promise<OportunidadCRM[]> {
  let localList: Cotizacion[] = [];

  try {
    localList = await getCotizacionesAsync(false);
  } catch (err) {
    console.warn('Fallo cargando cotizaciones desde Supabase / BD:', err);
    try {
      const raw = (initialDbData as any)?.cotizaciones || [];
      if (Array.isArray(raw)) localList.push(...raw);
    } catch {}
  }

  return localList.map((c) => {
    const { anio, mes, fechaIso } = parseSafeFecha(c.date || c.createdAt);
    const codInfo = extractProyectoCodigos(c.code || c.projectName || '');

    const montoClp = c.totalClp || Math.round((c.totalUf || 0) * (c.ufValue || UF_DEFAULT));
    const montoUf = c.totalUf || (montoClp > 0 ? Number((montoClp / (c.ufValue || UF_DEFAULT)).toFixed(2)) : 0);
    const estado = clasificarEstadoOportunidad(c.status || 'Borrador');

    return {
      id: `dgl-quote-${c.id}`,
      source: 'WEB_DGL',
      codigo: c.code || 'S/C',
      codigoNucleo: codInfo.codigoNucleo,
      nombre: c.projectName || c.reference || `Cotización ${c.code}`,
      cliente: c.clientName || 'Cliente Particular',
      rut: c.clientRut || '',
      etapa: c.status || 'Enviada',
      estado,
      probabilidadPct: estado === 'ganada' ? 100 : estado === 'perdida' ? 0 : 60,
      montoClp,
      montoUf,
      fechaCierre: fechaIso,
      mes,
      anio,
      comercial: c.commercialName || 'Diego Román',
      division: 'DGL',
      seccion: c.seccion || (c.centroCosto ? c.centroCosto.slice(0, 4) : '2340'),
      centroCosto: c.centroCosto,
      cuotasCount: c.cierreNegocio?.cuotasFacturacion || 1,
      salesforceId: (c as any).salesforceOpportunityId,
      cotizacionDglId: c.id,
      createdAt: c.createdAt || fechaIso,
      updatedAt: c.updatedAt || fechaIso,
    };
  });
}

/**
 * Carga oportunidades históricas sincronizadas de Salesforce desde archivo persistente
 */
export function getSavedSalesforceOportunidades(): OportunidadCRM[] {
  try {
    if (fs.existsSync(SF_HISTORY_FILE)) {
      const raw = fs.readFileSync(SF_HISTORY_FILE, 'utf-8');
      const list: OportunidadCRM[] = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    }
  } catch (err) {
    console.warn('Error leyendo salesforce-oportunidades-history.json:', err);
  }
  return [];
}

/**
 * Sincroniza e importa en vivo desde Salesforce todas las oportunidades del año especificado vía SOQL
 */
export async function syncSalesforceOportunidades(
  anio: number,
  division = 'DGL'
): Promise<{ count: number; items: OportunidadCRM[] }> {
  const { accessToken, instanceUrl } = await getValidSalesforceClient();

  const soql = encodeURIComponent(
    `SELECT Id, Name, StageName, Amount, CloseDate, Probability, Owner.Name, Account.Name, Account.Rut__c, (SELECT Id, Numero_de_cuota__c, Fecha_de_Pago__c, Monto__c FROM Cuotas_de_facturacion__r) FROM Opportunity WHERE CALENDAR_YEAR(CloseDate) = ${anio} ORDER BY CloseDate DESC LIMIT 2000`
  );

  const res = await sfRequest(instanceUrl, accessToken, `query?q=${soql}`);
  const records = res?.records || [];

  const syncedItems: OportunidadCRM[] = records.map((rec: any, idx: number) => {
    const oppName = rec.Name || 'Oportunidad sin nombre';
    const montoClp = Number(rec.Amount) || 0;
    const montoUf = Number((montoClp / UF_DEFAULT).toFixed(2));
    const closeDateStr = rec.CloseDate || `${anio}-01-15`;
    const d = new Date(closeDateStr);
    const mes = !isNaN(d.getMonth()) ? d.getMonth() + 1 : 1;
    const codInfo = extractProyectoCodigos(oppName);
    const etapa = rec.StageName || 'En Negociación';
    const cuotas = rec.Cuotas_de_facturacion__r?.records || [];

    return {
      id: `sf-${rec.Id || idx}`,
      source: 'SALESFORCE',
      codigo: codInfo.codigoCompleto || oppName,
      codigoNucleo: codInfo.codigoNucleo,
      nombre: oppName,
      cliente: rec.Account?.Name || 'Empresa sin razón social',
      rut: rec.Account?.Rut__c || '',
      etapa,
      estado: clasificarEstadoOportunidad(etapa),
      probabilidadPct: Number(rec.Probability) || (clasificarEstadoOportunidad(etapa) === 'ganada' ? 100 : 50),
      montoClp,
      montoUf,
      fechaCierre: closeDateStr,
      mes,
      anio,
      comercial: rec.Owner?.Name || 'Comercial Salesforce',
      division,
      cuotasCount: cuotas.length > 0 ? cuotas.length : 1,
      salesforceId: rec.Id,
      createdAt: closeDateStr,
      updatedAt: closeDateStr,
    };
  });

  // Combinar con historial guardado previamente para otros años/períodos
  const existing = getSavedSalesforceOportunidades();
  const removeIds = new Set(syncedItems.map((s) => s.salesforceId));
  const merged = [...syncedItems, ...existing.filter((e) => !removeIds.has(e.salesforceId))];

  fs.writeFileSync(SF_HISTORY_FILE, JSON.stringify(merged, null, 2), 'utf-8');

  return { count: syncedItems.length, items: syncedItems };
}

/**
 * Obtiene el universo consolidado de Oportunidades (Web DGL + Salesforce Histórico)
 * con cálculo dinámico de KPIs y Metas
 */
export async function getConsolidadoOportunidades(params: {
  anio: number;
  mes?: number; // 0 o undefined para acumulado del año completo
  division?: string;
  comercial?: string;
  source?: 'TODOS' | 'WEB_DGL' | 'SALESFORCE';
  estado?: 'TODOS' | 'ganada' | 'perdida' | 'en_curso';
  search?: string;
}): Promise<{
  items: OportunidadCRM[];
  kpis: KpisOportunidades;
  metas: MetaComercialPeriodo[];
}> {
  const {
    anio,
    mes = 0,
    division = 'DGL',
    comercial = 'TODOS',
    source = 'TODOS',
    estado = 'TODOS',
    search = '',
  } = params;

  // 1. Cargar fuentes
  const [localOpps, sfOpps] = await Promise.all([
    getLocalCotizacionesAsOportunidades(),
    Promise.resolve(getSavedSalesforceOportunidades()),
  ]);

  // Evitar duplicar: si una cotización local ya tiene salesforceId y está en sfOpps, priorizamos la versión local (Web DGL)
  const localSfIds = new Set(localOpps.map((l) => l.salesforceId).filter(Boolean));
  const uniqueSfOpps = sfOpps.filter((s) => !localSfIds.has(s.salesforceId));

  const allConsolidated = [...localOpps, ...uniqueSfOpps];

  // 2. Filtrar por año y división
  const yearItems = allConsolidated.filter(
    (o) => o.anio === anio && (division === 'TODAS' || o.division === division)
  );

  // 3. Filtrar para la vista de tabla según parámetros seleccionados
  const q = search.trim().toLowerCase();
  const filteredItems = yearItems.filter((o) => {
    if (mes !== 0 && o.mes !== mes) return false;
    if (source !== 'TODOS' && o.source !== source) return false;
    if (estado !== 'TODOS' && o.estado !== estado) return false;
    if (comercial !== 'TODOS' && o.comercial !== comercial) return false;
    if (q) {
      return (
        o.nombre.toLowerCase().includes(q) ||
        o.cliente.toLowerCase().includes(q) ||
        o.rut.toLowerCase().includes(q) ||
        o.codigo.toLowerCase().includes(q) ||
        o.comercial.toLowerCase().includes(q)
      );
    }
    return true;
  }).sort((a, b) => new Date(b.fechaCierre).getTime() - new Date(a.fechaCierre).getTime());

  // 4. Calcular KPIs para el período (mes específico o acumulado del año)
  const targetPeriodItems = yearItems.filter((o) => (mes === 0 ? true : o.mes === mes));
  const metas = getMetasComerciales(anio, division);

  // Metas aplicables al período
  const periodMetas = metas.filter((m) => (mes === 0 ? true : m.mes === mes));
  const metaVentaClp = periodMetas.reduce((acc, m) => acc + m.metaVentaClp, 0);
  const metaVentaUf = periodMetas.reduce((acc, m) => acc + m.metaVentaUf, 0);
  const metaCotizacionClp = periodMetas.reduce((acc, m) => acc + m.metaCotizacionClp, 0);
  const metaCotizacionUf = periodMetas.reduce((acc, m) => acc + m.metaCotizacionUf, 0);

  let conteoGanadas = 0;
  let conteoEnCurso = 0;
  let conteoPerdidas = 0;
  let montoGanadoClp = 0;
  let montoEnCursoClp = 0;
  let montoCotizadoTotalClp = 0;

  const comercialMap = new Map<
    string,
    {
      comercial: string;
      totalOpps: number;
      ganadasCount: number;
      montoGanadoClp: number;
      enCursoCount: number;
      montoEnCursoClp: number;
    }
  >();

  const etapaMap = new Map<
    string,
    { etapa: string; estado: 'ganada' | 'perdida' | 'en_curso'; count: number; montoClp: number }
  >();

  for (const o of targetPeriodItems) {
    montoCotizadoTotalClp += o.montoClp;

    if (o.estado === 'ganada') {
      conteoGanadas++;
      montoGanadoClp += o.montoClp;
    } else if (o.estado === 'perdida') {
      conteoPerdidas++;
    } else {
      conteoEnCurso++;
      montoEnCursoClp += o.montoClp;
    }

    // Agrupación por comercial
    const comName = o.comercial || 'Sin asignar';
    const comData = comercialMap.get(comName) || {
      comercial: comName,
      totalOpps: 0,
      ganadasCount: 0,
      montoGanadoClp: 0,
      enCursoCount: 0,
      montoEnCursoClp: 0,
    };
    comData.totalOpps++;
    if (o.estado === 'ganada') {
      comData.ganadasCount++;
      comData.montoGanadoClp += o.montoClp;
    } else if (o.estado === 'en_curso') {
      comData.enCursoCount++;
      comData.montoEnCursoClp += o.montoClp;
    }
    comercialMap.set(comName, comData);

    // Agrupación por etapa
    const etapaData = etapaMap.get(o.etapa) || {
      etapa: o.etapa,
      estado: o.estado,
      count: 0,
      montoClp: 0,
    };
    etapaData.count++;
    etapaData.montoClp += o.montoClp;
    etapaMap.set(o.etapa, etapaData);
  }

  const totalCerradas = conteoGanadas + conteoPerdidas;
  const tasaCierrePct = totalCerradas > 0 ? Math.round((conteoGanadas / totalCerradas) * 100) : 0;
  const montoGanadoUf = Number((montoGanadoClp / UF_DEFAULT).toFixed(2));
  const montoEnCursoUf = Number((montoEnCursoClp / UF_DEFAULT).toFixed(2));
  const montoCotizadoTotalUf = Number((montoCotizadoTotalClp / UF_DEFAULT).toFixed(2));

  const cumplimientoVentaPct =
    metaVentaClp > 0 ? Math.round((montoGanadoClp / metaVentaClp) * 100) : 0;
  const gapVentaClp = montoGanadoClp - metaVentaClp;
  const gapVentaUf = Number((gapVentaClp / UF_DEFAULT).toFixed(2));

  const cumplimientoCotizacionPct =
    metaCotizacionClp > 0 ? Math.round((montoCotizadoTotalClp / metaCotizacionClp) * 100) : 0;
  const gapCotizacionClp = montoCotizadoTotalClp - metaCotizacionClp;

  const ticketPromedioClp =
    conteoGanadas > 0 ? Math.round(montoGanadoClp / conteoGanadas) : 0;
  const ticketPromedioUf = Number((ticketPromedioClp / UF_DEFAULT).toFixed(2));

  // Evolución mensual de los 12 meses del año
  const evolucionMeses = [];
  for (let m = 1; m <= 12; m++) {
    const monthOpps = yearItems.filter((o) => o.mes === m);
    const mGanado = monthOpps
      .filter((o) => o.estado === 'ganada')
      .reduce((acc, o) => acc + o.montoClp, 0);
    const mEnCurso = monthOpps
      .filter((o) => o.estado === 'en_curso')
      .reduce((acc, o) => acc + o.montoClp, 0);
    const targetMeta = metas.find((meta) => meta.mes === m);
    const mMetaClp = targetMeta?.metaVentaClp || 0;
    const mCumplimiento = mMetaClp > 0 ? Math.round((mGanado / mMetaClp) * 100) : 0;

    evolucionMeses.push({
      mes: m,
      nombreMes: NOMBRES_MESES[m].slice(0, 3),
      ganadoClp: mGanado,
      ganadoUf: Number((mGanado / UF_DEFAULT).toFixed(1)),
      enCursoClp: mEnCurso,
      enCursoUf: Number((mEnCurso / UF_DEFAULT).toFixed(1)),
      metaVentaClp: mMetaClp,
      metaVentaUf: Number((mMetaClp / UF_DEFAULT).toFixed(1)),
      cumplimientoPct: mCumplimiento,
    });
  }

  const kpis: KpisOportunidades = {
    anio,
    mes,
    totalOportunidades: targetPeriodItems.length,
    conteoGanadas,
    conteoEnCurso,
    conteoPerdidas,
    tasaCierrePct,
    montoGanadoClp,
    montoGanadoUf,
    montoEnCursoClp,
    montoEnCursoUf,
    montoCotizadoTotalClp,
    montoCotizadoTotalUf,
    ticketPromedioClp,
    ticketPromedioUf,
    metaVentaClp,
    metaVentaUf,
    cumplimientoVentaPct,
    gapVentaClp,
    gapVentaUf,
    metaCotizacionClp,
    metaCotizacionUf,
    cumplimientoCotizacionPct,
    gapCotizacionClp,
    porComercial: Array.from(comercialMap.values()).map((c) => ({
      ...c,
      montoGanadoUf: Number((c.montoGanadoClp / UF_DEFAULT).toFixed(1)),
    })),
    porEtapa: Array.from(etapaMap.values()).map((e) => ({
      ...e,
      montoUf: Number((e.montoClp / UF_DEFAULT).toFixed(1)),
    })),
    evolucionMeses,
  };

  return {
    items: filteredItems,
    kpis,
    metas,
  };
}

