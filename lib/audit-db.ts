import { AuditLog } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';

/**
 * Bitácora de auditoría.
 *
 * - Fuente de verdad: tabla `registro_auditoria` en Supabase (append-only).
 * - La escritura se ESPERA (await) para que no se pierda cuando el Worker termina la respuesta.
 * - Un fallo de auditoría nunca interrumpe la operación de negocio, pero se registra con error visible.
 * - La memoria local solo sirve de respaldo de desarrollo cuando Supabase no está configurado
 *   o cuando falla la lectura; NO se escribe en archivos (evita filtrar datos al repositorio).
 */

let _cachedAuditLogs: AuditLog[] = [];
const MAX_MEMORY_LOGS = 1000;
const INSERT_TIMEOUT_MS = 4000;
const MAX_PAGE_SIZE = 1000;

export interface AuditFilter {
  module?: string;
  action?: string;
  userId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

type AuditEntryInput = Omit<AuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string };

/**
 * IP real del cliente. En Cloudflare `cf-connecting-ip` no es falsificable por el usuario;
 * `x-forwarded-for` solo se usa como último recurso (desarrollo local).
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get('cf-connecting-ip')?.trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

/** Quita caracteres que alteran la sintaxis de filtros PostgREST (`or=`, comodines). */
function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[%*,()\\"'`;]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function mapRow(row: any): AuditLog {
  return {
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
  };
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout de ${ms}ms al registrar auditoría`)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

/**
 * Registra una acción de usuario. Nunca lanza excepción: devuelve el registro creado.
 * IMPORTANTE: invocar con `await` para garantizar la persistencia en Workers.
 */
export async function registrarAuditoria(entry: AuditEntryInput): Promise<AuditLog> {
  const newLog: AuditLog = {
    id: entry.id || `aud-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
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

  // Respaldo en memoria (solo diagnóstico / desarrollo)
  _cachedAuditLogs.unshift(newLog);
  if (_cachedAuditLogs.length > MAX_MEMORY_LOGS) _cachedAuditLogs.length = MAX_MEMORY_LOGS;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { error } = await withTimeout(
        supabaseAdmin.from('registro_auditoria').insert({
          id: newLog.id,
          created_at: newLog.timestamp,
          user_id: newLog.userId ?? null,
          user_name: newLog.userName ?? null,
          user_email: newLog.userEmail ?? null,
          user_role: newLog.userRole ?? null,
          action: newLog.action,
          module: newLog.module,
          description: newLog.description,
          details: newLog.details ?? {},
          ip_address: newLog.ip ?? null,
        }),
        INSERT_TIMEOUT_MS
      );
      if (error) {
        console.error(
          `[AUDITORIA] No se pudo persistir el evento ${newLog.action} (${newLog.module}): ${error.code || ''} ${error.message}`
        );
      }
    } catch (err: any) {
      console.error(`[AUDITORIA] Excepción al persistir ${newLog.action}:`, err?.message || err);
    }
  }

  return newLog;
}

/**
 * Atajo para rutas API: registra el evento tomando IP del request y datos del usuario en sesión.
 */
export async function auditRequest(
  req: Request,
  user: { id?: string; name?: string; email?: string; role?: string } | null | undefined,
  event: { action: string; module: AuditLog['module']; description: string; details?: any }
): Promise<void> {
  await registrarAuditoria({
    userId: user?.id,
    userName: user?.name,
    userEmail: user?.email,
    userRole: user?.role,
    action: event.action,
    module: event.module,
    description: event.description,
    details: event.details,
    ip: getClientIp(req),
  });
}

function applyMemoryFilters(logs: AuditLog[], f?: AuditFilter): AuditLog[] {
  let out = logs;
  if (f?.module && f.module !== 'TODOS') out = out.filter((l) => l.module.toLowerCase() === f.module!.toLowerCase());
  if (f?.action && f.action !== 'TODOS') out = out.filter((l) => l.action.toLowerCase() === f.action!.toLowerCase());
  if (f?.userId && f.userId !== 'TODOS') {
    const u = f.userId.toLowerCase().trim();
    out = out.filter(
      (l) =>
        (l.userId && l.userId.toLowerCase() === u) ||
        (l.userEmail && l.userEmail.toLowerCase() === u) ||
        (l.userName && l.userName.toLowerCase() === u)
    );
  }
  if (f?.startDate) {
    const s = new Date(f.startDate).getTime();
    out = out.filter((l) => new Date(l.timestamp).getTime() >= s);
  }
  if (f?.endDate) {
    const e = new Date(f.endDate).getTime();
    out = out.filter((l) => new Date(l.timestamp).getTime() <= e);
  }
  if (f?.search && f.search.trim()) {
    const q = f.search.toLowerCase().trim();
    out = out.filter(
      (l) =>
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.action && l.action.toLowerCase().includes(q)) ||
        (l.module && l.module.toLowerCase().includes(q))
    );
  }
  return out;
}

/**
 * Consulta paginada de la bitácora con TODOS los filtros aplicados en la base de datos.
 */
