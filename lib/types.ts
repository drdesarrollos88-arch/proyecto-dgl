export type UserRole = 'superadmin' | 'admin' | 'comercial';

// Lista oficial de permisos granulares del sistema
export const PERMISSION_KEYS = [
  // Módulo Cotizador
  'cotizador.ver',
  'cotizador.descargar_borrador',
  'cotizador.descargar_definitivo',

  // Módulo Cotizaciones (Historial & Métricas)
  'cotizaciones.ver_todas',
  'cotizaciones.eliminar',

  // Módulo Ventas & Salesforce (CRM)
  'ventas.ver',
  'ventas.cierre_oportunidad',
  'ventas.conciliador',
  'oportunidades.metas',
  'conciliador.aplicar',

  // Módulo Tarifario Oficial
  'tarifario.ver',
  'tarifario.descargar',
  'tarifario.editar',
  'tarifario.estructura',

  // Módulo Clientes, Contactos y Proyectos
  'clientes.gestionar',
  'clientes.importar',

  // Módulo Inteligencia Artificial (Asistente & RAG)
  'ia.asistente',
  'configuracion.aprendizaje',
  'configuracion.bibliografia',

  // Módulo Tickets & Soporte Técnico
  'tickets.ver',
  'tickets.administrar',

  // Módulo Auditoría & Trazabilidad
  'auditoria.ver',
  'auditoria.exportar',

  // Módulo Configuración Oficial
  'configuracion.correlativos',
  'configuracion.formato',

  // Módulo Usuarios y Seguridad (RBAC)
  'usuarios.administrar',
] as const;

export type PermissionKey = typeof PERMISSION_KEYS[number];

// Estructura de un perfil de usuario con permisos asociados
export interface UserProfile {
  id: string; // Identificador único: 'admin', 'comercial_senior', etc.
  name: string; // Nombre visible del perfil (ej. "Comercial Senior")
  description: string; // Descripción del perfil y sus atribuciones
  isSystem?: boolean; // Indica si es un perfil base del sistema no eliminable
  permissions: PermissionKey[]; // Lista de permisos habilitados
  createdAt: string;
  updatedAt?: string;
}

// Estructura oficial División DGL IDIEM
/**
 * Detecta si un RUT corresponde a una cuenta internacional o extranjera
 * (Salesforce asigna internamente el comodín 5555555-5 o derivados para clientes foráneos).
 */
export function isForeignRut(rut?: string | null): boolean {
  if (!rut) return false;
  const raw = String(rut).trim().toUpperCase();
  if (['EXTRANJERO', 'INTERNACIONAL', 'EXTERIOR', 'NO APLICA', 'N/A', 'SIN RUT', 'PASAPORTE', 'EXTRANJERA'].includes(raw)) {
    return true;
  }
  const clean = raw.replace(/[^0-9K]/g, '');
  if (/^5{6,9}[0-9K]?$/.test(clean)) return true;
  if (clean.startsWith('5555555')) return true;
  return false;
}

export const SECCIONES_DGL = [
  'SGL - Sección Laboratorio de Geotecnia',
  'SLGP - Sección Laboratorio de Geomecánico Prat',
  'Sin sección DGL',
] as const;

export type SeccionDGL = typeof SECCIONES_DGL[number];

export interface DGLUnidadItem {
  code: string;
  name: string;
  seccion: SeccionDGL;
  seccionSfCode: 'SLG' | 'SLGP' | 'DGL';
}

