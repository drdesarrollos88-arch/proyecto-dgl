import { NextRequest, NextResponse } from 'next/server';
import { findUserByIdentifier, verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from '@/lib/auth';
import { checkDualRateLimit, recordDualFailedAttempt, resetDualLoginAttempts } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const body = await req.json().catch(() => ({}));
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Debe ingresar su correo o RUT y contraseña.' },
        { status: 400 }
      );
    }

    // Rate limit check: protects against both distributed IP attacks and single IP brute-force
    const rateCheck = checkDualRateLimit(ip, identifier);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Demasiados intentos fallidos. Por seguridad, intente nuevamente en ${Math.ceil(
            (rateCheck.retryAfterSeconds || 60) / 60
          )} minutos.`,
        },
        { status: 429 }
      );
    }

    const user = await findUserByIdentifier(identifier);
    if (!user) {
      recordDualFailedAttempt(ip, identifier);
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifique su correo/RUT y contraseña.' },
        { status: 401 }
      );
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      recordDualFailedAttempt(ip, identifier);
      return NextResponse.json(
        { error: 'Credenciales inválidas. Verifique su correo/RUT y contraseña.' },
        { status: 401 }
      );
    }

    // Login successful: reset rate limit tracking for both this IP and this user
    resetDualLoginAttempts(ip, identifier);

    const sessionUser = {
      id: user.id,
      rut: user.rut,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = await createSessionToken(sessionUser);

    const response = NextResponse.json({
      success: true,
      user: sessionUser,
    });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during login:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error inesperado al iniciar sesión.' },
      { status: 500 }
    );
  }
}
