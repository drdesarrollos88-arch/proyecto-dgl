import { NextResponse, NextRequest } from 'next/server';
import { AUTH_COOKIE_NAME, getCurrentUser } from '@/lib/auth';
import { registrarAuditoria, getClientIp } from '@/lib/audit-db';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (user) {
      const ip = getClientIp(req);
      await registrarAuditoria({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userRole: user.role,
        action: 'LOGOUT',
        module: 'Acceso',
        description: `Cierre de sesión: ${user.name}`,
        details: { email: user.email },
        ip,
      }).catch(() => {});
    }
  } catch {}

  const response = NextResponse.json({ success: true });
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}

