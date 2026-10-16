export type TipoComprobanteEerr =
  | 'facturacion'
  | 'traspaso_interno'
  | 'provision'
  | 'reversion'
  | 'nota_credito'
  | 'otro';

export type EstadoConciliacion =
  | 'conciliado'           // 🟢 Cuadre exacto de monto y mes
  | 'diferencia_monto'     // 🟡 Mismo negocio/mes pero monto difiere
  | 'desfase_temporal'     // 🟠 Misma oportunidad pero facturada en mes distinto
  | 'no_proyectado'        // 🔵 Factura en EERR sin cuota en Salesforce
  | 'no_facturado';        // 🔴 Cuota en Salesforce sin factura en EERR

export type WorkflowStage =
  | 'CUADRADOS'
  | 'DIFERENCIA_MONTO'
  | 'DESFASE_TEMPORAL'
  | 'MESA_CIRUGIA'
  | 'TRASPASO_INTERNO'
  | 'ANULADO_NC';

export type MatchType =
  | 'EXACTO'
  | 'GRUPAL_PROYECTO'
  | 'SUBSET_SUM'
  | 'SCORING_PROBABLE'
  | 'MANUAL'
  | 'HUERFANO';

export type AccionConciliacion =
  | 'aceptar_match'
  | 'ajustar_cuota'
  | 'mover_cuota'
  | 'crear_cuota'
  | 'eliminar_cuota'
  | 'postergar_mes'
  | 'marcar_pendiente';

export interface ScoreBreakdown {
  totalScore: number;      // 0 a 100
  codigoScore: number;     // max 45 (o -100 si colisionan códigos distintos)
  montoScore: number;      // max 25
  textoScore: number;      // max 15
  tiempoScore: number;     // max 10
  seccionScore: number;    // max 5
  matchType: MatchType;
  explicacion: string;
}

export interface EerrRegistro {
  id: string;
  division: string;
  seccion: string;
  centroCosto: string | number;
  fecha: string; // YYYY-MM-DD
  mes: number;   // 1-12
  anio: number;  // ej. 2026
  comprobante: string;
  tipo: TipoComprobanteEerr;
  rut: string;
  razonSocial: string;
  referenciaInterna: string;
  codigoOportunidadExtraido?: string;
  codigoNucleo?: string;
  referenciaExterna: string; // N° Factura o Comprobante
  glosa: string;
  cuentaContable: string;
  clasificacion: string;
  tipoServicio: string;
  montoClp: number;
  montoUfAprox: number;
  esNotaCredito?: boolean;
  anuladoPorNcId?: string;
}

export interface SalesforceCuotaRegistro {
  id: string; // ID Salesforce o temporal
  opportunityId?: string;
  opportunityName: string;
  codigoOportunidadExtraido?: string;
  codigoNucleo?: string;
  etapa: string;
  numeroCuota: number;
  fechaPago: string; // YYYY-MM-DD
  mes: number;       // 1-12
  anio: number;      // ej. 2026
  montoClp: number;
  montoUf: number;
  rutEmpresa: string;
  cuenta: string;
  division: string;
  seccion?: string;
  unidad?: string;
  comercialResponsable?: string;
  traspasoInterno: boolean;
  esCuentaComercial?: boolean;
}

export interface CandidatoSugerido {
  targetId: string; // ID de cuota SF o factura EERR
  targetType: 'SF_CUOTA' | 'EERR_FACTURA';
  titulo: string;
  rut: string;
  cliente: string;
  montoClp: number;
  fecha: string;
  mes: number;
  anio: number;
  codigoExtraido?: string;
  codigoNucleo?: string;
  scoreBreakdown: ScoreBreakdown;
}

export interface OportunidadClienteRef {
  opportunityId: string; // Obligatorio para CREATE_CUOTA
  opportunityName: string;
  codigoExtraido?: string;
  codigoNucleo?: string;
  rutEmpresa: string;
  cuenta: string;
  etapa: string;
  seccion?: string;
  unidad?: string;
  comercialResponsable?: string;
}

export interface ConciliacionGroup {
  id: string;
  stage: WorkflowStage;
  cardinalidad: '1:1' | '1:N' | 'N:1' | 'N:M' | '1:0' | '0:1';
  rut: string;
  cliente: string;
  codigoProyecto?: string;
  codigoNucleo?: string;
  eerrItems: EerrRegistro[];
  sfItems: SalesforceCuotaRegistro[];
  totalEerrClp: number;
  totalEerrUf: number;
  totalSfClp: number;
  totalSfUf: number;
  deltaClp: number; // totalEerrClp - totalSfClp
  deltaPct: number; // % variación respecto a SF
  deltaUf: number;
  scoreBreakdown: ScoreBreakdown;
  candidatosSugeridos?: CandidatoSugerido[];
  esCuentaComercial?: boolean;
}

