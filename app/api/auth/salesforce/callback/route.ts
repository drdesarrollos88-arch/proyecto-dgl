import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/salesforce/salesforce-client';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  const errorDesc = req.nextUrl.searchParams.get('error_description');

  if (error || !code) {
    const errorMsg = errorDesc || error || 'Autorización cancelada o denegada en Salesforce';
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head><title>Error de Autorización - Salesforce</title></head>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #FFF5F5;">
          <div style="background: white; border: 1px solid #FEB2B2; border-radius: 12px; padding: 24px; max-width: 420px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <h2 style="color: #C53030; margin-top: 0;">Error de Conexión</h2>
            <p style="color: #4A5568; font-size: 14px;">${errorMsg}</p>
            <button onclick="window.close()" style="margin-top: 16px; padding: 8px 16px; background: #C53030; color: white; border: none; border-radius: 6px; cursor: pointer;">Cerrar ventana</button>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SALESFORCE_AUTH_ERROR', message: ${JSON.stringify(errorMsg)} }, '*');
            }
          </script>
        </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const verifier = req.cookies.get('sf_pkce_verifier')?.value;
  if (!verifier) {
    return NextResponse.redirect(new URL('/cotizaciones?salesforce_error=missing_verifier', req.nextUrl.origin));
  }

  try {
    const authData = await exchangeCodeForTokens(code, verifier, req.nextUrl.origin);

    const html = `<!DOCTYPE html>
    <html>
      <head>
        <title>Salesforce Conectado - IDIEM</title>
      </head>
      <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #F0FFF4;">
        <div style="background: white; border: 1px solid #9AE6B4; border-radius: 16px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">
          <div style="width: 52px; height: 52px; background: #C6F6D5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 24px;">
            ✓
          </div>
          <h2 style="color: #22543D; margin-top: 0; margin-bottom: 8px;">¡Conexión Exitosa!</h2>
          <p style="color: #4A5568; font-size: 14px; margin-bottom: 16px;">
            Salesforce se vinculó correctamente con la cuenta de <strong>${authData.userName || authData.userEmail}</strong>.
          </p>
          <p style="color: #718096; font-size: 12px;">Esta ventana se cerrará automáticamente en unos segundos...</p>
          <a href="/cotizaciones?salesforce=connected" style="display: inline-block; margin-top: 12px; font-size: 12px; color: #2B6CB0; text-decoration: underline;">Volver a Cotizaciones</a>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'SALESFORCE_AUTH_SUCCESS', user: ${JSON.stringify(authData.userName)} }, '*');
            setTimeout(() => window.close(), 1200);
          } else {
            setTimeout(() => {
              window.location.href = '/cotizaciones?salesforce=connected';
            }, 1500);
          }
        </script>
      </body>
    </html>`;

    const res = new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });

    res.cookies.delete('sf_pkce_verifier');
    return res;
  } catch (err: any) {
    console.error('Error procesando callback de Salesforce:', err);
    return NextResponse.redirect(
      new URL(`/cotizaciones?salesforce_error=${encodeURIComponent(err.message || 'error_intercambio')}`, req.nextUrl.origin)
    );
  }
}

