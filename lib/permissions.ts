import { PermissionKey, UserProfile, SessionUser, User } from './types';

// Definición detallada y agrupada de los permisos para la interfaz de usuario
export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  module:
    | 'Cotizador'
    | 'Cotizaciones'
    | 'Ventas'
    | 'Tarifario'
    | 'Clientes'
    | 'Inteligencia Artificial'
    | 'Auditoría'
    | 'Configuración'
    | 'Usuarios';
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Módulo Cotizador
  {
    key: 'cotizador.ver',
    label: 'Acceso al Cotizador',
    description: 'Permite crear nuevos presupuestos y editar borradores de ensayos.',
    module: 'Cotizador',
  },
  {
    key: 'cotizador.descargar_borrador',
    label: 'Descargar PDF en Borrador',
    description: 'Permite descargar versiones preliminares en PDF con marca de agua "BORRADOR".',
    module: 'Cotizador',
  },
  {
    key: 'cotizador.descargar_definitivo',
    label: 'Finalizar y Descargar PDF Definitivo',
    description: 'Permite cerrar la propuesta comercial a estado "Finalizada" y emitir el PDF oficial.',
    module: 'Cotizador',
  },

  // Módulo Cotizaciones (Historial & Métricas)
  {
    key: 'cotizaciones.ver_todas',
    label: 'Ver Todas las Cotizaciones',
    description: 'Permite visualizar el historial de cotizaciones de todos los ejecutivos comerciales.',
    module: 'Cotizaciones',
  },
  {
    key: 'cotizaciones.eliminar',
    label: 'Eliminar Cotizaciones',
    description: 'Permite suprimir cotizaciones archivadas del historial.',
    module: 'Cotizaciones',
  },

  // Módulo Ventas & Salesforce
  {
    key: 'ventas.ver',
    label: 'Panel de Ventas & Oportunidades',
    description: 'Permite consultar el pipeline comercial de cotizaciones y cuotas en curso.',
    module: 'Ventas',
  },
  {
    key: 'ventas.cierre_oportunidad',
    label: 'Cierre de Oportunidades Salesforce',
    description: 'Permite registrar cierres comerciales (Ganada con cuotas / Perdida) directamente en Salesforce.',
    module: 'Ventas',
  },
  {
    key: 'ventas.conciliador',
    label: 'Conciliador EERR vs Salesforce',
    description: 'Permite acceder a la herramienta de cuadratura contable y conciliación de estados de resultados.',
    module: 'Ventas',
  },

  // Módulo Tarifario Oficial
  {
    key: 'tarifario.ver',
    label: 'Visualizar Catálogo Tarifario',
    description: 'Permite consultar los 358 ensayos, códigos, normas y valores UF en la plataforma.',
    module: 'Tarifario',
  },
  {
    key: 'tarifario.descargar',
    label: 'Descargar Tarifario (Excel / PDF)',
    description: 'Permite exportar y descargar el libro completo de tarifas en Excel o PDF oficial.',
    module: 'Tarifario',
  },
  {
    key: 'tarifario.editar',
    label: 'Modificar Catálogo de Tarifas',
    description: 'Permite modificar valores UF, nombres de ensayos o incorporar nuevos ensayos oficiales.',
    module: 'Tarifario',
  },
  {
    key: 'tarifario.estructura',
    label: 'Configurar Estructura Tarifaria',
    description: 'Permite administrar categorías, subcategorías y ordenamiento jerárquico del tarifario.',
    module: 'Tarifario',
  },

  // Módulo Clientes, Contactos y Proyectos
  {
    key: 'clientes.gestionar',
    label: 'Gestión de Clientes y Proyectos',
    description: 'Permite registrar y editar empresas, contactos y correlativos de proyectos.',
    module: 'Clientes',
  },
  {
    key: 'clientes.importar',
    label: 'Importación Masiva de Clientes',
    description: 'Permite cargar planillas Excel con directorios masivos de empresas y contactos.',
    module: 'Clientes',
  },

  // Módulo Inteligencia Artificial (Asistente & RAG)
  {
    key: 'ia.asistente',
    label: 'Asistente Técnico IA (Chat & Desglose)',
    description: 'Permite interactuar con el copiloto IA para recomendación de ensayos y consultas normativas.',
    module: 'Inteligencia Artificial',
  },
  {
    key: 'configuracion.aprendizaje',
    label: 'Memoria y Aprendizaje IA',
    description: 'Permite supervisar el aprendizaje continuo, sinónimos y base de conocimiento histórico RAG.',
    module: 'Inteligencia Artificial',
  },
  {
    key: 'configuracion.bibliografia',
    label: 'Bibliografía y Normas IA',
    description: 'Permite consultar y cargar documentos técnicos y normativos oficiales (NCh, ASTM, MOP).',
    module: 'Inteligencia Artificial',
  },

  // Módulo Auditoría & Trazabilidad
  {
    key: 'auditoria.ver',
    label: 'Bitácora de Auditoría y Trazabilidad',
    description: 'Permite visualizar el registro cronológico de accesos, inicios de sesión y modificaciones.',
    module: 'Auditoría',
  },
  {
    key: 'auditoria.exportar',
    label: 'Exportación Certificada de Auditoría',
    description: 'Permite descargar el registro histórico de auditoría en formato CSV seguro.',
    module: 'Auditoría',
  },

  // Módulo Configuración Oficial
  {
    key: 'configuracion.correlativos',
    label: 'Configuración de Correlativos',
    description: 'Permite modificar la secuencia numérica consecutiva por Centro de Costo (CC).',
    module: 'Configuración',
  },
  {
    key: 'configuracion.formato',
    label: 'Configuración de Formato Oficial',
    description: 'Permite modificar encabezado, pie de página, logotipos y observaciones de las cotizaciones.',
    module: 'Configuración',
  },

  // Módulo Usuarios y Seguridad (RBAC)
  {
    key: 'usuarios.administrar',
    label: 'Administración de Usuarios y Perfiles (RBAC)',
    description: 'Permite crear usuarios, asignar perfiles de acceso y definir permisos granulares.',
    module: 'Usuarios',
  },
];

