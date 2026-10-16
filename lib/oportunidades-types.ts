export type OrigenOportunidad = 'WEB_DGL' | 'SALESFORCE';

export type EstadoNegocioOportunidad = 'ganada' | 'perdida' | 'en_curso';

export interface OportunidadCRM {
  id: string;
  source: OrigenOportunidad;
  codigo: string;
  codigoNucleo?: string;
  nombre: string;
  cliente: string;
  rut: string;
  etapa: string;
  estado: EstadoNegocioOportunidad;
  probabilidadPct: number;
  montoClp: number;
  montoUf: number;
  fechaCierre: string; // YYYY-MM-DD
  mes: number;
  anio: number;
  comercial: string;
  division: string;
  seccion?: string;
  centroCosto?: string;
  cuotasCount: number;
  salesforceId?: string;
  cotizacionDglId?: string; // ID local para abrir cotización técnica si nació en el portal
  createdAt: string;
  updatedAt: string;
}

export interface MetaComercialPeriodo {
  id: string;
  anio: number;
  mes: number; // 1-12, o 0 para meta anual
  division: string;
  metaCotizacionClp: number;
  metaCotizacionUf: number;
  metaVentaClp: number;
  metaVentaUf: number;
  conteoCotizacionesMeta?: number;
  descripcion?: string;
}

export interface KpisOportunidades {
  anio: number;
  mes: number; // 0 si es acumulado del año
  totalOportunidades: number;
  conteoGanadas: number;
  conteoEnCurso: number;
  conteoPerdidas: number;
  tasaCierrePct: number;
  montoGanadoClp: number;
  montoGanadoUf: number;
  montoEnCursoClp: number;
  montoEnCursoUf: number;
  montoCotizadoTotalClp: number;
  montoCotizadoTotalUf: number;
  ticketPromedioClp: number;
  ticketPromedioUf: number;
  // Comparativa con Metas
  metaVentaClp: number;
  metaVentaUf: number;
  cumplimientoVentaPct: number;
  gapVentaClp: number;
  gapVentaUf: number;
  metaCotizacionClp: number;
  metaCotizacionUf: number;
  cumplimientoCotizacionPct: number;
  gapCotizacionClp: number;
  // Desglose por Comercial
  porComercial: Array<{
    comercial: string;
    totalOpps: number;
    ganadasCount: number;
    montoGanadoClp: number;
    montoGanadoUf: number;
    enCursoCount: number;
    montoEnCursoClp: number;
    cotizadoTotalClp: number;
  }>;
  // Desglose por Etapa
  porEtapa: Array<{
    etapa: string;
    estado: EstadoNegocioOportunidad;
    count: number;
    montoClp: number;
    montoUf: number;
  }>;
  // Años disponibles creados en metas
  aniosDisponibles: number[];
  // Evolución Mes a Mes del Año para Ventas y Cotizaciones
  evolucionMeses: Array<{
    mes: number;
    nombreMes: string;
    ganadoClp: number;
    ganadoUf: number;
    enCursoClp: number;
    enCursoUf: number;
    metaVentaClp: number;
    metaVentaUf: number;
    cumplimientoVentaPct: number;
    cotizadoTotalClp: number;
    cotizadoTotalUf: number;
    metaCotizacionClp: number;
    metaCotizacionUf: number;
    cumplimientoCotizacionPct: number;
  }>;
}

