import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { SessionUser } from './types';
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
      role: payload.role as 'admin' | 'comercial',
      profileId: payload.profileId as string | undefined,
    };
  } catch {
    return null;
  }
}

// Obtener el usuario autenticado actual con sus permisos dinámicos vigentes
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    if (!session) return null;

    // Obtener los datos más actualizados del usuario en base de datos para recalcular permisos
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
export function findUserByIdentifier(identifier: string) {
  const isEmail = identifier.includes('@');
  if (isEmail) {
    return getUserByEmail(identifier);
  }
  return getUserByRut(identifier);
}


