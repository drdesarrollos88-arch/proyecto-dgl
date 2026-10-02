import { NextRequest, NextResponse } from 'next/server';
import { analizarSolicitudConIa } from '@/lib/ai-service';
import { saveCotizacionAsync } from '@/lib/cotizaciones-db';
import { getNextCorrelativo } from '@/lib/db';
import { getUsersAsync } from '@/lib/users-db';
import { upsertContacto } from '@/lib/contactos-db';
import { createOrGetProyecto } from '@/lib/proyectos-db';
import { registrarAuditoria } from '@/lib/audit-db';
import { Cotizacion, CotizacionItem } from '@/lib/types';

// Token secreto para comunicación segura con Google Apps Script
const INBOUND_EMAIL_SECRET =
  process.env.DGL_INBOUND_EMAIL_SECRET?.trim() || 'dgl_secret_workspace_2026';

export async function POST(req: NextRequest) {
  try {
    // 1. Verificación de Seguridad del Token
    const authHeader = req.headers.get('authorization') || '';
    const apiKeyHeader = req.headers.get('x-dgl-api-key') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim() || apiKeyHeader.trim();

    if (token !== INBOUND_EMAIL_SECRET) {
      return NextResponse.json(
        { error: 'No autorizado. Token de integración de correo inválido.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      senderEmail,
      senderName,
      analystEmail,
      analystName,
      subject,
      bodyText,
      attachments,
    } = body;

    if (!bodyText && (!attachments || attachments.length === 0)) {
      return NextResponse.json(
        { error: 'El correo debe contener texto o al menos un archivo adjunto.' },
        { status: 400 }
      );
    }

    // 2. Detección de Enlaces Externos en el texto (Google Drive, WeTransfer, OneDrive, etc.)
    const linkRegex = /(https?:\/\/(?:drive\.google\.com|wetransfer\.com|dropbox\.com|onedrive\.live\.com|1drv\.ms|[a-zA-Z0-9.-]+\.sharepoint\.com)[^\s"'>]+)/gi;
    const detectedLinks: string[] = [];
    let match;
    const textToCheck = `${subject || ''} ${bodyText || ''}`;
    while ((match = linkRegex.exec(textToCheck)) !== null) {
      if (!detectedLinks.includes(match[1])) {
        detectedLinks.push(match[1]);
      }
    }

    // 3. Procesar Adjunto Principal si existe
    let primaryAttachmentBuffer: Buffer | undefined;
    let primaryAttachmentMime: string | undefined;
    let primaryAttachmentName: string | undefined;
    const secondaryAttachmentNames: string[] = [];

    if (Array.isArray(attachments) && attachments.length > 0) {
      // Priorizar PDF, DOCX o XLSX
      const preferred =
        attachments.find((a: any) => a.mimeType?.includes('pdf') || a.filename?.endsWith('.pdf')) ||
        attachments.find((a: any) => a.mimeType?.includes('word') || a.filename?.endsWith('.docx')) ||
        attachments[0];

      if (preferred && preferred.base64) {
        try {
          primaryAttachmentBuffer = Buffer.from(preferred.base64, 'base64');
          primaryAttachmentMime = preferred.mimeType || 'application/pdf';
          primaryAttachmentName = preferred.filename || 'adjunto.pdf';
        } catch (e) {
          console.warn('Error decodificando adjunto base64:', e);
        }
      }

      attachments.forEach((a: any) => {
        if (a.filename && a.filename !== primaryAttachmentName) {
          secondaryAttachmentNames.push(a.filename);
        }
      });
    }

    // 4. Preparar el texto completo para el Asistente IA
    let promptFullText = `--- ASUNTO DEL CORREO: "${subject || 'Sin Asunto'}" ---\n`;
    promptFullText += `--- REMITENTE DEL CLIENTE: ${senderName || 'Contacto'} <${senderEmail || 'sin-correo'}> ---\n`;
    if (detectedLinks.length > 0) {
      promptFullText += `--- ENLACES DE DESCARGA EXTERNA DETECTADOS EN EL CORREO ---\n${detectedLinks.join('\n')}\n`;
    }
    if (secondaryAttachmentNames.length > 0) {
      promptFullText += `--- OTROS ARCHIVOS ADJUNTOS EN EL CORREO: ${secondaryAttachmentNames.join(', ')} ---\n`;
    }
    promptFullText += `\n--- CONTENIDO DEL MENSAJE / SOLICITUD ---\n${bodyText || ''}`;

    // 5. Invocación de la IA (Gemini con fallback heurístico)
    const aiResult = await analizarSolicitudConIa({
      texto: promptFullText,
      fileName: primaryAttachmentName,
      fileBuffer: primaryAttachmentBuffer,
      fileMimeType: primaryAttachmentMime,
    });

    // 6. Resolver el Analista Comercial Asignado (Diego Román, Ximena Garrido, etc.)
    const users = await getUsersAsync();
    const targetEmail = (analystEmail || '').toLowerCase().trim();
    const matchedUser = users.find(
      (u) =>
        u.email?.toLowerCase().trim() === targetEmail ||
        (analystName && u.name?.toLowerCase().includes(analystName.toLowerCase()))
    );

    const commercialName = matchedUser?.name || analystName || 'Diego Román';
    const commercialEmail = matchedUser?.email || analystEmail || 'diego.roman@idiem.cl';
    const commercialTitle = matchedUser?.commercialTitle || 'Asesor Comercial DGL';
    const commercialInitials = matchedUser?.commercialInitials || 'DRA';
    const commercialPhone = matchedUser?.phone || '+56 9 9123 4567';
    const commercialSignature = matchedUser?.signature || '';
    const createdById = matchedUser?.id || 'usr-1';

    // 7. Resolver Centro de Costo y Código Correlativo
    let rawCc = aiResult.datos_proyecto_detectados?.centro_costo_sugerido || '1817';
    const ccMatch = rawCc.match(/(\d{4})/);
    const cc = ccMatch ? ccMatch[1] : '1817';

    const correlativoInfo = getNextCorrelativo(cc);
    const code = correlativoInfo.code; // ej. PR.DGL.1817.2026.0605-V1

    // 8. Resolver Datos del Cliente y Proyecto
    const clientName =
      aiResult.datos_proyecto_detectados?.empresa_cliente ||
      senderName ||
      'Cliente Particular / En Evaluación';
    const clientEmail =
      aiResult.datos_proyecto_detectados?.contacto_email || senderEmail || '';
    const clientAttention =
      aiResult.datos_proyecto_detectados?.contacto_nombre || senderName || '';
    const clientPhone =
      aiResult.datos_proyecto_detectados?.contacto_telefono || '';
    const projectName =
      aiResult.datos_proyecto_detectados?.nombre_obra ||
      (subject ? subject.replace(/^re:\s*|^fwd:\s*|^rv:\s*/gi, '').trim() : 'Servicios Geotécnicos de Laboratorio');
    const city =
      aiResult.datos_proyecto_detectados?.ciudad_sede || 'Santiago';

    // Auto-registrar contacto si tiene correo
    if (clientEmail && clientEmail.includes('@') && clientAttention) {
      try {
        await upsertContacto({
          email: clientEmail,
          name: clientAttention,
          phone: clientPhone,
          company: clientName,
        });
      } catch (err) {
        console.error('Error auto-guardando contacto:', err);
      }
    }

    // Auto-registrar proyecto
    let assignedProjectId: string | undefined;
    try {
      const proj = await createOrGetProyecto({
        name: projectName,
        clientName: clientName,
        city: city,
        reference: subject || '',
      });
      assignedProjectId = proj.id;
    } catch (err) {
      console.error('Error auto-registrando proyecto:', err);
    }

    // 9. Mapear Ensayos Sugeridos por IA a CotizacionItem[]
    const items: CotizacionItem[] = aiResult.ensayos_sugeridos.map((ensayo, idx) => {
      const cantidad = ensayo.cantidad_estimada > 0 ? ensayo.cantidad_estimada : 1;
      const ufPrice = ensayo.precio_uf || 0;
      const subtotalUf = Number((ufPrice * cantidad).toFixed(3));
      const subtotalClp = Math.round(subtotalUf * 38000);

      return {
        id: `item-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        itemNumber: `1.${idx + 1}`,
        code: ensayo.codigo,
        sku: ensayo.sku || `COD-${ensayo.codigo}`,
        designation: ensayo.designacion,
        norm: ensayo.norma || 'Norma Chilena / ASTM',
        minWeightKg: 0,
        unit: ensayo.unidad || 'Ensayo',
        ufPrice,
        factor: 1.0,
        quantity: cantidad,
        subtotalUf,
        subtotalClp,
      };
    });

    const totalUf = Number(
      items.reduce((acc, curr) => acc + curr.subtotalUf, 0).toFixed(2)
    );
    const totalClp = Math.round(totalUf * 38000);

    // 10. Construir Observaciones Técnicas
    const observations: string[] = [];
    observations.push(
      `Propuesta generada automáticamente por Asistente IA DGL desde correo electrónico de ${senderName || senderEmail || 'Cliente'} (Asunto: "${subject || 'Solicitud'}").`
    );

    if (detectedLinks.length > 0) {
      observations.push(
        `ATENCIÓN: La solicitud incluye enlace(s) de descarga externa (${detectedLinks.join(', ')}). Verificar si existen especificaciones adicionales.`
      );
    }

    if (primaryAttachmentName) {
      observations.push(
        `Documento técnico analizado: ${primaryAttachmentName}` +
          (secondaryAttachmentNames.length > 0
            ? ` (Otros adjuntos recibidos: ${secondaryAttachmentNames.join(', ')})`
            : '')
      );
    }

    if (aiResult.ensayos_no_disponibles_o_especiales?.length > 0) {
      aiResult.ensayos_no_disponibles_o_especiales.forEach((noDisp) => {
        observations.push(
          `Servicio no tabulado requerido: "${noDisp.ensayo_solicitado}" (${noDisp.motivo}).`
        );
      });
    }

    // 11. Estructura de la Cotización en Borrador
    const nowIso = new Date().toISOString();
    const newCotizacion: Omit<Cotizacion, 'id' | 'createdAt' | 'updatedAt'> = {
      code,
      date: nowIso.split('T')[0],
      clientName,
      clientRut: '',
      clientAttention,
      clientPhone,
      clientEmail,
      reference: subject || '',
      projectName,
      projectId: assignedProjectId,
      city,
      paymentCondition: '50% AL CONTADO Y 50% CONTRA ENTREGA',
      centroCosto: cc,
      currency: 'UF',
      commercialName,
      commercialTitle,
      commercialInitials,
      commercialPhone,
      commercialEmail,
      commercialSignature,
      ufValue: 38000,
      dollarValue: 950,
      items,
      totalUf,
      totalClp,
      totalWeightKg: 0,
      observations,
      status: 'Borrador',
      showEconomicIndicators: true,
      createdBy: commercialName,
      createdById,
      updatedBy: 'Asistente IA DGL (Email Inbound)',
    };

    const savedCotizacion = await saveCotizacionAsync(newCotizacion);

    // 12. Registrar en Auditoría Oficial
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    await registrarAuditoria({
      userId: createdById,
      userName: commercialName,
      userEmail: commercialEmail,
      userRole: 'comercial',
      action: 'COTIZACION_BORRADOR',
      module: 'Cotizaciones',
      description: `Borrador ${savedCotizacion.code} creado automáticamente por Asistente IA desde correo de ${senderEmail} ("${subject || 'Sin asunto'}").`,
      details: {
        correlativo: savedCotizacion.code,
        cliente: clientName,
        remitente: senderEmail,
        analista: commercialName,
        totalUf,
        itemsCount: items.length,
        adjuntos: primaryAttachmentName ? [primaryAttachmentName, ...secondaryAttachmentNames] : [],
        enlacesExternos: detectedLinks,
      },
      ip,
    }).catch(() => {});

    // URL directa para abrir la cotización en el cotizador
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://dgl-cotizador.dr-desarrollos88.workers.dev';
    const urlDirecta = `${baseUrl}/cotizador?id=${savedCotizacion.id}`;

    return NextResponse.json({
      success: true,
      cotizacionId: savedCotizacion.id,
      correlativo: savedCotizacion.code,
      clientName: savedCotizacion.clientName,
      projectName: savedCotizacion.projectName,
      analista: commercialName,
      totalUf: savedCotizacion.totalUf,
      totalClp: savedCotizacion.totalClp,
      itemsCount: items.length,
      urlDirecta,
      ensayosDetectados: items.map((it) => ({
        codigo: it.code,
        designacion: it.designation,
        cantidad: it.quantity,
        uf: it.ufPrice,
        subtotalUf: it.subtotalUf,
      })),
      resumenTecnico: aiResult.resumen_tecnico_proyecto,
      preguntasCliente: aiResult.preguntas_para_el_cliente,
      borradorCorreoAclaratorio: aiResult.borrador_correo_aclaratorio,
      enlacesDetectados: detectedLinks,
    });
  } catch (error: any) {
    console.error('Error procesando correo entrante en /api/ai/inbound-email:', error);
    return NextResponse.json(
      {
        error: 'Error interno al procesar el correo y generar la cotización.',
        detalle: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
