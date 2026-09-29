import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SessionUser, UserRole } from './types';
import { getUserByEmail, getUserByRut, getUserById, getProfiles } from './db';
import { computeEffectivePermissions } from './permissions';

// Clave secreta para firma de tokens JWT
const rawAuthSecret = process.env.JWT_SECRET;
if (!rawAuthSecret && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is mandatory in production hosting.');
}
const JWT_SECRET = new TextEncoder().encode(
  rawAuthSecret || 'dgl-local-dev-internal-secret-change-in-production-2026'
);

// Nombre de la cookie de sesión oficial
export const AUTH_COOKIE_NAME = 'dgl_session_token';

// Generar hash seguro de contraseña mediante bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Verificar concordancia de contraseña en texto plano contra el hash almacenado
export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

// Crear token de sesión JWT con los datos base del usuario
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    rut: user.rut,
    name: user.name,
    email: user.email,
    role: user.role,
    profileId: user.profileId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// Verificar y decodificar el token de sesión JWT
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      rut: payload.rut as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as UserRole,
      profileId: payload.profileId as string | undefined,
    };
  } catch {
    return null;
  }
}

import { isSupabaseConfigured, supabaseAdmin } from './supabase';

// Obtener el usuario autenticado actual con sus permisos dinámicos vigentes
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    if (!session) return null;

    // 1. Intentar consultar en Supabase si está disponible
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: dbUser, error } = await supabaseAdmin
          .from('usuarios')
          .select('*')
          .eq('id', session.id)
          .maybeSingle();

        if (dbUser && !error) {
          const { data: profilesData } = await supabaseAdmin.from('user_profiles').select('*');
          const profiles = (profilesData && profilesData.length > 0)
            ? profilesData.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                isSystem: p.is_system,
                color: p.color,
                badge: p.badge,
                permissions: p.permissions || [],
                createdAt: p.created_at,
                updatedAt: p.updated_at,
              }))
            : getProfiles();

          const mappedUser = {
            id: dbUser.id,
            rut: dbUser.rut,
            name: dbUser.name,
            email: dbUser.email,
            passwordHash: dbUser.password_hash,
            role: dbUser.role,
            createdAt: dbUser.created_at,
            commercialTitle: dbUser.commercial_title,
            phone: dbUser.phone,
            commercialInitials: dbUser.commercial_initials,
            signature: dbUser.signature,
            profileId: dbUser.profile_id,
          };

          const permissions = computeEffectivePermissions(mappedUser, profiles);
          return {
            id: dbUser.id,
            rut: dbUser.rut,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
            profileId: dbUser.profile_id,
            permissions,
            commercialTitle: dbUser.commercial_title,
            phone: dbUser.phone,
            commercialInitials: dbUser.commercial_initials,
            signature: dbUser.signature,
          };
        }
      } catch (err) {
        console.error('Error fetching current user from Supabase:', err);
      }
    }

    // 2. Fallback a base de datos en memoria / local
    const dbUser = getUserById(session.id);
    if (dbUser) {
      const profiles = getProfiles();
      const permissions = computeEffectivePermissions(dbUser, profiles);
      return {
        id: dbUser.id,
        rut: dbUser.rut,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        profileId: dbUser.profileId,
        permissions,
        commercialTitle: dbUser.commercialTitle,
        phone: dbUser.phone,
        commercialInitials: dbUser.commercialInitials,
        signature: dbUser.signature,
      };
    }

    return session;
  } catch {
    return null;
  }
}

// Buscar usuario por correo electrónico o por RUT
export async function findUserByIdentifier(identifier: string) {
  // 1. Si Supabase está configurado, consultar tabla 'usuarios'
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const isEmail = identifier.includes('@');
      const query = supabaseAdmin.from('usuarios').select('*');
      const { data, error } = isEmail
        ? await query.ilike('email', identifier.trim()).maybeSingle()
        : await query.eq('rut', identifier.trim()).maybeSingle();

      if (data && !error) {
        return {
          id: data.id,
          rut: data.rut,
          name: data.name,
          email: data.email,
          passwordHash: data.password_hash,
          role: (data.role as UserRole) || 'comercial',
          createdAt: data.created_at,
          commercialTitle: data.commercial_title,
          phone: data.phone,
          commercialInitials: data.commercial_initials,
          signature: data.signature,
          profileId: data.profile_id,
        };
      }
    } catch (e) {
      console.error('Error querying Supabase usuarios:', e);
    }
  }

  // 2. Fallback a base de datos en memoria / local
  const isEmail = identifier.includes('@');
  if (isEmail) {
    return getUserByEmail(identifier);
  }
  return getUserByRut(identifier);
}


