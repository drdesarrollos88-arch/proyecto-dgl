import { User, UserRole, PermissionKey } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';
import { getUsers as getLocalUsers, createUser as createLocalUser, deleteUser as deleteLocalUser, getUserById as getLocalUserById, updateUserProfile as updateLocalUserProfile } from './db';

function mapSupabaseToUser(row: any): User {
  return {
    id: row.id,
    rut: row.rut || '',
    name: row.name || '',
    email: row.email ? row.email.toLowerCase() : '',
    passwordHash: row.password_hash || '',
    role: (row.role as UserRole) || 'comercial',
    profileId: row.profile_id || (row.role === 'superadmin' ? 'superadmin' : row.role === 'admin' ? 'admin' : 'comercial_senior'),
    customPermissions: Array.isArray(row.custom_permissions) ? row.custom_permissions : undefined,
    commercialTitle: row.commercial_title || '',
    phone: row.phone || '',
    commercialInitials: row.commercial_initials || '',
    signature: row.signature || '',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

function mapUserToSupabase(u: Partial<User>): any {
  return {
    id: u.id,
    rut: u.rut,
    name: u.name,
    email: u.email ? u.email.toLowerCase() : undefined,
    password_hash: u.passwordHash,
    role: u.role,
    profile_id: u.profileId,
    custom_permissions: u.customPermissions,
    commercial_title: u.commercialTitle || null,
    phone: u.phone || null,
    commercial_initials: u.commercialInitials || null,
    signature: u.signature || null,
    created_at: u.createdAt,
  };
}

/**
 * Obtiene todos los usuarios del sistema ordenados por fecha de creación descendente.
 * Lee desde Supabase con sincronización y fallback a memoria local.
 */
export async function getUsersAsync(): Promise<User[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(mapSupabaseToUser);
      }
      if (error) {
        console.warn('Advertencia al consultar usuarios en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('Excepción al conectar con Supabase en getUsersAsync:', err);
    }
  }

  // Fallback local
  return getLocalUsers();
}

/**
 * Obtiene un usuario específico por su ID.
 */
export async function getUserByIdAsync(id: string): Promise<User | undefined> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return mapSupabaseToUser(data);
      }
    } catch (err) {
      console.warn(`Error buscando usuario ${id} en Supabase:`, err);
    }
  }

  return getLocalUserById(id);
}

/**
 * Busca un usuario por correo electrónico.
 */
export async function getUserByEmailAsync(email: string): Promise<User | undefined> {
  const cleanEmail = email.trim().toLowerCase();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (!error && data) {
        return mapSupabaseToUser(data);
      }
    } catch (err) {
      console.warn(`Error buscando usuario por email ${cleanEmail} en Supabase:`, err);
    }
  }

  const local = getLocalUsers();
  return local.find((u) => u.email.toLowerCase() === cleanEmail);
}

/**
 * Busca un usuario por RUT.
 */
export async function getUserByRutAsync(rut: string): Promise<User | undefined> {
  const cleanRut = rut.replace(/[^0-9kK]/g, '').toLowerCase();
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*');

      if (!error && Array.isArray(data)) {
        const found = data.find((r) => (r.rut || '').replace(/[^0-9kK]/g, '').toLowerCase() === cleanRut);
        if (found) return mapSupabaseToUser(found);
      }
    } catch (err) {
      console.warn(`Error buscando usuario por rut en Supabase:`, err);
    }
  }

  const local = getLocalUsers();
  return local.find((u) => u.rut.replace(/[^0-9kK]/g, '').toLowerCase() === cleanRut);
}

/**
 * Crea un usuario persistente en Supabase y memoria.
 */
export async function createUserAsync(
  user: Omit<User, 'id' | 'createdAt'>
): Promise<User> {
  const now = new Date().toISOString();
  const id = `usr-${Date.now()}`;
  const fullUser: User = {
    ...user,
    id,
    createdAt: now,
  };

  // 1. Sincronizar en memoria / data local
  createLocalUser(fullUser);

  // 2. Persistir en Supabase
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const payload = mapUserToSupabase(fullUser);
      const { error } = await supabaseAdmin.from('usuarios').insert(payload);
      if (error) {
        console.error('Error insertando usuario en Supabase:', error.message);
      } else {
        console.log(`✓ Usuario ${fullUser.name} (${fullUser.email}) registrado en Supabase.`);
      }
    } catch (err) {
      console.error('Excepción al crear usuario en Supabase:', err);
    }
  }

  return fullUser;
}

/**
 * Actualiza un usuario persistente en Supabase y memoria.
 */
export async function updateUserAsync(
  id: string,
  updates: Partial<Omit<User, 'id' | 'createdAt'>>
): Promise<User | null> {
  // 1. Sincronizar en memoria / data local
  const localUpdated = updateLocalUserProfile(id, updates as any);

  // 2. Persistir en Supabase
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const payload: Record<string, any> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.email !== undefined) payload.email = updates.email.toLowerCase();
      if (updates.rut !== undefined) payload.rut = updates.rut;
      if (updates.role !== undefined) payload.role = updates.role;
      if (updates.profileId !== undefined) payload.profile_id = updates.profileId;
      if (updates.customPermissions !== undefined) payload.custom_permissions = updates.customPermissions;
      if (updates.commercialTitle !== undefined) payload.commercial_title = updates.commercialTitle;
      if (updates.phone !== undefined) payload.phone = updates.phone;
      if (updates.commercialInitials !== undefined) payload.commercial_initials = updates.commercialInitials;
      if (updates.signature !== undefined) payload.signature = updates.signature;
      if (updates.passwordHash !== undefined) payload.password_hash = updates.passwordHash;

      const { data, error } = await supabaseAdmin
        .from('usuarios')
        .update(payload)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (!error && data) {
        return mapSupabaseToUser(data);
      }
      if (error) {
        console.error(`Error actualizando usuario ${id} en Supabase:`, error.message);
      }
    } catch (err) {
      console.error(`Excepción al actualizar usuario ${id} en Supabase:`, err);
    }
  }

  return localUpdated;
}

/**
 * Elimina un usuario en Supabase y memoria.
 */
export async function deleteUserAsync(id: string): Promise<boolean> {
  // 1. Memoria local
  deleteLocalUser(id);

  // 2. Supabase
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin.from('usuarios').delete().eq('id', id);
      if (error) {
        console.error(`Error eliminando usuario ${id} en Supabase:`, error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error(`Excepción al eliminar usuario ${id} en Supabase:`, err);
      return false;
    }
  }

  return true;
}
