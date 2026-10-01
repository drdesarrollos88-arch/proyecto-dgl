import { Cotizacion, CotizacionItem } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';
import { advanceCorrelativo, saveCotizacion } from './db';
import initialDbData from '../data/db.json';

// Cache en memoria para soporte resiliente e instantáneo
let _cachedCotizaciones: Cotizacion[] | null = null;

function ensureCache(): Cotizacion[] {
  if (!_cachedCotizaciones) {
    try {
      const initial = (initialDbData as any)?.cotizaciones || [];
      _cachedCotizaciones = Array.isArray(initial) ? [...initial] : [];
    } catch {
      _cachedCotizaciones = [];
    }
  }
  return _cachedCotizaciones;
}

/**
 * Convierte un registro de Supabase (snake_case) a la interfaz Cotizacion de TypeScript (camelCase).
 */
export function mapSupabaseToCotizacion(row: any): Cotizacion {
  const items: CotizacionItem[] = Array.isArray(row.items) ? row.items : [];
  let calcUf = 0;
  let calcClp = 0;
  let totalWeightKg = 0;

  if (items.length > 0) {
    items.forEach((it: any) => {
      const subUf =
        typeof it.subtotalUf === 'number'
          ? it.subtotalUf
          : (it.ufPrice || 0) * (it.factor || 1) * (it.quantity || 1);
      const subClp =
        typeof it.subtotalClp === 'number' ? it.subtotalClp : subUf * (row.uf_value || 38000);
      calcUf += subUf;
      calcClp += subClp;
      const w =
        typeof it.minWeightKg === 'number' ? it.minWeightKg : parseFloat(String(it.minWeightKg || 0));
      if (!isNaN(w) && w > 0) totalWeightKg += w * (it.quantity || 1);
    });
  }

  const ufVal = typeof row.uf_value === 'number' && row.uf_value > 0 ? row.uf_value : 38000;
  const totalUf = typeof row.total_neto === 'number' && row.total_neto > 0
    ? row.total_neto
    : Number(calcUf.toFixed(2));
  const totalClp = calcClp > 0 ? Math.round(calcClp) : Math.round(totalUf * ufVal);

  const rawDate =
    row.date ||
    (row.created_at ? row.created_at.split('T')[0] : new Date().toISOString().split('T')[0]);
  const createdAt = row.created_at || new Date().toISOString();
  const updatedAt = row.updated_at || createdAt;

  return {
    id: row.id,
    code: row.code || row.correlativo || '',
    date: rawDate,
    clientName: row.client_name || 'Cliente Particular',
    clientRut: row.client_rut || '',
    clientAttention: row.contact_name || '',
    clientPhone: row.contact_phone || '',
    clientEmail: row.contact_email || '',
    reference: '',
    projectName: row.project_name || '',
    projectId: row.project_id || undefined,
    city: row.project_address || 'Santiago',
    paymentCondition: row.payment_terms || '50% AL CONTADO Y 50% CONTRA ENTREGA',
    centroCosto: row.centro_costo || '1817',
    currency: (row.currency as 'UF' | 'USD') || 'UF',
    commercialName: row.user_name || 'Diego Román',
    commercialTitle: 'Asesor Comercial DGL',
    commercialInitials: row.user_initials || 'DRA',
    ufValue: ufVal,
    dollarValue: 950,
    items,
    totalUf: Number(totalUf.toFixed(2)),
    totalClp: Math.round(totalClp),
    totalWeightKg,
    observations: Array.isArray(row.observations) ? row.observations : [],
    status: (row.status as any) || 'Borrador',
    aiChatState: row.ai_chat_state || row.aiChatState || undefined,
    createdAt,
    updatedAt,
    createdBy: row.user_name || 'Diego Román',
    createdById: row.user_id || 'usr-1',
    isDeleted: false,
  };
}

/**
 * Convierte un objeto Cotizacion de la aplicación a la fila de Supabase (snake_case).
 */
