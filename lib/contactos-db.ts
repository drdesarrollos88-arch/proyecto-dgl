import { Contacto } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';

const _memoryContactos: Map<string, Contacto> = new Map();

export async function searchContactos(query: string, limit = 10): Promise<Contacto[]> {
  const trimmed = (query || '').trim();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      let req = supabaseAdmin
        .from('contactos')
        .select('*')
        .limit(limit);

      if (trimmed) {
        req = req.or(`email.ilike.%${trimmed}%,name.ilike.%${trimmed}%,phone.ilike.%${trimmed}%,company.ilike.%${trimmed}%`);
      } else {
        req = req.order('updated_at', { ascending: false });
      }

      const { data, error } = await req;
      if (!error && data) {
        return data.map((r: any) => ({
          email: String(r.email || ''),
          name: String(r.name || ''),
          phone: String(r.phone || ''),
          company: r.company ? String(r.company) : undefined,
          createdAt: String(r.created_at || ''),
          updatedAt: String(r.updated_at || ''),
        }));
      }
    } catch (e) {
      console.error('Error querying contactos in Supabase:', e);
    }
  }

  // Fallback en memoria
  const all = Array.from(_memoryContactos.values());
  if (!trimmed) {
    return all.slice(0, limit);
  }
  const q = trimmed.toLowerCase();
  return all
    .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company && c.company.toLowerCase().includes(q)))
    .slice(0, limit);
}

export async function getContactoByEmail(email: string): Promise<Contacto | null> {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('contactos')
        .select('*')
        .ilike('email', normalized)
        .maybeSingle();

      if (!error && data) {
        return {
          email: String(data.email || ''),
          name: String(data.name || ''),
          phone: String(data.phone || ''),
          company: data.company ? String(data.company) : undefined,
          createdAt: String(data.created_at || ''),
          updatedAt: String(data.updated_at || ''),
        };
      }
    } catch (e) {
      console.error('Error fetching contacto by email in Supabase:', e);
    }
  }
  return _memoryContactos.get(normalized) || null;
}

export async function upsertContacto(data: {
  email: string;
  name: string;
  phone?: string;
  company?: string;
}): Promise<Contacto | null> {
  const email = (data.email || '').trim().toLowerCase();
  const name = (data.name || '').trim();
  const phone = (data.phone || '').trim();
  const company = (data.company || '').trim();

  if (!email || !email.includes('@')) return null;
  if (!name) return null;

  const now = new Date().toISOString();
  const contacto: Contacto = {
    email,
    name,
    phone,
    company: company || undefined,
    createdAt: now,
    updatedAt: now,
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('contactos').upsert({
        email,
        name,
        phone,
        company,
        updated_at: now,
      });
      return contacto;
    } catch (e) {
      console.error('Error upserting contacto in Supabase:', e);
    }
  }

  _memoryContactos.set(email, contacto);
  return contacto;
}

export async function deleteContacto(email: string): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('contactos').delete().ilike('email', normalized);
      return true;
    } catch (e) {
      console.error('Error deleting contacto in Supabase:', e);
    }
  }
  return _memoryContactos.delete(normalized);
}

export async function getAllContactos(limit = 100): Promise<Contacto[]> {
  return searchContactos('', limit);
}
