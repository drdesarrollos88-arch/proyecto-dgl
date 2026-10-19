import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTicketsAsync, createTicketAsync } from '@/lib/tickets-service';
import { TicketInput } from '@/lib/tickets-types';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const tickets = await getTicketsAsync(user);
    return NextResponse.json({ success: true, tickets });
  } catch (err: any) {
    console.error('Error en GET /api/tickets:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al obtener tickets' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = (await req.json()) as TicketInput;

    if (!body.titulo || !body.descripcion) {
      return NextResponse.json(
        { error: 'El título y la descripción son obligatorios' },
        { status: 400 }
      );
    }

    const ticket = await createTicketAsync(body, user);
    return NextResponse.json({ success: true, ticket });
  } catch (err: any) {
    console.error('Error en POST /api/tickets:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al crear el ticket' },
      { status: 500 }
    );
  }
}