export const DGL_UNIDADES: DGLUnidadItem[] = [
  // SGL - Sección Laboratorio de Geotecnia
  { code: '2340', name: '2340 UEB - Unidad Ensayos Básicos', seccion: 'SGL - Sección Laboratorio de Geotecnia', seccionSfCode: 'SLG' },
  { code: '2341', name: '2341 UGE - Unidad Ensayos Geotécnicos Especiales', seccion: 'SGL - Sección Laboratorio de Geotecnia', seccionSfCode: 'SLG' },
  { code: '2344', name: '2344 UGA - Unidad Geotecnia Antofagasta', seccion: 'SGL - Sección Laboratorio de Geotecnia', seccionSfCode: 'SLG' },
  // SLGP - Sección Laboratorio de Geomecánico Prat
  { code: '1817', name: '1817 UGB - Unidad Ensayos Geotécnicos Básicos', seccion: 'SLGP - Sección Laboratorio de Geomecánico Prat', seccionSfCode: 'SLGP' },
  { code: '2339', name: '2339 UER - Unidad Ensayos Rocas', seccion: 'SLGP - Sección Laboratorio de Geomecánico Prat', seccionSfCode: 'SLGP' },
  // Sin sección DGL
  { code: '3340', name: '3340 USM - Unidad Sondajes Menores', seccion: 'Sin sección DGL', seccionSfCode: 'DGL' },
];

export const CENTROS_DE_COSTO = [
  '2340 - Ensayos Básicos (UEB)',
  '2341 - Ensayos Geotécnicos Especiales (UGE)',
  '2344 - Geotecnia Antofagasta (UGA)',
  '1817 - Ensayos Geotécnicos Básicos (UGB)',
  '2339 - Ensayos Rocas (UER)',
  '3340 - Sondajes Menores (USM)',
] as const;

export type CentroDeCosto = typeof CENTROS_DE_COSTO[number];

/**
 * Lista de prefijos de otras divisiones de IDIEM que NO corresponden a DGL.
 * DGL (División Geotecnia y Laboratorio) es la única división válida para este sistema.
 */
const NON_DGL_DIVISION_REGEX = /\b(?:PR|PRE|OT|COT|PROY)[\s.\-_]+(DEP|DPR|DGI|DHC|DES|DHI|DTC|DCO|GCO|DIC|DIO|UCF|DAC|DOH|DDA|DMC|DAS|DCT|DED|DCL|DTI)\b/i;

/**
 * Centros de costo oficiales de la División DGL (Geotecnia y Laboratorio):
 * 2340: Ensayos Básicos (UEB)
 * 2341: Ensayos Geotécnicos Especiales (UGE)
 * 2344: Geotecnia Antofagasta (UGA)
 * 1817: Ensayos Geotécnicos Básicos (UGB)
 * 2339: Ensayos Rocas (UER)
 * 3340: Sondajes Menores (USM)
 */
export const DGL_CENTROS_COSTO_SET = new Set(['2340', '2341', '2344', '1817', '2339', '3340']);

/**
 * Valida estrictamente si una oportunidad o cuota de Salesforce pertenece a la División DGL
 * (División Geotecnia y Laboratorio de IDIEM), descartando taxativamente cualquier registro de otras divisiones
 * (como Estructuras, Civil, Pavimentos, Hidráulica, Procesos, Materiales, Asfaltos, etc.).
 */