export function mapCotizacionToSupabase(c: Partial<Cotizacion>): any {
  const now = new Date().toISOString();
  const rawDate = c.date || now.split('T')[0];
  const year = parseInt(rawDate.substring(0, 4), 10) || new Date().getFullYear();

  let totalUf = typeof c.totalUf === 'number' && c.totalUf > 0 ? c.totalUf : 0;
  let totalClp = typeof c.totalClp === 'number' && c.totalClp > 0 ? c.totalClp : 0;

  if (totalUf === 0 && Array.isArray(c.items) && c.items.length > 0) {
    let calcUf = 0;
    let calcClp = 0;
    const ufVal = c.ufValue || 38000;
    c.items.forEach((it: any) => {
      const subUf =
        typeof it.subtotalUf === 'number'
          ? it.subtotalUf
          : (it.ufPrice || 0) * (it.factor || 1) * (it.quantity || 1);
      const subClp =
        typeof it.subtotalClp === 'number' ? it.subtotalClp : subUf * ufVal;
      calcUf += subUf;
      calcClp += subClp;
    });
    totalUf = Number(calcUf.toFixed(2));
    totalClp = Math.round(calcClp);
  }

  // En Supabase, la tabla maneja subtotal_neto, total_neto, iva y total en UF (currency = 'UF')
  // para evitar desbordes 'numeric field overflow' de columnas numeric(10,2) con montos CLP de 9+ dígitos.
  const ivaUf = Number((totalUf * 0.19).toFixed(2));
  const totalConIvaUf = Number((totalUf * 1.19).toFixed(2));

  return {
    id: c.id,
    correlativo: c.code || '',
    code: c.code || '',
    year,
    date: rawDate,
    client_name: c.clientName || 'Cliente Particular',
    client_rut: c.clientRut || null,
    contact_name: c.clientAttention || null,
    contact_email: c.clientEmail || null,
    contact_phone: c.clientPhone || null,
    project_name: c.projectName || null,
    project_address: c.city || null,
    centro_costo: c.centroCosto || '1817',
    user_id: c.createdById || 'usr-1',
    user_name: c.commercialName || c.createdBy || 'Diego Román',
    user_email: c.commercialEmail || 'diego.roman@idiem.cl',
    user_initials: c.commercialInitials || 'DRA',
    currency: c.currency || 'UF',
    uf_value: c.ufValue || 38000,
    subtotal_neto: totalUf,
    descuento_porcentaje: 0,
    descuento_monto: 0,
    total_neto: totalUf,
    iva: ivaUf,
    total: totalConIvaUf,
    status: c.status || 'Borrador',
    items: c.items || [],
    observations: c.observations || [],
    validity_days: 30,
    delivery_time: null,
    payment_terms: c.paymentCondition || null,
    version: 1,
    created_at: c.createdAt || now,
    updated_at: now,
  };
}

/**
 * Obtiene todas las cotizaciones ordenadas de la más reciente a la más antigua.
 * Lee prioritariamente desde Supabase y actualiza la caché local.
 */
export async function getCotizacionesAsync(includeDeleted = false): Promise<Cotizacion[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cotizaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map(mapSupabaseToCotizacion);
        // Sincronizar caché en memoria
        _cachedCotizaciones = mapped;
        return mapped.sort((a, b) => {
          const tA = new Date(a.createdAt || a.date).getTime();
          const tB = new Date(b.createdAt || b.date).getTime();
          return tB - tA;
        });
      }
      if (error) {
        console.warn('Advertencia al consultar cotizaciones en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Excepción al conectar con Supabase en getCotizacionesAsync:', err);
    }
  }

  // Fallback a memoria / data local
  const cached = ensureCache();
  const list = includeDeleted ? cached : cached.filter((c) => !c.isDeleted);
  return list.sort((a, b) => {
    const tA = new Date(a.createdAt || a.date).getTime();
    const tB = new Date(b.createdAt || b.date).getTime();
    return tB - tA;
  });
}

/**
 * Obtiene una cotización específica por su ID.
 */
export async function getCotizacionByIdAsync(id: string): Promise<Cotizacion | undefined> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('cotizaciones')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const mapped = mapSupabaseToCotizacion(data);
        // Actualizar en caché local si existe
        if (_cachedCotizaciones) {
          const idx = _cachedCotizaciones.findIndex((c) => c.id === id);
          if (idx >= 0) _cachedCotizaciones[idx] = mapped;
          else _cachedCotizaciones.unshift(mapped);
        }
        return mapped;
      }
    } catch (err) {
      console.warn(`Error buscando cotizacion ${id} en Supabase:`, err);
    }
  }

  // Fallback en memoria
  const cached = ensureCache();
  return cached.find((c) => c.id === id);
}

/**
 * Guarda o actualiza una cotización con persistencia permanente en Supabase.
 */
