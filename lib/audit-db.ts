import { AuditLog, AuditAction, AuditModule } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Registros de auditoría iniciales para trazabilidad base de la plataforma
const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'aud-init-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    userId: 'usr-1',
    userName: 'Diego Román',
    userEmail: 'diego.roman@idiem.cl',
    userRole: 'superadmin',
    action: 'LOGIN',
    module: 'Acceso',
    description: 'Inicio de sesión exitoso en la plataforma oficial DGL.',
    details: { metodo: 'credenciales_rut' },
    ip: '190.161.42.10',
  },
  {
    id: 'aud-init-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString(),
    userId: 'usr-1',
    userName: 'Diego Román',
    userEmail: 'diego.roman@idiem.cl',
    userRole: 'superadmin',
    action: 'TARIFARIO_EDITAR',
    module: 'Tarifario',
    description: 'Modificación de parámetros y valor UF en ensayo de Mecánica de Rocas.',
    details: { codigo: '210', ensayo: 'Compresión simple probeta testigo de roca', cc: '2339' },
    ip: '190.161.42.10',
  },
  {
    id: 'aud-init-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    userId: 'usr-2',
    userName: 'Alejandra Pérez',
    userEmail: 'alejandra.perez@idiem.cl',
    userRole: 'comercial',
    action: 'LOGIN',
    module: 'Acceso',
    description: 'Inicio de sesión comercial desde terminal de oficina.',
    details: { metodo: 'correo_corporativo' },
    ip: '200.75.12.85',
  },
  {
    id: 'aud-init-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    userId: 'usr-2',
    userName: 'Alejandra Pérez',
    userEmail: 'alejandra.perez@idiem.cl',
    userRole: 'comercial',
    action: 'COTIZACION_BORRADOR',
    module: 'Cotizaciones',
    description: 'Guardado de propuesta en borrador para cliente ESVAL S.A.',
    details: { correlativo: 'PR.DGL.2339.2026.0598-V1', montoUf: 22.45, itemsCount: 6 },
    ip: '200.75.12.85',
  },
  {
    id: 'aud-init-5',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    userId: 'usr-1',
    userName: 'Diego Román',
    userEmail: 'diego.roman@idiem.cl',
    userRole: 'superadmin',
    action: 'COTIZACION_FINALIZAR',
    module: 'Cotizaciones',
    description: 'Finalización y emisión de PDF oficial DGL para proyecto de Minería.',
    details: { correlativo: 'PR.DGL.2340.2026.0319-V1', estado: 'Finalizada', totalUf: 47.4 },
    ip: '190.161.42.10',
  },
];

let _cachedAuditLogs: AuditLog[] | null = null;

function ensureCache(): AuditLog[] {
  if (_cachedAuditLogs) return _cachedAuditLogs;

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.auditLogs) && parsed.auditLogs.length > 0) {
        _cachedAuditLogs = parsed.auditLogs;
        return _cachedAuditLogs!;
      }
    }
  } catch {
    // Read-only serverless environment
  }

  _cachedAuditLogs = [...INITIAL_AUDIT_LOGS];
  return _cachedAuditLogs;
}

function persistLocally(logs: AuditLog[]) {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.auditLogs = logs;
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
  } catch {
    // Fail silently in read-only environment
  }
}

/**
 * Registra una acción de usuario de forma no bloqueante y ultra tolerante a fallos.
 */
