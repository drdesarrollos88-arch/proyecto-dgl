import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { updateTicketAsync, deleteTicketAsync } from '@/lib/tickets-service';
import { isSuperAdminRole, isAdminRole } from '@/lib/permissions';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!isSuperAdminRole(user.role) && !isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes para editar tickets' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updated = await updateTicketAsync(id, body, user);
    if (!updated) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err: any) {
    console.error('Error en PATCH /api/tickets/[id]:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al actualizar el ticket' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (!isSuperAdminRole(user.role) && !isAdminRole(user.role)) {
      return NextResponse.json({ error: 'Permisos insuficientes para eliminar tickets' }, { status: 403 });
    }

    const { id } = await params;
    const deleted = await deleteTicketAsync(id, user);

    if (!deleted) {
      return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Ticket eliminado correctamente' });
  } catch (err: any) {
    console.error('Error en DELETE /api/tickets/[id]:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al eliminar el ticket' },
      { status: 500 }
    );
  }
}

