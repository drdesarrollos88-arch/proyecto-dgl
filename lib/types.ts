export type UserRole = 'superadmin' | 'admin' | 'comercial';

// Lista oficial de permisos granulares del sistema
export const PERMISSION_KEYS = [
  'cotizador.ver',
  'cotizador.descargar_borrador',
  'cotizador.descargar_definitivo',
  'cotizaciones.ver_todas',
  'cotizaciones.eliminar',
  'tarifario.ver',
  'tarifario.descargar',
  'tarifario.editar',
  'clientes.gestionar',
  'configuracion.formato',
  'configuracion.aprendizaje',
  'configuracion.bibliografia',
  'auditoria.ver',
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
  itemNumber: string; // ej. "1.1.1"
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
  sku?: string;
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
  observations: string[];
  condicionesComerciales?: CotizacionCondicionesComerciales;
  showEconomicIndicators?: boolean; // Determina si se imprimen los valores UF/Dólar en el documento PDF
  status: 'Borrador' | 'Finalizada' | 'Enviada' | 'Aprobada' | 'Rechazada';
  aiChatState?: {
    messages: any[];
    activeAnalisis?: any;
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

export interface CotizacionVersionSnapshot {
  versionNumber: number; // e.g. 1, 2...
  versionCode: string; // e.g. 'PR.DGL.3340.2026.0656'
  savedAt: string;
  savedBy?: string;
  status: 'Borrador' | 'Finalizada' | 'Enviada' | 'Aprobada' | 'Rechazada';
  totalUf: number;
  totalClp: number;
  totalUsd?: number;
  totalWeightKg: number;
  ufValue: number;
  dollarValue?: number;
  items: CotizacionItem[];
  observations?: string[];
  condicionesComerciales?: CotizacionCondicionesComerciales;
  showEconomicIndicators?: boolean;
  salesforceOpportunityId?: string;
  salesforceQuoteId?: string;
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
  email: string;
  name: string;
  phone: string;
  company?: string;
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
  | 'TARIFARIO_EDITAR'
  | 'TARIFARIO_MOVER'
  | 'TARIFARIO_NUEVO'
  | 'CLIENTE_CREAR'
  | 'CLIENTE_EDITAR'
  | 'CLIENTE_ELIMINAR'
  | 'USUARIO_CREAR'
  | 'USUARIO_EDITAR'
  | 'BIBLIOGRAFIA_SUBIR'
  | 'BIBLIOGRAFIA_ESTADO'
  | 'BIBLIOGRAFIA_ELIMINAR'
  | 'ASISTENTE_CHAT_ARCHIVADO';

export type AuditModule =
  | 'Acceso'
  | 'Cotizaciones'
  | 'Tarifario'
  | 'Clientes'
  | 'Configuración'
  | 'Usuarios'
  | 'Bibliografía'
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

