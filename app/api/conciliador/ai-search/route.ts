import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdminRole } from '@/lib/permissions';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const isAuthorized =
    isSuperAdminRole(currentUser.role) || currentUser.profileId === 'superadmin';
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Acceso denegado: Restringido a Administrador / Soporte.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { query, eerrItems, sfItems, items } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Consulta no válida' }, { status: 400 });
    }

    const apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GOOGLE_GENAI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json({
        respuesta:
          'La clave de API de Gemini no está configurada en el entorno. No es posible generar sugerencias IA en vivo.',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Preparar resumen contextual compacto
    const contextoPrompt = `Eres el Auditor Asistente de Conciliación de IDIEM / DGL (Geotecnia y Laboratorio).
El usuario es el Administrador de Soporte y te hace una consulta sobre el cuadre entre el EERR (facturas y traspasos reales) y Salesforce (cuotas proyectadas).

CONTEXTO ACTUAL DEL MES:
- Total facturas en EERR: ${eerrItems?.length || 0}
- Total cuotas en Salesforce: ${sfItems?.length || 0}
- Muestra de registros EERR:
${JSON.stringify((eerrItems || []).slice(0, 15).map((e: any) => ({
  factura: e.referenciaExterna,
  rut: e.rut,
  cliente: e.razonSocial,
  ref: e.referenciaInterna,
  montoClp: e.montoClp,
})))}

- Muestra de cuotas Salesforce:
${JSON.stringify((sfItems || []).slice(0, 15).map((s: any) => ({
  cuota: s.numeroCuota,
  oportunidad: s.opportunityName,
  rut: s.rutEmpresa,
  cliente: s.cuenta,
  montoClp: s.montoClp,
})))}

PREGUNTA DEL USUARIO: "${query}"

INSTRUCCIONES:
1. Responde de forma muy precisa, profesional y concisa (máximo 3 párrafos o lista con viñetas).
2. Si el usuario pregunta por una empresa, proyecto, código o monto específico, busca en los datos y dile exactamente qué encontraste en el EERR y en Salesforce.
3. Si hay una discrepancia o coincidencia, indica el número de factura, el nombre de la oportunidad y el diferencial de dinero en CLP y UF aproximada.
4. Si sugieres una acción (ej: ajustar monto, vincular cuota o postergar mes), explícala claramente.`;

    const aiRes = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: contextoPrompt }] }],
    });

    const respuestaTexto = aiRes.text || 'Sin respuesta generada por el Asistente IA.';

    return NextResponse.json({ respuesta: respuestaTexto });
  } catch (err: any) {
    console.error('Error en /api/conciliador/ai-search:', err);
    return NextResponse.json(
      { error: err?.message || 'Error consultando al Asistente IA' },
      { status: 500 }
    );
  }
}