/**
 * Uniones discriminadas estrictas para el Carrito de Acciones (Staging Cart).
 * REGLA DURA: En CREATE_CUOTA, `opportunityId` es estrictamente obligatorio (non-nullable).
 */
export type StagingAction =
  | {
      id: string;
      type: 'UPDATE_MONTO';
      groupId?: string;
      cuotaId: string;
      opportunityId?: string;
      opportunityName?: string;
      cliente?: string;
      rut?: string;
      montoAnterior: number;
      montoNuevo: number;
      motivo: string;
    }
  | {
      id: string;
      type: 'UPDATE_FECHA';
      groupId?: string;
      cuotaId: string;
      opportunityId?: string;
      opportunityName?: string;
      cliente?: string;
      rut?: string;
      montoClp?: number;
      fechaAnterior: string;
      fechaNueva: string;
      motivo: string;
    }
  | {
      id: string;
      type: 'CREATE_CUOTA';
      groupId?: string;
      opportunityId: string; // REGLA DURA: Estrictamente obligatorio
      opportunityName: string;
      cliente?: string;
      rut?: string;
      montoClp: number;
      fechaPago: string;
      glosaReferencia: string;
      eerrIds: string[];
    };

export interface ApplyActionLog {
  actionId: string;
  type: StagingAction['type'];
  status: 'SUCCESS' | 'SIMULATED_LOCAL' | 'ERROR';
  targetId: string;
  descripcion: string;
  valorAnterior: string;
  valorNuevo: string;
  errorDetalle?: string;
}

export interface ConciliacionItem {
  id: string;
  estado: EstadoConciliacion;
  eerr?: EerrRegistro;
  cuota?: SalesforceCuotaRegistro;
  diferenciaClp: number;
  diferenciaUf: number;
  criterioMatch: 'codigo_exacto' | 'rut_monto' | 'ia_semantico' | 'manual' | 'sin_match';
  confianzaIa?: number; // 0 - 100
  explicacionIa?: string;
  accionSugerida: AccionConciliacion;
  accionAplicada?: AccionConciliacion;
  mesDestinoPostergar?: number;
  anioDestinoPostergar?: number;
  nuevoMontoClp?: number;
  justificacion?: string;
  esCuentaComercial?: boolean;
}

export type FiltroCuentaComercial = 'todas' | 'excluir' | 'solo';

export interface ConsolidadoDivisionControl {
  division: string;
  backlogSalesforceClp: number;
  facturacionEerrClp: number;
  traspasosEerrClp: number;
  totalIngresosEerrClp: number;
  diferenciaClp: number;
}

export interface ConciliacionResumen {
  mes: number;
  anio: number;
  division: string;
  totalEerrClp: number;
  totalEerrUf: number;
  totalSalesforceClp: number;
  totalSalesforceUf: number;
  diferenciaNetaClp: number;
  diferenciaNetaUf: number;
  conteoTotal: number;
  conteoConciliados: number;
  conteoDiferenciaMonto: number;
  conteoDesfaseTemporal: number;
  conteoNoProyectados: number;
  conteoNoFacturados: number;
  porcentajeCuadratura: number;
  consolidadoDivisiones?: Record<string, ConsolidadoDivisionControl>;
  consolidadoDivisionActual?: ConsolidadoDivisionControl;
  filtroCuentaComercial?: FiltroCuentaComercial;
  conteoCuentaComercial?: number;
  montoCuentaComercialClp?: number;
  // Métricas v2.0
  conteoGruposTotal?: number;
  conteoGruposCuadrados?: number;
  conteoGruposDiferenciaMonto?: number;
  conteoGruposDesfaseTemporal?: number;
  conteoGruposMesaCirugia?: number;
  conteoTraspasosInternos?: number;
  montoTraspasosInternosClp?: number;
  montoTraspasosInternosSfClp?: number;
  conteoAnuladosNc?: number;
  montoAnuladosNcClp?: number;
  totalEerrVentaExternaClp?: number;
  totalSfVentaExternaClp?: number;
  brechaVentaExternaClp?: number;
}
