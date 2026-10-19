import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from './supabase';
import { TicketItem, TicketInput, TicketEstado } from './tickets-types';
import { SessionUser } from './types';
import { isSuperAdminRole, isAdminRole } from './permissions';

const KEY_TICKETS = 'tickets_soporte';
const TICKETS_FILE = path.join(process.cwd(), 'data', 'tickets.json');

let _memoryTickets: TicketItem[] | null = null;

function formatChileDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  }
}

/**
 * Obtiene todos los tickets persistidos desde memoria, Supabase o archivo local
 */
export async function getTicketsListAsync(): Promise<TicketItem[]> {
  if (_memoryTickets && _memoryTickets.length > 0) {
    return _memoryTickets;
  }

  // 1. Cargar desde Supabase
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      const { data, error } = await admin
        .from('configuracion_sistema')
        .select('value')
        .eq('key', KEY_TICKETS)
        .single();

      if (!error && data?.value && Array.isArray(data.value)) {
        _memoryTickets = data.value as TicketItem[];
        return _memoryTickets;
      }
    } catch (err) {
      console.warn('Error consultando tickets_soporte en Supabase:', err);
    }
  }

  // 2. Fallback a archivo local
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const raw = fs.readFileSync(TICKETS_FILE, 'utf-8');
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        _memoryTickets = list;
        return _memoryTickets;
      }
    }
  } catch {}

  return [];
}

/**
 * Guarda los tickets en memoria, Supabase y disco
 */
async function saveTicketsListAsync(tickets: TicketItem[]): Promise<void> {
  _memoryTickets = tickets;

  // 1. Supabase
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      await admin.from('configuracion_sistema').upsert({
        key: KEY_TICKETS,
        value: tickets,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error guardando tickets_soporte en Supabase:', err);
    }
  }

  // 2. Archivo local (solo si runtime node lo permite)
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf-8');
  } catch {}
}

/**
 * Consulta de tickets con filtrado por rol de usuario
 * (Superadmin ve todos; usuarios estándar pueden ver todos o sus propios reportes)
 */
export async function getTicketsAsync(user?: SessionUser | null): Promise<TicketItem[]> {
  const allTickets = await getTicketsListAsync();
  return allTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Crea un nuevo ticket registrando automáticamente solicitante, fecha y hora
 */
export async function createTicketAsync(input: TicketInput, user: SessionUser): Promise<TicketItem> {
  const existing = await getTicketsListAsync();
  const currentYear = new Date().getFullYear();

  // Calcular correlativo
  const nextNum = existing.length > 0 ? Math.max(...existing.map((t) => t.numero || 0)) + 1 : 1;
  const padNum = String(nextNum).padStart(4, '0');
  const ticketId = `TCK-${currentYear}-${padNum}`;

  const now = new Date();
  const nowIso = now.toISOString();
  const fechaChile = formatChileDate(now);

  const newTicket: TicketItem = {
    id: ticketId,
    numero: nextNum,
    tipo: input.tipo || 'error',
    prioridad: input.prioridad || 'media',
    estado: 'abierto',
    modulo: input.modulo || 'General / Otro',
    titulo: input.titulo.trim(),
    descripcion: input.descripcion.trim(),
    capturaPantalla: input.capturaPantalla || undefined,
    usuarioId: user.id,
    usuarioNombre: user.name || 'Usuario',
    usuarioEmail: user.email || '',
    usuarioRol: user.role || 'comercial',
    createdAt: nowIso,
    updatedAt: nowIso,
    fechaFormateada: fechaChile,
  };

  const updatedList = [newTicket, ...existing];
  await saveTicketsListAsync(updatedList);

  return newTicket;
}

/**
 * Actualiza un ticket (Estado, Prioridad, Notas del Superadmin)
 */
export async function updateTicketAsync(
  ticketId: string,
  updates: {
    estado?: TicketEstado;
    prioridad?: string;
    notasAdmin?: string;
  },
  user: SessionUser
): Promise<TicketItem | null> {
  const existing = await getTicketsListAsync();
  const idx = existing.findIndex((t) => t.id === ticketId);
  if (idx === -1) return null;

  const target = existing[idx];
  const now = new Date();
  const nowIso = now.toISOString();

  const isSuperadmin = isSuperAdminRole(user.role) || isAdminRole(user.role);

  const updated: TicketItem = {
    ...target,
    ...(updates.estado ? { estado: updates.estado as TicketEstado } : {}),
    ...(updates.prioridad ? { prioridad: updates.prioridad as any } : {}),
    ...(updates.notasAdmin !== undefined ? { notasAdmin: updates.notasAdmin } : {}),
    updatedAt: nowIso,
  };

  if (updates.estado === 'resuelto' || updates.estado === 'cerrado') {
    updated.resueltoPor = user.name;
    updated.resueltoEn = formatChileDate(now);
  }

  existing[idx] = updated;
  await saveTicketsListAsync(existing);

  return updated;
}

/**
 * Elimina un ticket (Solo Superadmin)
 */
export async function deleteTicketAsync(ticketId: string, user: SessionUser): Promise<boolean> {
  if (!isSuperAdminRole(user.role) && !isAdminRole(user.role)) {
    throw new Error('No autorizado para eliminar tickets');
  }

  const existing = await getTicketsListAsync();
  const filtered = existing.filter((t) => t.id !== ticketId);
  if (filtered.length === existing.length) return false;

  await saveTicketsListAsync(filtered);
  return true;
}