export async function saveCotizacionAsync(
  cotizacion: Omit<Cotizacion, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Promise<Cotizacion> {
  const cached = ensureCache();
  const now = new Date().toISOString();

  let targetId = cotizacion.id;
  let createdAt = now;

  if (targetId) {
    const existing = cached.find((c) => c.id === targetId);
    if (existing?.createdAt) {
      createdAt = existing.createdAt;
    }
  } else {
    targetId = `cot-${Date.now()}`;
  }

  // Avanzar correlativo oficial si corresponde
  if (cotizacion.code && cotizacion.centroCosto) {
    const match = cotizacion.code.match(/PR\.DGL\.(\d{4})\.\d{4}\.(\d+)/i);
    if (match) {
      const num = parseInt(match[2], 10);
      if (!isNaN(num)) {
        advanceCorrelativo(cotizacion.centroCosto, num);
      }
    }
  }

  const fullCotizacion: Cotizacion = {
    ...cotizacion,
    id: targetId,
    createdAt,
    updatedAt: now,
  } as Cotizacion;

  // 1. Actualizar caché en memoria y archivo local db.json
  const idx = cached.findIndex((c) => c.id === targetId);
  if (idx >= 0) {
    cached[idx] = fullCotizacion;
  } else {
    cached.unshift(fullCotizacion);
  }
  try {
    saveCotizacion(fullCotizacion);
  } catch {}

  // 2. Persistir en Supabase
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const payload = mapCotizacionToSupabase(fullCotizacion);
      const { error: supaErr } = await supabaseAdmin
        .from('cotizaciones')
        .upsert(payload, { onConflict: 'id' });

      if (supaErr) {
        console.error('Error al guardar cotización en Supabase:', supaErr.message);
      } else {
        console.log(`✓ Cotización ${fullCotizacion.code || fullCotizacion.id} persistida en Supabase.`);
      }
    } catch (err) {
      console.error('Excepción al persistir cotización en Supabase:', err);
    }
  }

  return fullCotizacion;
}

/**
 * Elimina una cotización en Supabase y memoria.
 */
export async function deleteCotizacionAsync(
  id: string,
  deletedBy?: string,
  deletedById?: string,
  isAdmin = false
): Promise<{ success: boolean; error?: string }> {
  const cached = ensureCache();
  const idx = cached.findIndex((c) => c.id === id);
  if (idx === -1) {
    return { success: false, error: 'Cotización no encontrada.' };
  }

  const cot = cached[idx];
  if (!isAdmin && (cot.status === 'Finalizada' || cot.status === 'Enviada' || cot.status === 'Aprobada')) {
    return {
      success: false,
      error: 'No es posible eliminar una cotización con estado Finalizada, Enviada o Aprobada (solo administradores).',
    };
  }

  cached.splice(idx, 1);

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from('cotizaciones').delete().eq('id', id);
      if (error) {
        console.error('Error al eliminar en Supabase:', error.message);
        return { success: false, error: error.message };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: true };
}

/**
 * Elimina múltiples cotizaciones en bloque en Supabase y memoria.
 */
export async function deleteCotizacionesBatchAsync(
  ids: string[],
  deletedBy?: string,
  deletedById?: string,
  isAdmin = false
): Promise<{ success: boolean; deletedIds: string[]; failed: { id: string; reason: string }[] }> {
  const cached = ensureCache();
  const toDelete: string[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const id of ids) {
    const cot = cached.find((c) => c.id === id);
    if (!cot) {
      // Intentar verificar si existe
      toDelete.push(id);
      continue;
    }

    if (!isAdmin && (cot.status === 'Finalizada' || cot.status === 'Enviada' || cot.status === 'Aprobada')) {
      failed.push({
        id,
        reason: `${cot.code || id}: Estado ${cot.status} protegido (solo administradores).`,
      });
      continue;
    }

    toDelete.push(id);
  }

  if (toDelete.length === 0) {
    return { success: false, deletedIds: [], failed };
  }

  // Eliminar de caché en memoria
  _cachedCotizaciones = cached.filter((c) => !toDelete.includes(c.id));

  // Eliminar en Supabase en una sola consulta batch
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from('cotizaciones').delete().in('id', toDelete);
      if (error) {
        console.error('Error al eliminar batch en Supabase:', error.message);
        return { success: false, deletedIds: [], failed: [{ id: 'all', reason: error.message }] };
      }
    } catch (err: any) {
      console.error('Excepción al eliminar batch en Supabase:', err);
      return { success: false, deletedIds: [], failed: [{ id: 'all', reason: err.message }] };
    }
  }

  return { success: true, deletedIds: toDelete, failed };
}

