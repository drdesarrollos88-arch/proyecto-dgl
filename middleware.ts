import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is mandatory in production hosting.');
}
const JWT_SECRET = new TextEncoder().encode(
  rawJwtSecret || 'dgl-local-dev-internal-secret-change-in-production-2026'
);

const AUTH_COOKIE_NAME = 'dgl_session_token';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Static files and public API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/public') ||
    pathname === '/favicon.ico' ||
    pathname === '/api/auth/login' ||
    /\.(png|jpg|jpeg|svg|webp|ico|css|js|woff|woff2|ttf)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  let user: { role?: string } | null = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, JWT_SECRET);
      user = payload as { role?: string };
    } catch {
      user = null;
    }
  }

  // If user is at /login
  if (pathname === '/login') {
    if (user) {
      return NextResponse.redirect(new URL('/cotizaciones', request.url));
    }
    return NextResponse.next();
  }

  // If user is NOT logged in and trying to access protected routes
  if (!user) {
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes (Permite roles 'admin' y 'superadmin')
  // /usuarios: Administración de usuarios y perfiles
  // /auditoria: Trazabilidad y auditoría
  // /configuracion/correlativos: Correlativos oficiales
  if (
    (pathname.startsWith('/usuarios') ||
      pathname.startsWith('/auditoria') ||
      pathname.startsWith('/configuracion/correlativos')) &&
    user.role !== 'admin' &&
    user.role !== 'superadmin'
  ) {
    return NextResponse.redirect(new URL('/cotizador', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

