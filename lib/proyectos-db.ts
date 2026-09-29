import { Proyecto } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';

const _memoryProyectos: Map<string, Proyecto> = new Map();

async function getNextId(): Promise<string> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('proyectos')
        .select('id')
        .like('id', 'PRY-%');

      if (!error && data) {
        let maxNum = 0;
        for (const row of data) {
          const numPart = parseInt(row.id.replace('PRY-', ''), 10);
          if (!isNaN(numPart) && numPart > maxNum) {
            maxNum = numPart;
          }
        }
        return `PRY-${String(maxNum + 1).padStart(4, '0')}`;
      }
    } catch (e) {
      console.error('Error calculating next project id in Supabase:', e);
    }
  }

  let maxNum = 0;
  for (const id of _memoryProyectos.keys()) {
    const numPart = parseInt(id.replace('PRY-', ''), 10);
    if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
    }
  }
  return `PRY-${String(maxNum + 1).padStart(4, '0')}`;
}

export async function searchProyectos(query: string, limit = 10): Promise<Proyecto[]> {
  const trimmed = (query || '').trim();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      let req = supabaseAdmin.from('proyectos').select('*').limit(limit);
      if (trimmed) {
        req = req.or(`name.ilike.%${trimmed}%,id.ilike.%${trimmed}%,reference.ilike.%${trimmed}%,client_name.ilike.%${trimmed}%`);
      } else {
        req = req.order('updated_at', { ascending: false });
      }

      const { data, error } = await req;
      if (!error && data) {
        return data.map((r: any) => ({
          id: String(r.id),
          name: String(r.name || ''),
          reference: r.reference ? String(r.reference) : undefined,
          city: r.city ? String(r.city) : undefined,
          clientName: r.client_name ? String(r.client_name) : undefined,
          createdAt: String(r.created_at || ''),
          updatedAt: String(r.updated_at || ''),
        }));
      }
    } catch (e) {
      console.error('Error querying proyectos in Supabase:', e);
    }
  }

  const all = Array.from(_memoryProyectos.values());
  if (!trimmed) return all.slice(0, limit);
  const q = trimmed.toLowerCase();
  return all
    .filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.reference && p.reference.toLowerCase().includes(q)) ||
        (p.clientName && p.clientName.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

export async function getProyectoById(id: string): Promise<Proyecto | null> {
  if (!id) return null;
  const cleanId = id.trim();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('proyectos')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (!error && data) {
        return {
          id: String(data.id),
          name: String(data.name || ''),
          reference: data.reference ? String(data.reference) : undefined,
          city: data.city ? String(data.city) : undefined,
          clientName: data.client_name ? String(data.client_name) : undefined,
          createdAt: String(data.created_at || ''),
          updatedAt: String(data.updated_at || ''),
        };
      }
    } catch (e) {
      console.error('Error fetching proyecto by id in Supabase:', e);
    }
  }
  return _memoryProyectos.get(cleanId) || null;
}

export async function getProyectoByName(name: string): Promise<Proyecto | null> {
  if (!name) return null;
  const cleanName = name.trim();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('proyectos')
        .select('*')
        .ilike('name', cleanName)
        .maybeSingle();

      if (!error && data) {
        return {
          id: String(data.id),
          name: String(data.name || ''),
          reference: data.reference ? String(data.reference) : undefined,
          city: data.city ? String(data.city) : undefined,
          clientName: data.client_name ? String(data.client_name) : undefined,
          createdAt: String(data.created_at || ''),
          updatedAt: String(data.updated_at || ''),
        };
      }
    } catch (e) {
      console.error('Error fetching proyecto by name in Supabase:', e);
    }
  }
  return (
    Array.from(_memoryProyectos.values()).find(
      (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase()
    ) || null
  );
}

export async function createOrGetProyecto(data: {
  id?: string;
  name: string;
  reference?: string;
  city?: string;
  clientName?: string;
}): Promise<Proyecto> {
  const name = (data.name || '').trim();
  if (!name) throw new Error('El nombre del proyecto es obligatorio');

  const now = new Date().toISOString();
  const ref = (data.reference || '').trim();
  const city = (data.city || '').trim();
  const clientName = (data.clientName || '').trim();

  // If specific ID is supplied
  if (data.id && data.id.trim()) {
    const existing = await getProyectoById(data.id.trim());
    if (existing) {
      const updated = {
        ...existing,
        name,
        reference: ref || existing.reference,
        city: city || existing.city,
        clientName: clientName || existing.clientName,
        updatedAt: now,
      };
      if (isSupabaseConfigured && supabaseAdmin) {
        try {
          await supabaseAdmin.from('proyectos').update({
            name,
            reference: updated.reference,
            city: updated.city,
            client_name: updated.clientName,
            updated_at: now,
          }).eq('id', existing.id);
        } catch (e) {
          console.error('Error updating proyecto in Supabase:', e);
        }
      }
      _memoryProyectos.set(existing.id, updated);
      return updated;
    }
  }

  // Check if project exists by name
  const existingByName = await getProyectoByName(name);
  if (existingByName) {
    const updated = {
      ...existingByName,
      reference: ref || existingByName.reference,
      city: city || existingByName.city,
      clientName: clientName || existingByName.clientName,
      updatedAt: now,
    };
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        await supabaseAdmin.from('proyectos').update({
          reference: updated.reference,
          city: updated.city,
          client_name: updated.clientName,
          updated_at: now,
        }).eq('id', existingByName.id);
      } catch (e) {
        console.error('Error updating proyecto by name in Supabase:', e);
      }
    }
    _memoryProyectos.set(existingByName.id, updated);
    return updated;
  }

  const nextId = await getNextId();
  const nuevo: Proyecto = {
    id: nextId,
    name,
    reference: ref || undefined,
    city: city || undefined,
    clientName: clientName || undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('proyectos').insert({
        id: nextId,
        name,
        reference: ref,
        city,
        client_name: clientName,
        created_at: now,
        updated_at: now,
      });
    } catch (e) {
      console.error('Error inserting proyecto in Supabase:', e);
    }
  }

  _memoryProyectos.set(nextId, nuevo);
  return nuevo;
}

export async function updateProyecto(
  id: string,
  data: {
    name: string;
    reference?: string;
    city?: string;
    clientName?: string;
  }
): Promise<Proyecto | null> {
  if (!id || !data.name?.trim()) return null;
  const existing = await getProyectoById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = data.name.trim();
  const ref = (data.reference || '').trim();
  const city = (data.city || '').trim();
  const clientName = (data.clientName || '').trim();

  const updated: Proyecto = {
    ...existing,
    name,
    reference: ref || undefined,
    city: city || undefined,
    clientName: clientName || undefined,
    updatedAt: now,
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('proyectos').update({
        name,
        reference: ref,
        city,
        client_name: clientName,
        updated_at: now,
      }).eq('id', id);
    } catch (e) {
      console.error('Error updating proyecto in Supabase:', e);
    }
  }

  _memoryProyectos.set(id, updated);
  return updated;
}

export async function deleteProyecto(id: string): Promise<boolean> {
  if (!id) return false;
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('proyectos').delete().eq('id', id);
      return true;
    } catch (e) {
      console.error('Error deleting proyecto in Supabase:', e);
    }
  }
  return _memoryProyectos.delete(id);
}

export async function getAllProyectos(limit = 100): Promise<Proyecto[]> {
  return searchProyectos('', limit);
}