// Perfiles base predeterminados del sistema
export const DEFAULT_PROFILES: UserProfile[] = [
  {
    id: 'superadmin',
    name: 'Administrador / Soporte',
    description: 'Control absoluto de la plataforma, roles protegidos, usuarios y configuraciones maestras.',
    isSystem: true,
    permissions: PERMISSION_DEFINITIONS.map((p) => p.key),
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Control total de cotizaciones, tarifas, clientes y gestión de usuarios.',
    isSystem: true,
    permissions: PERMISSION_DEFINITIONS.map((p) => p.key),
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'comercial_senior',
    name: 'Comercial Senior',
    description: 'Cotización completa, descarga oficial, ventas, Salesforce, visualización global y descarga de tarifario.',
    isSystem: true,
    permissions: [
      'cotizador.ver',
      'cotizador.descargar_borrador',
      'cotizador.descargar_definitivo',
      'cotizaciones.ver_todas',
      'ventas.ver',
      'ventas.cierre_oportunidad',
      'tarifario.ver',
      'tarifario.descargar',
      'clientes.gestionar',
      'ia.asistente',
      'configuracion.aprendizaje',
      'configuracion.bibliografia',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'comercial_junior',
    name: 'Comercial Estándar',
    description: 'Cotización y emisión oficial, ventas y CRM. No tiene autorización para descargar el libro tarifario completo.',
    isSystem: true,
    permissions: [
      'cotizador.ver',
      'cotizador.descargar_borrador',
      'cotizador.descargar_definitivo',
      'ventas.ver',
      'ventas.cierre_oportunidad',
      'tarifario.ver',
      'clientes.gestionar',
      'ia.asistente',
      'configuracion.aprendizaje',
      'configuracion.bibliografia',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'comercial_restringido',
    name: 'Comercial Restringido / En Revisión',
    description: 'Solo puede cotizar y descargar borradores con marca de agua para revisión de jefatura.',
    isSystem: true,
    permissions: [
      'cotizador.ver',
      'cotizador.descargar_borrador',
      'ventas.ver',
      'tarifario.ver',
      'clientes.gestionar',
      'ia.asistente',
      'configuracion.bibliografia',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'revisor_tecnico',
    name: 'Revisor Técnico de Laboratorio',
    description: 'Consulta de cotizaciones de todos los ejecutivos y descarga de borradores para verificación técnica.',
    isSystem: true,
    permissions: [
      'cotizador.ver',
      'cotizador.descargar_borrador',
      'cotizaciones.ver_todas',
      'ventas.ver',
      'tarifario.ver',
      'ia.asistente',
      'configuracion.aprendizaje',
      'configuracion.bibliografia',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Valida si un rol corresponde a nivel administrativo (superadmin o admin).
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role === 'superadmin' || role === 'admin';
}

/**
 * Valida si un rol corresponde exclusivamente al Administrador / Soporte.
 */
export function isSuperAdminRole(role: string | undefined | null): boolean {
  return role === 'superadmin';
}

/**
 * Calcula los permisos efectivos de un usuario combinando su rol heredado,
 * su perfil asignado y cualquier permiso personalizado individual.
 */
export function computeEffectivePermissions(
  user: {
    role: any;
    profileId?: string;
    customPermissions?: PermissionKey[];
  },
  availableProfiles: UserProfile[] = DEFAULT_PROFILES
): PermissionKey[] {
  // Los administradores (superadmin y admin) por rol siempre tienen todos los permisos
  if (isAdminRole(user.role) && (!user.profileId || user.profileId === 'admin' || user.profileId === 'superadmin')) {
    return DEFAULT_PROFILES[0].permissions;
  }

  // Si tiene permisos personalizados explícitos configurados, prevalecen sobre la plantilla base
  if (Array.isArray(user.customPermissions)) {
    return user.customPermissions;
  }

  // Si tiene un perfil asignado, obtener sus permisos base
  const profile = availableProfiles.find((p) => p.id === user.profileId);
  if (profile) {
    return profile.permissions;
  }

  return isAdminRole(user.role)
    ? DEFAULT_PROFILES[0].permissions
    : DEFAULT_PROFILES[3].permissions; // Por defecto comercial_junior
}

/**
 * Verifica si un usuario (de sesión o completo) posee un permiso específico.
 */
export function hasPermission(
  user: SessionUser | User | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user) return false;
  if (isAdminRole(user.role) && (!user.profileId || user.profileId === 'admin' || user.profileId === 'superadmin')) return true;

  if ('permissions' in user && Array.isArray((user as SessionUser).permissions)) {
    return (user as SessionUser).permissions!.includes(permission);
  }

  const effective = computeEffectivePermissions(user as User);
  return effective.includes(permission);
}

