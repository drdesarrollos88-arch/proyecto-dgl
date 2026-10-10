export type TipoComprobanteEerr = 'facturacion' | 'traspaso_interno' | 'provision' | 'reversion' | 'otro';

export type EstadoConciliacion =
  | 'conciliado'           // 🟢 Cuadre exacto de monto y mes
  | 'diferencia_monto'     // 🟡 Mismo negocio/mes pero monto difiere
  | 'desfase_temporal'     // 🟠 Misma oportunidad pero facturada en mes distinto
  | 'no_proyectado'        // 🔵 Factura en EERR sin cuota en Salesforce
  | 'no_facturado';        // 🔴 Cuota en Salesforce sin factura en EERR

export type AccionConciliacion =
  | 'aceptar_match'
  | 'ajustar_cuota'
  | 'mover_cuota'
  | 'crear_cuota'
  | 'eliminar_cuota'
  | 'postergar_mes'
  | 'marcar_pendiente';

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
  referenciaExterna: string; // N° Factura o Comprobante
  glosa: string;
  cuentaContable: string;
  clasificacion: string;
  tipoServicio: string;
  montoClp: number;
  montoUfAprox: number;
}

export interface SalesforceCuotaRegistro {
  id: string; // ID Salesforce o temporal
  opportunityId?: string;
  opportunityName: string;
  codigoOportunidadExtraido?: string;
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
  traspasoInterno: boolean;
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
}

