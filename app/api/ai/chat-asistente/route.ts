import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { chatAsistenteTecnicoComercial } from '@/lib/ai-service';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { mensaje, historial, itemsActuales, contexto, apiKey } = body;

    if (!mensaje || typeof mensaje !== 'string' || !mensaje.trim()) {
      return NextResponse.json({ error: 'El mensaje no puede estar vacío.' }, { status: 400 });
    }

    const resultado = await chatAsistenteTecnicoComercial({
      mensaje: mensaje.trim(),
      historial: Array.isArray(historial) ? historial : [],
      itemsActuales: Array.isArray(itemsActuales) ? itemsActuales : [],
      contexto: contexto || {},
      apiKey: apiKey?.trim(),
    });

    return NextResponse.json(resultado);
  } catch (err) {
    console.error('Error en /api/ai/chat-asistente:', err);
    return NextResponse.json(
      { error: 'Error interno al comunicarse con el Asistente IA.' },
      { status: 500 }
    );
  }
}