export async function getAuditLogsPaged(
  filtro?: AuditFilter
): Promise<{ logs: AuditLog[]; total: number; source: 'supabase' | 'memoria' }> {
  const limit = Math.min(Math.max(filtro?.limit || 200, 1), MAX_PAGE_SIZE);
  const offset = Math.max(filtro?.offset || 0, 0);

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      let query = supabaseAdmin
        .from('registro_auditoria')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (filtro?.module && filtro.module !== 'TODOS') query = query.eq('module', filtro.module);
      if (filtro?.action && filtro.action !== 'TODOS') query = query.eq('action', filtro.action);
      if (filtro?.userId && filtro.userId !== 'TODOS') {
        const u = sanitizeSearchTerm(filtro.userId);
        if (u) {
          query = query.or(`user_id.eq.${u},user_email.eq.${u},user_name.eq.${u}`);
        }
      }
      if (filtro?.startDate) query = query.gte('created_at', filtro.startDate);
      if (filtro?.endDate) query = query.lte('created_at', filtro.endDate);

      const term = filtro?.search ? sanitizeSearchTerm(filtro.search) : '';
      if (term) {
        const p = `%${term}%`;
        query = query.or(
          `user_name.ilike.${p},user_email.ilike.${p},description.ilike.${p},action.ilike.${p},module.ilike.${p},ip_address.ilike.${p}`
        );
      }

      const { data, error, count } = await query;
      if (!error && Array.isArray(data)) {
        return { logs: data.map(mapRow), total: count ?? data.length, source: 'supabase' };
      }
      if (error) console.error('[AUDITORIA] Error consultando registro_auditoria:', error.code, error.message);
    } catch (err: any) {
      console.error('[AUDITORIA] Excepción consultando bitácora:', err?.message || err);
    }
  }

  const filtered = applyMemoryFilters(_cachedAuditLogs, filtro);
  return { logs: filtered.slice(offset, offset + limit), total: filtered.length, source: 'memoria' };
}

/** Compatibilidad: devuelve solo el arreglo de registros. */
export async function getAuditLogs(filtro?: AuditFilter): Promise<AuditLog[]> {
  return (await getAuditLogsPaged(filtro)).logs;
}

export interface AuditStats {
  totalLogs: number;
  totalAccesses: number;
  totalLogins: number;
  failedLogins: number;
  totalChanges: number;
  last24h: number;
  activeUsersCount: number;
  recentLogins: AuditLog[];
  source: 'supabase' | 'memoria';
}

/**
 * Métricas globales sobre TODA la bitácora (no solo las filas visibles en pantalla).
 */
export async function getAuditStats(): Promise<AuditStats> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const sb = supabaseAdmin;
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const head = (q: any) => q.select('id', { count: 'exact', head: true });

      const [total, logins, failed, accessAll, last24, recent, users] = await Promise.all([
        head(sb.from('registro_auditoria')),
        head(sb.from('registro_auditoria')).eq('action', 'LOGIN'),
        head(sb.from('registro_auditoria')).eq('action', 'LOGIN_FAILED'),
        head(sb.from('registro_auditoria')).eq('module', 'Acceso'),
        head(sb.from('registro_auditoria')).gte('created_at', since24h),
        sb
          .from('registro_auditoria')
          .select('*')
          .eq('module', 'Acceso')
          .order('created_at', { ascending: false })
          .limit(5),
        sb.from('registro_auditoria').select('user_email,user_name').order('created_at', { ascending: false }).limit(5000),
      ]);

      if (!total.error) {
        const ids = new Set<string>();
        (users.data || []).forEach((r: any) => {
          const k = r.user_email || r.user_name;
          if (k) ids.add(String(k).toLowerCase());
        });
        const totalLogs = total.count || 0;
        const totalAccesses = accessAll.count || 0;
        return {
          totalLogs,
          totalAccesses,
          totalLogins: logins.count || 0,
          failedLogins: failed.count || 0,
          totalChanges: Math.max(totalLogs - totalAccesses, 0),
          last24h: last24.count || 0,
          activeUsersCount: ids.size,
          recentLogins: (recent.data || []).map(mapRow),
          source: 'supabase',
        };
      }
      console.error('[AUDITORIA] Error en estadísticas:', total.error.code, total.error.message);
    } catch (err: any) {
      console.error('[AUDITORIA] Excepción en estadísticas:', err?.message || err);
    }
  }

  const logs = _cachedAuditLogs;
  const accesses = logs.filter((l) => l.module === 'Acceso');
  const ids = new Set<string>();
  logs.forEach((l) => {
    const k = l.userEmail || l.userName;
    if (k) ids.add(k.toLowerCase());
  });
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return {
    totalLogs: logs.length,
    totalAccesses: accesses.length,
    totalLogins: logs.filter((l) => l.action === 'LOGIN').length,
    failedLogins: logs.filter((l) => l.action === 'LOGIN_FAILED').length,
    totalChanges: logs.length - accesses.length,
    last24h: logs.filter((l) => new Date(l.timestamp).getTime() >= since).length,
    activeUsersCount: ids.size,
    recentLogins: accesses.slice(0, 5),
    source: 'memoria',
  };
}