export async function registrarAuditoria(
  entry: Omit<AuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }
): Promise<AuditLog> {
  const newLog: AuditLog = {
    id: entry.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: entry.timestamp || new Date().toISOString(),
    userId: entry.userId,
    userName: entry.userName || 'Usuario',
    userEmail: entry.userEmail,
    userRole: entry.userRole,
    action: entry.action,
    module: entry.module,
    description: entry.description,
    details: entry.details,
    ip: entry.ip || '127.0.0.1',
  };

  const logs = ensureCache();
  logs.unshift(newLog);

  // Mantener máximo 1000 eventos en memoria
  if (logs.length > 1000) {
    logs.length = 1000;
  }
  _cachedAuditLogs = logs;
  persistLocally(logs);

  if (isSupabaseConfigured && supabaseAdmin) {
    Promise.resolve(
      supabaseAdmin
        .from('registro_auditoria')
        .insert({
          id: newLog.id,
          created_at: newLog.timestamp,
          user_id: newLog.userId,
          user_name: newLog.userName,
          user_email: newLog.userEmail,
          user_role: newLog.userRole,
          action: newLog.action,
          module: newLog.module,
          description: newLog.description,
          details: newLog.details || {},
          ip_address: newLog.ip,
        })
    ).catch(() => {});
  }

  return newLog;
}

/**
 * Recupera el registro histórico de auditoría con filtros aplicados.
 */
export async function getAuditLogs(filtro?: {
  module?: string;
  action?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<AuditLog[]> {
  // Intentar consultar Supabase primero
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      let query = supabaseAdmin
        .from('registro_auditoria')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtro?.module && filtro.module !== 'TODOS') {
        query = query.eq('module', filtro.module);
      }
      if (filtro?.action && filtro.action !== 'TODOS') {
        query = query.eq('action', filtro.action);
      }
      if (filtro?.userId) {
        query = query.eq('user_id', filtro.userId);
      }
      if (filtro?.limit) {
        query = query.limit(filtro.limit);
      } else {
        query = query.limit(200);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row) => ({
          id: row.id,
          timestamp: row.created_at || row.timestamp,
          userId: row.user_id || row.userId,
          userName: row.user_name || row.userName || 'Usuario',
          userEmail: row.user_email || row.userEmail,
          userRole: row.user_role || row.userRole,
          action: row.action,
          module: row.module,
          description: row.description,
          details: row.details,
          ip: row.ip_address || row.ip,
        }));
      }
    } catch {
      // Fallback a memoria
    }
  }

  // Filtrado sobre memoria local
  let logs = ensureCache();

  if (filtro?.module && filtro.module !== 'TODOS') {
    logs = logs.filter((l) => l.module.toLowerCase() === filtro.module!.toLowerCase());
  }
  if (filtro?.action && filtro.action !== 'TODOS') {
    logs = logs.filter((l) => l.action.toLowerCase() === filtro.action!.toLowerCase());
  }
  if (filtro?.userId) {
    logs = logs.filter((l) => l.userId === filtro.userId);
  }
  if (filtro?.startDate) {
    const sDate = new Date(filtro.startDate).getTime();
    logs = logs.filter((l) => new Date(l.timestamp).getTime() >= sDate);
  }
  if (filtro?.endDate) {
    const eDate = new Date(filtro.endDate).getTime();
    logs = logs.filter((l) => new Date(l.timestamp).getTime() <= eDate);
  }
  if (filtro?.search && filtro.search.trim()) {
    const q = filtro.search.toLowerCase().trim();
    logs = logs.filter(
      (l) =>
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.module && l.module.toLowerCase().includes(q))
    );
  }

  const limit = filtro?.limit || 200;
  return logs.slice(0, limit);
}

/**
 * Métricas consolidadas para el panel de Administrador / Soporte.
 */
export async function getAuditStats(): Promise<{
  totalLogs: number;
  totalAccesses: number;
  totalChanges: number;
  activeUsersCount: number;
  recentLogins: AuditLog[];
}> {
  const logs = await getAuditLogs({ limit: 500 });
  const accesses = logs.filter((l) => l.module === 'Acceso' || l.action.includes('LOGIN'));
  const changes = logs.filter((l) => l.module !== 'Acceso' && !l.action.includes('LOGIN'));

  const userIds = new Set<string>();
  logs.forEach((l) => {
    if (l.userEmail) userIds.add(l.userEmail);
    else if (l.userName) userIds.add(l.userName);
  });

  return {
    totalLogs: logs.length,
    totalAccesses: accesses.length,
    totalChanges: changes.length,
    activeUsersCount: userIds.size,
    recentLogins: accesses.slice(0, 5),
  };
}