export function isOportunidadDgl(item?: {
  Name?: string | null;
  name?: string | null;
  nombre?: string | null;
  codigo?: string | null;
  Division__c?: string | null;
  division?: string | null;
  Unidad__c?: string | null;
  Seccion__c?: string | null;
  seccion?: string | null;
  centroCosto?: string | null;
  source?: string | null;
  id?: string | null;
} | null): boolean {
  if (!item) return false;

  const rawName = String(
    item.Name ||
    item.name ||
    item.nombre ||
    item.codigo ||
    ''
  ).trim().toUpperCase();
  const rawDivisionSf = String(item.Division__c || item.division || '').trim().toUpperCase();
  const rawUnidad = String(item.Unidad__c || item.centroCosto || '').trim().toUpperCase();
  const rawSeccion = String(item.Seccion__c || item.seccion || '').trim().toUpperCase();
  const source = String(item.source || '').trim().toUpperCase();

  // 1. REGLA DE ORO POSITIVA: Si el prefijo o código contiene DGL explícitamente
  // (ej. PR.DGL..., DGL.PRE..., OT.DGL..., .DGL., -DGL-, o palabra DGL)
  const isExplicitDgl =
    /\b(?:PR|PRE|OT|COT|PROY)[\s.\-_]*DGL\b/i.test(rawName) ||
    /^DGL[\s.\-_]+/i.test(rawName) ||
    rawName.includes('.DGL.') ||
    rawName.includes('-DGL-') ||
    rawName.includes(' DGL ');

  if (isExplicitDgl) {
    return true;
  }

  // 2. DESCALIFICACIÓN INMEDIATA POR OTRA DIVISIÓN EXPLÍCITA DE IDIEM
  // Ejemplos: PR.DEP., PR.DPR., PR.DGI., PR.DHC., DEP.PRE., etc.
  const otherDivRegex = /\b(?:PR|PRE|OT|COT|PROY)[\s.\-_]+(DEP|DPR|DGI|DHC|DES|DHI|DTC|DCO|GCO|DIC|DIO|UCF|DAC|DOH|DDA|DMC|DAS|DCT|DED|DCL|DTI)\b/i;
  const startOtherDivRegex = /^(DEP|DPR|DGI|DHC|DES|DHI|DTC|DCO|GCO|DIC|DIO|UCF|DAC|DOH|DDA|DMC|DAS|DCT|DED|DCL|DTI)[\s.\-_]+/i;
  if (otherDivRegex.test(rawName) || startOtherDivRegex.test(rawName)) {
    return false;
  }

  // Si el campo nativo de Salesforce Division__c dice explícitamente otra división distinta a DGL
  if (rawDivisionSf && rawDivisionSf !== 'DGL' && !rawDivisionSf.includes('GEOTECN')) {
    return false;
  }

  // Si tiene explícitamente la división DGL confirmada (por Salesforce o local) y no fue descalificado por otra división
  if (rawDivisionSf === 'DGL' || rawDivisionSf.includes('GEOTECN')) {
    return true;
  }

  // 3. COMPROBACIÓN POSITIVA POR CENTRO DE COSTO OFICIAL DGL (2340, 2341, 2344, 1817, 2339, 3340)
  const hasDglCc = Array.from(DGL_CENTROS_COSTO_SET).some((cc) => {
    if (rawUnidad.includes(cc)) return true;
    const regex = new RegExp(`(?:^|[^0-9])${cc}(?:[^0-9]|$)`);
    return regex.test(rawName);
  });

  // 4. COMPROBACIÓN POSITIVA POR SECCIÓN OFICIAL DGL (SLG, SLGP, SGL, DGL)
  const hasDglSeccion = ['SLG', 'SLGP', 'SGL', 'DGL'].some((sec) => rawSeccion.includes(sec));

  // 5. COMPROBACIÓN POSITIVA POR PALABRAS CLAVE O ORIGEN WEB
  const hasKeywords =
    rawName.includes('GEOTECN') ||
    rawName.includes('MECANICA DE SUELOS') ||
    rawName.includes('LABORATORIO SUELOS');

  const isWebDgl = source === 'WEB_DGL' || String(item.id || '').startsWith('dgl-quote-');

  return hasDglCc || hasDglSeccion || hasKeywords || isWebDgl;
}

// Clasificación de Proyectos para Salesforce IDIEM
export const SECTORES_PROYECTO = [
  'Inmobiliario',
  'Minería',
  'Energía',
  'Industrial',
  'Forestal',
  'Puertos',
  'Retail',
  'Sector Públicas',
  'Tecnología',
  'Otros',
] as const;
export type SectorProyecto = typeof SECTORES_PROYECTO[number];

export const SUBSECTORES_PROYECTO = [
  'No Aplica',
  'Aeropuerto',
  'Aguas',
  'Edificios públicos',
  'Educación',
  'Embalse',
  'Fuerzas armadas',
  'Infraestructura urbana (parques, estadios, otros)',
  'Obras hidráulicas',
  'Obras municipales',
  'Obras viales',
  'Otros',
  'Poder judicial',
  'Puentes',
  'Puertos',
  'Salud',
  'Vivienda pública',
  'Metro',
  'EFE',
  'OPEX',
  'CAPEX',
] as const;
export type SubsectorProyecto = typeof SUBSECTORES_PROYECTO[number];

