import { NextRequest, NextResponse } from 'next/server';
import { generatePkce, buildSalesforceAuthUrl } from '@/lib/salesforce/salesforce-client';

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;
    const { verifier, challenge } = await generatePkce();

    const authUrl = await buildSalesforceAuthUrl(origin, challenge);

    const isPopup = req.nextUrl.searchParams.get('popup') === 'true';

    if (isPopup) {
      const response = NextResponse.json({ authUrl });
      response.cookies.set('sf_pkce_verifier', verifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 600, // 10 minutos
      });
      return response;
    }

    const response = NextResponse.redirect(authUrl);
    response.cookies.set('sf_pkce_verifier', verifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return response;
  } catch (error: any) {
    console.error('Error iniciando flujo de login en Salesforce:', error);
    return NextResponse.json({ error: error?.message || 'Error al conectar con Salesforce' }, { status: 500 });
  }
}

