import { PermissionKey, UserProfile, SessionUser, User } from './types';

// Definición detallada y agrupada de los permisos para la interfaz de usuario
export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  module: 'Cotizador' | 'Cotizaciones' | 'Tarifario' | 'Clientes' | 'Configuración' | 'Usuarios';
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

  // Módulo Cotizaciones (Historial)
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

  // Módulo Tarifario
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

  // Módulo Clientes, Contactos y Proyectos
  {
    key: 'clientes.gestionar',
    label: 'Gestión de Clientes y Proyectos',
    description: 'Permite registrar y editar empresas, contactos y correlativos de proyectos.',
    module: 'Clientes',
  },

  // Módulo Configuración & Conocimiento IA
  {
    key: 'configuracion.formato',
    label: 'Configuración de Formato y Plantilla',
    description: 'Permite modificar código de formato oficial, direcciones, teléfonos y logotipos.',
    module: 'Configuración',
  },
  {
    key: 'configuracion.aprendizaje',
    label: 'Memoria y Aprendizaje IA',
    description: 'Permite supervisar el aprendizaje continuo, sinónimos y base de conocimiento histórico RAG.',
    module: 'Configuración',
  },
  {
    key: 'configuracion.bibliografia',
    label: 'Bibliografía y Normas IA',
    description: 'Permite consultar y cargar documentos técnicos y normativos oficiales (NCh, ASTM, MOP).',
    module: 'Configuración',
  },
  {
    key: 'auditoria.ver',
    label: 'Auditoría y Trazabilidad',
    description: 'Permite visualizar el registro de accesos, inicios de sesión y modificaciones del sistema.',
    module: 'Configuración',
  },

  // Módulo Usuarios y Accesos
  {
    key: 'usuarios.administrar',
    label: 'Administración de Usuarios y Perfiles',
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
    permissions: [
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
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'admin',
    name: 'Administrador',
    description: 'Control total de cotizaciones, tarifas, clientes y gestión de usuarios.',
    isSystem: true,
    permissions: [
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
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'comercial_senior',
    name: 'Comercial Senior',
    description: 'Cotización completa, descarga oficial, visualización global y descarga de tarifario.',
    isSystem: true,
    permissions: [
      'cotizador.ver',
      'cotizador.descargar_borrador',
      'cotizador.descargar_definitivo',
      'cotizaciones.ver_todas',
      'tarifario.ver',
      'tarifario.descargar',
      'clientes.gestionar',
      'configuracion.aprendizaje',
      'configuracion.bibliografia',
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'comercial_junior',
    name: 'Comercial Estándar',
    description: 'Cotización y emisión oficial. No tiene autorización para descargar el libro tarifario completo.',
    isSystem: true,
    permissions: [
      'cotizador.ver',
      'cotizador.descargar_borrador',
      'cotizador.descargar_definitivo',
      'tarifario.ver',
      'clientes.gestionar',
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
      'tarifario.ver',
      'clientes.gestionar',
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
      'tarifario.ver',
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