export const ZONAS_PROYECTO = [
  'Región Metropolitana',
  'Zona Norte',
  'Zona Centro',
  'Zona Sur',
  'Nacional',
  'Extranjero',
] as const;
export type ZonaProyecto = typeof ZONAS_PROYECTO[number];

export function getDGLInfoByCC(ccStr: string): {
  unitCode: string;
  seccion: SeccionDGL;
  seccionSfCode: 'SLG' | 'SLGP' | 'DGL';
  fullName: string;
} {
  const match = (ccStr || '').match(/^(\d{4})/);
  const code = match ? match[1] : '2340';
  const found = DGL_UNIDADES.find((u) => u.code === code);
  if (found) {
    return {
      unitCode: found.code,
      seccion: found.seccion,
      seccionSfCode: found.seccionSfCode,
      fullName: found.name,
    };
  }
  return {
    unitCode: code,
    seccion: 'SGL - Sección Laboratorio de Geotecnia',
    seccionSfCode: 'SLG',
    fullName: `${code} - Centro de Costo`,
  };
}

export interface User {
  id: string;
  rut: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  profileId?: string; // Perfil de usuario asignado
  customPermissions?: PermissionKey[]; // Permisos personalizados individuales
  commercialTitle?: string;
  phone?: string;
  commercialInitials?: string;
  signature?: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  rut: string;
  name: string;
  email: string;
  role: UserRole;
  profileId?: string;
  permissions?: PermissionKey[]; // Permisos efectivos calculados en sesión
  commercialTitle?: string;
  phone?: string;
  commercialInitials?: string;
  signature?: string;
}

export interface SubcategoryItem {
  name: string;
  children?: string[];
}

