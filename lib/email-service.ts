import { UserRole } from './types';

export interface WelcomeEmailPayload {
  name: string;
  email: string;
  rut: string;
  provisionalPassword: string;
  role: UserRole;
  loginUrl?: string;
}

export interface EmailDispatchResult {
  success: boolean;
  provider: 'resend' | 'sendgrid' | 'brevo' | 'simulated';
  delivered: boolean;
  messageId?: string;
  error?: string;
  note?: string;
}

/**
 * Obtiene el nombre legible para mostrar del rol asignado.
 */
function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'superadmin':
      return 'Administrador / Soporte';
    case 'admin':
      return 'Administrador';
    case 'comercial':
    default:
      return 'Comercial (Personal de Cotizaciones / Laboratorio)';
  }
}

/**
 * Genera la plantilla HTML corporativa para la notificación de bienvenida y credenciales provisorias.
 */
export function generateWelcomeEmailHtml(payload: WelcomeEmailPayload): string {
  const roleLabel = getRoleLabel(payload.role);
  const targetLoginUrl = payload.loginUrl || 'https://dgl-cotizador.dr-desarrollos88.workers.dev/login';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acceso a Plataforma Cotizador DGL - IDIEM</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <!-- Contenedor Principal -->
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          
          <!-- Encabezado Institucional -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: left; border-bottom: 3px solid #E20000;">
              <div style="color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">
                IDIEM • Universidad de Chile
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800; line-height: 1.3;">
                Sistema de Cotizaciones DGL
              </h1>
              <div style="color: #94a3b8; font-size: 13px; margin-top: 4px;">
                División Geotecnia y Laboratorio
              </div>
            </td>
          </tr>

          <!-- Contenido del Mensaje -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 18px; font-weight: 700;">
                ¡Hola, ${payload.name}!
              </h2>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Te informamos que se ha creado exitosamente tu cuenta de usuario para acceder a la plataforma web oficial de <strong>Cotizaciones DGL</strong> de IDIEM.
              </p>

              <!-- Tarjeta de Credenciales -->
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 22px; margin: 24px 0;">
                <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                  📋 Tus Credenciales de Acceso
                </div>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="6" style="font-size: 13px;">
                  <tr>
                    <td width="38%" style="color: #64748b; font-weight: 600;">Correo Electrónico:</td>
                    <td style="color: #0f172a; font-weight: 700;">${payload.email}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">RUT de Usuario:</td>
                    <td style="color: #0f172a; font-family: monospace; font-size: 13px;">${payload.rut}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600;">Rol Asignado:</td>
                    <td style="color: #0369a1; font-weight: 700;">${roleLabel}</td>
                  </tr>
                  <tr>
                    <td style="color: #64748b; font-weight: 600; vertical-align: middle;">Contraseña Provisoria:</td>
                    <td style="vertical-align: middle;">
                      <span style="display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 800; background-color: #fef3c7; color: #92400e; padding: 5px 12px; border-radius: 6px; border: 1px solid #fcd34d; letter-spacing: 0.5px;">
                        ${payload.provisionalPassword}
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Indicación de Seguridad -->
              <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px 8px 8px 4px; padding: 14px 16px; margin: 20px 0 28px 0;">
                <div style="font-size: 13px; font-weight: 700; color: #1e40af; margin-bottom: 4px;">
                  🔒 Cambio Obligatorio de Contraseña
                </div>
                <div style="font-size: 12px; color: #1e3a8a; line-height: 1.5;">
                  Por motivos de seguridad informática, la contraseña anterior es de carácter <strong>provisorio</strong>. Te recomendamos ingresar al sistema y actualizarla inmediatamente desde el menú de <strong>Configuración / Mi Perfil</strong> (ubicado en la esquina superior derecha).
                </div>
              </div>

              <!-- Botón de Acción -->
              <div style="text-align: center; margin: 32px 0 24px 0;">
                <a href="${targetLoginUrl}" target="_blank" style="background-color: #E20000; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 14px; font-weight: 700; display: inline-block; box-shadow: 0 4px 12px rgba(226, 0, 0, 0.25);">
                  Ingresar a la Plataforma &rarr;
                </a>
              </div>

              <div style="text-align: center; font-size: 11px; color: #94a3b8;">
                O copia y pega este enlace directo en tu navegador:<br>
                <a href="${targetLoginUrl}" style="color: #3b82f6; text-decoration: underline;">${targetLoginUrl}</a>
              </div>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
              <p style="margin: 0 0 6px 0;">
                Este es un mensaje automático generado por el Sistema de Cotizaciones DGL IDIEM.
              </p>
              <p style="margin: 0;">
                Si no esperabas recibir este correo o tienes inconvenientes para ingresar, por favor comunícate con el área de <strong>Administración / Soporte DGL</strong>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Despacha el correo de bienvenida utilizando el proveedor configurado
 * (Resend, SendGrid, Brevo o registro seguro en servidor).
 */
export async function sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<EmailDispatchResult> {
  const subject = 'Bienvenido a la Plataforma Cotizador DGL - IDIEM | Acceso a tu cuenta';
  const html = generateWelcomeEmailHtml(payload);
  const fromAddress = process.env.EMAIL_FROM || 'Cotizador DGL IDIEM <notificaciones@dr-desarrollos.cl>';

  // 1. Proveedor Resend (API REST HTTP compatible con Cloudflare Workers)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress.includes('@') ? fromAddress : 'onboarding@resend.dev',
          to: [payload.email.trim().toLowerCase()],
          subject,
          html,
        }),
      });

      const data = await res.json();
      if (res.ok && data?.id) {
        console.log(`✓ [EMAIL RESEND] Correo de bienvenida enviado a ${payload.email} (ID: ${data.id})`);
        return {
          success: true,
          provider: 'resend',
          delivered: true,
          messageId: data.id,
        };
      } else {
        console.warn('⚠️ [EMAIL RESEND] Error al despachar correo:', data);
      }
    } catch (err: any) {
      console.error('❌ [EMAIL RESEND] Excepción al enviar correo:', err?.message || err);
    }
  }

  // 2. Proveedor SendGrid (API REST HTTP v3)
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (sendgridApiKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.email.trim().toLowerCase() }] }],
          from: { email: fromAddress.includes('@') ? fromAddress.replace(/.*<([^>]+)>.*/, '$1') : 'notificaciones@idiem.cl' },
          subject,
          content: [{ type: 'text/html', value: html }],
        }),
      });

      if (res.status >= 200 && res.status < 300) {
        console.log(`✓ [EMAIL SENDGRID] Correo de bienvenida enviado a ${payload.email}`);
        return {
          success: true,
          provider: 'sendgrid',
          delivered: true,
        };
      }
    } catch (err: any) {
      console.error('❌ [EMAIL SENDGRID] Excepción al enviar correo:', err?.message || err);
    }
  }

  // 3. Proveedor Brevo / Sendinblue (API REST HTTP v3)
  const brevoApiKey = process.env.BREVO_API_KEY;
  if (brevoApiKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Cotizador DGL IDIEM', email: fromAddress.includes('@') ? fromAddress.replace(/.*<([^>]+)>.*/, '$1') : 'notificaciones@idiem.cl' },
          to: [{ email: payload.email.trim().toLowerCase(), name: payload.name }],
          subject,
          htmlContent: html,
        }),
      });

      if (res.status >= 200 && res.status < 300) {
        console.log(`✓ [EMAIL BREVO] Correo de bienvenida enviado a ${payload.email}`);
        return {
          success: true,
          provider: 'brevo',
          delivered: true,
        };
      }
    } catch (err: any) {
      console.error('❌ [EMAIL BREVO] Excepción al enviar correo:', err?.message || err);
    }
  }

  // 4. Modo Simulado / Registro Seguro en Servidor
  console.log(`\n============================================================`);
  console.log(`📧 [NOTIFICACIÓN DE NUEVO USUARIO - CORREO GENERADO]`);
  console.log(`Para: ${payload.name} <${payload.email}>`);
  console.log(`RUT: ${payload.rut}`);
  console.log(`Rol: ${getRoleLabel(payload.role)}`);
  console.log(`Contraseña provisoria: ${payload.provisionalPassword}`);
  console.log(`URL de login: ${payload.loginUrl || 'https://dgl-cotizador.dr-desarrollos88.workers.dev/login'}`);
  console.log(`Aviso: Configure RESEND_API_KEY en .env.local para el despacho SMTP real.`);
  console.log(`============================================================\n`);

  return {
    success: true,
    provider: 'simulated',
    delivered: false,
    note: 'El correo fue generado y registrado. Para envío automático vía internet configure RESEND_API_KEY en variables de entorno.',
  };
}
