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

  // Módulo Configuración
  {
    key: 'configuracion.formato',
    label: 'Configuración de Formato y Plantilla',
    description: 'Permite modificar código de formato oficial, direcciones, teléfonos y logotipos.',
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
    id: 'admin',
    name: 'Administrador de Sistema',
    description: 'Control total de la plataforma, configuración, usuarios, tarifas y cotizaciones.',
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
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Calcula los permisos efectivos de un usuario combinando su rol heredado,
 * su perfil asignado y cualquier permiso personalizado individual.
 */
export function computeEffectivePermissions(
  user: {
    role: 'admin' | 'comercial';
    profileId?: string;
    customPermissions?: PermissionKey[];
  },
  availableProfiles: UserProfile[] = DEFAULT_PROFILES
): PermissionKey[] {
  // Los administradores por rol siempre tienen todos los permisos
  if (user.role === 'admin' && (!user.profileId || user.profileId === 'admin')) {
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

  return user.role === 'admin'
    ? DEFAULT_PROFILES[0].permissions
    : DEFAULT_PROFILES[2].permissions; // Por defecto comercial_junior
}

/**
 * Verifica si un usuario (de sesión o completo) posee un permiso específico.
 */
export function hasPermission(
  user: SessionUser | User | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user) return false;
  if (user.role === 'admin' && (!user.profileId || user.profileId === 'admin')) return true;

  if ('permissions' in user && Array.isArray((user as SessionUser).permissions)) {
    return (user as SessionUser).permissions!.includes(permission);
  }

  const effective = computeEffectivePermissions(user as User);
  return effective.includes(permission);
}