export interface TarifarioItem {
  id: string;
  code: string;
  category: string;
  subcategory: string;
  subSubcategory?: string;
  designation: string;
  norm: string;
  minWeightKg: number | string;
  unit: string;
  ufPrice: number;
  sku: string;
  cc: string;
  isOfficial: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export interface TarifarioCategoryStructure {
  cc: string;
  category: string;
  subcategories: (string | SubcategoryItem)[];
}

export interface CotizacionItem {
  id: string;
  itemNumber: string; // ej. "1.1.1" o "1.1.1.1"
  code: string;
  designation: string;
  norm: string;
  minWeightKg: number | string;
  unit: string;
  ufPrice: number;
  factor: number; // Por defecto 1.0 (permite descuentos o recargos)
  quantity: number;
  subtotalUf: number;
  subtotalClp: number;
  subtotalUsd?: number;
  sku?: string;
  isDivider?: boolean; // true si es una fila de separación/partida
  dividerTitle?: string; // Título de la partida (ej. "Ensayos para Calicatas")
}

export interface Cotizacion {
  id: string;
  code: string; // ej. "PR.DGL.2339.2026.0001"
  date: string;
  clientName: string;
  clientRut: string;
  clientAttention: string;
  clientPhone: string;
  clientEmail: string;
  reference: string;
  projectName: string;
  projectId?: string; // ej. "PRY-0001"
  city: string; // ej. "Santiago" o "Concepción"
  paymentCondition?: string;
  centroCosto?: string;
  seccion?: string;
  sectorProyecto?: SectorProyecto | string;
  subsectorProyecto?: SubsectorProyecto | string;
  zonaProyecto?: ZonaProyecto | string;
  currency?: 'UF' | 'USD' | 'CLP';
  commercialName: string;
  commercialTitle: string;
  commercialInitials: string;
  commercialPhone?: string;
  commercialEmail?: string;
  commercialSignature?: string;
  ufValue: number;
  dollarValue: number;
  items: CotizacionItem[];
  totalUf: number;
  totalClp: number;
  totalUsd?: number;
  totalWeightKg: number;
  totalUnitWeightKg?: number; // Cantidad de muestra unitaria total (1 solo ensayo de cada tipo listado)
  showTotalWeightPerItem?: boolean; // Opción 1: Kilos totales por ensayo (masa unitaria * cantidad)
  showSummaryUnitWeight?: boolean;  // Opción 2: Resumen inferior de muestra unitaria
  showSummaryTotalWeight?: boolean; // Opción 3: Resumen inferior de muestra total
  showTableFootWeight?: boolean;    // Opción 4 (Círculo 1): Mostrar cifras de masa en pie de tabla (Fila Total Ensayos)
  showObservationsWeight?: boolean; // Opción 5 (Círculo 2): Mostrar líneas de notas de masa en Observaciones 1.2
  observations: string[];
  condicionesComerciales?: CotizacionCondicionesComerciales;
  showEconomicIndicators?: boolean; // Determina si se imprimen los valores UF/Dólar en el documento PDF
  status: 'Borrador' | 'Finalizada' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Ganada' | 'Perdida';
  cierreNegocio?: CierreNegocioData;
  aiChatState?: {
    messages: any[];
    activeAnalisis?: any;
    cierreNegocio?: CierreNegocioData;
    updatedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  createdById?: string;
  updatedBy?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedById?: string;
  version?: number;
  versionHistory?: CotizacionVersionSnapshot[];
  salesforceOpportunityId?: string;
  salesforceOpportunityUrl?: string;
  salesforceQuoteId?: string;
  salesforceQuoteUrl?: string;
  salesforceSyncedAt?: string;
}

export interface CuotaFacturacionDetalle {
  numero: number;
  fecha: string; // YYYY-MM-DD
  montoClp: number;
  montoUf: number;
  porcentaje: number;
  salesforceCuotaId?: string;
}

export const MOTIVOS_RECHAZO_SALESFORCE = [
  'Competencia: Precio',
  'Competencia: Plazo del servicio',
  'Competencia: Capacidad Operativa',
  'Competencia: Condiciones de pago',
  'Competencia: Tiempo de Respuesta Propuesta',
  'Competencia',
  'Falta presupuesto',
  'El cliente nunca respondió',
  'Decidieron No realizar el servicio',
  'Proyecto suspendido/ standby',
  'Pérdida de Factibilidad Técnica',
  'Cambio de alcance',
  'No cotizado',
  'El cliente/Mandante Pierde Proyecto - No realiza',
  'Descalificación técnica',
  'Descalificación administrativa',
  'Descalificación por presupuesto',
  'Descalificación por casa matriz',
  'Descalificación técnica y administrativa',
  'Sin respuesta de división',
  'Calidad de atención a cliente',
  'Inhabilitado',
  'Conflicto de interés',
  'Sin Motivo',
] as const;
export type MotivoRechazoSalesforce = typeof MOTIVOS_RECHAZO_SALESFORCE[number];

export interface CierreNegocioData {
  estado: 'Ganada' | 'Perdida';
  fechaCierre: string; // YYYY-MM-DD
  montoCierreUf?: number;
  montoCierreClp?: number;
  diferenciaConCotizacionUf?: number;
  cuotasFacturacion?: number;
  fechaPrimeraFacturacion?: string;
  cuotasDetalle?: CuotaFacturacionDetalle[];
  motivoRechazo?: string;
  observaciones?: string;
  cerradoPor?: string;
  cerradoAt?: string;
}

export interface CotizacionVersionSnapshot {
  versionNumber: number; // e.g. 1, 2...
  versionCode: string; // e.g. 'PR.DGL.3340.2026.0656'
  savedAt: string;
  savedBy?: string;
  status: 'Borrador' | 'Finalizada' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Ganada' | 'Perdida';
  totalUf: number;
  totalClp: number;
  totalUsd?: number;
  totalWeightKg: number;
  totalUnitWeightKg?: number;
  showTotalWeightPerItem?: boolean;
  showSummaryUnitWeight?: boolean;
  showSummaryTotalWeight?: boolean;
  showTableFootWeight?: boolean;
  showObservationsWeight?: boolean;
  ufValue: number;
  dollarValue?: number;
  items: CotizacionItem[];
  observations?: string[];
  condicionesComerciales?: CotizacionCondicionesComerciales;
  showEconomicIndicators?: boolean;
  salesforceOpportunityId?: string;
  salesforceQuoteId?: string;
  cierreNegocio?: CierreNegocioData;
}

export interface CotizacionCondicionesComerciales {
  vigenciaDias?: string; // ej. "30 días"
  plazoEntrega?: string; // ej. "10 a 15 días hábiles a contar de la recepción conforme de muestras"
  condicionVenta?: string; // ej. "50% AL CONTADO Y 50% CONTRA ENTREGA"
  clausulasParticulares?: string[]; // Cláusulas y acuerdos adicionales libres de esta propuesta
  clausulasEspeciales?: string[]; // Personalización de la sección Condiciones Especiales
  clausulasFacturacion?: string[]; // Personalización de la sección Condiciones de Facturación
  clausulasTecnicas?: string[]; // Personalización de la sección Condiciones Técnicas
}

export interface Contacto {
  id?: string;
  email: string;
  name: string;
  phone: string;
  company?: string;
  accountId?: string;
  cargo?: string;
  source?: 'salesforce' | 'local';
  createdAt: string;
  updatedAt: string;
}

export interface Proyecto {
  id: string; // ej. "PRY-0001"
  name: string;
  reference?: string;
  city?: string;
  clientName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EconomicIndicators {
  uf: number;
  dolar: number;
  date: string;
  source: string;
}

export interface Cliente {
  id: string;
  name: string;
  rut: string;
  comuna: string;
  address: string;
  giro: string;
  phone: string;
  paymentCondition: string;
  email: string;
  contactPerson: string;
  source?: 'salesforce' | 'local';
  salesforceAccountId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormatoSettings {
  formatCode: string; // ej. "DGL-FA-193 V3"
  officeTitle: string; // ej. "Oficina central"
  officeAddress: string; // ej. "Plaza Ercilla 883, Santiago, Chile"
  contactPhone: string; // ej. "+56 2 2978 4800"
  contactEmail: string; // ej. "contacto@idiem.cl"
  contactWeb: string; // ej. "www.idiem.cl"
  budgetTitle: string; // ej. "PRESUPUESTO ENSAYOS DE LABORATORIO"
  divisionTitle?: string; // ej. "División Geotecnia Laboratorio"
  headerImage?: string; // Imagen en Base64 o ruta para logotipo personalizado
  observations?: string[];
  updatedAt?: string;
  updatedBy?: string;
}

// ==================== APRENDIZAJE CONTINUO IA (OPCIONES A Y B) ====================

export type TipoReglaAprendida = 'sinonimo' | 'correccion_ensayo' | 'observacion_frecuente';
export type OrigenReglaAprendida = 'chat_ia' | 'analisis_solicitud' | 'buscador_ensayos' | 'manual';
export type EstadoReglaAprendida = 'activo' | 'pendiente_revision' | 'descartado';

/**
 * Representa una regla o equivalencia terminológica aprendida por el sistema (Opción B).
 */
export interface ReglaAprendida {
  id: string;
  tipo: TipoReglaAprendida;
  terminoUsuario: string; // Expresión en lenguaje natural utilizada por los usuarios (ej: "triaxial 15x30")
  codigoEnsayo?: string; // Código del ensayo oficial correspondiente en el tarifario (ej: "106")
  sku?: string;
  designacion?: string;
  observacionSugerida?: string;
  conteoConfirmaciones: number; // Veces que ha sido confirmada o aplicada exitosamente
  estado: EstadoReglaAprendida;
  origen: OrigenReglaAprendida;
  creadoPor?: string;
  creadoEn: string;
  actualizadoEn: string;
}

/**
 * Representa una cotización histórica aprobada/finalizada utilizada como caso de estudio (Opción A - RAG).
 */
export interface CasoReferenciaRAG {
  id: string;
  codigoCotizacion: string;
  nombreObra: string;
  empresaCliente: string;
  centroCosto: string;
  ciudad: string;
  dominioGeotecnico: 'rocas' | 'suelos_basicos' | 'especiales' | 'viales_terreno';
  ensayosCotizados: Array<{
    codigo: string;
    designacion: string;
    cantidad: number;
    ufPrice: number;
    norma?: string;
  }>;
  observacionesClave?: string[];
  totalUf: number;
  fechaEmision: string;
}

export interface CorrelativoConfig {
  defaultInitialNumber: number; // Por defecto 598 (del sistema manual externo)
  sequences: Record<string, number>; // ej: { "2339": 598, "1817": 579, "2340": 100, "2341": 588 }
}

// ==================== AUDITORÍA Y TRAZABILIDAD (ADMIN / SOPORTE) ====================

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'COTIZACION_CREAR'
  | 'COTIZACION_EDITAR'
  | 'COTIZACION_BORRADOR'
  | 'COTIZACION_FINALIZAR'
  | 'COTIZACION_ELIMINAR'
  | 'COTIZACION_ESTADO'
  | 'COTIZACION_DESCARGAR'
  | 'TARIFARIO_EDITAR'
  | 'TARIFARIO_EDITAR_MASIVO'
  | 'TARIFARIO_MOVER'
  | 'TARIFARIO_NUEVO'
  | 'TARIFARIO_IMPORTAR'
  | 'TARIFARIO_ESTRUCTURA'
  | 'TARIFARIO_EXPORTAR'
  | 'CLIENTE_CREAR'
  | 'CLIENTE_EDITAR'
  | 'CLIENTE_ELIMINAR'
  | 'CLIENTE_IMPORTAR'
  | 'USUARIO_CREAR'
  | 'USUARIO_EDITAR'
  | 'USUARIO_ELIMINAR'
  | 'USUARIO_CLAVE_CAMBIADA'
  | 'USUARIO_PERFIL_PROPIO'
  | 'PERFIL_CREAR'
  | 'PERFIL_EDITAR'
  | 'PERFIL_ELIMINAR'
  | 'CONFIG_CORRELATIVOS'
  | 'CONFIG_FORMATO'
  | 'BIBLIOGRAFIA_SUBIR'
  | 'BIBLIOGRAFIA_ESTADO'
  | 'BIBLIOGRAFIA_ELIMINAR'
  | 'SALESFORCE_CONECTADO'
  | 'SALESFORCE_DISCONNECTED'
  | 'SALESFORCE_SYNC'
  | 'SALESFORCE_CIERRE'
  | 'ASISTENTE_CHAT_ARCHIVADO';

export type AuditModule =
  | 'Acceso'
  | 'Cotizaciones'
  | 'Tarifario'
  | 'Clientes'
  | 'Configuración'
  | 'Usuarios'
  | 'Bibliografía'
  | 'Salesforce'
  | 'Asistente IA';

export interface AuditLog {
  id: string;
  timestamp: string; // ISO string
  userId?: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  action: AuditAction | string;
  module: AuditModule;
  description: string;
  details?: any;
  ip?: string;
}

// ==================== BIBLIOGRAFÍA TÉCNICA E HISTÓRICA (RAG ASISTENTE IA) ====================

export type TipoBibliografia = 'tecnica' | 'historica';
export type EstadoBibliografia = 'activo' | 'inactivo';

export interface BibliografiaItem {
  id: string;
  tipo: TipoBibliografia; // 'tecnica' (normas, manuales oficiales) | 'historica' (chats archivados, casos cotizados)
  titulo: string;
  descripcion?: string;
  contenidoTexto: string; // Texto extraído para indexación y RAG
  nombreArchivoOriginal?: string;
  tipoArchivo?: string; // 'pdf' | 'docx' | 'txt' | 'chat' | 'cotizacion'
  tamanoBytes?: number;
  tags?: string[];
  metadatos?: {
    codigoCotizacion?: string;
    cliente?: string;
    proyecto?: string;
    autor?: string;
    normaRef?: string;
    centroCosto?: string;
  };
  estado: EstadoBibliografia;
  creadoPor?: string;
  creadoEn: string;
  actualizadoEn: string;
}

