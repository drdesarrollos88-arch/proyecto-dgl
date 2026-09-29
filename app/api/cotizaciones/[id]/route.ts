import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getCotizacionByIdAsync,
  saveCotizacionAsync,
  deleteCotizacionAsync,
} from '@/lib/cotizaciones-db';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const cotizacion = await getCotizacionByIdAsync(id);

  if (!cotizacion) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ cotizacion });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const cotizacion = await getCotizacionByIdAsync(id);

  if (!cotizacion) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }

  const isOwner =
    cotizacion.createdBy === currentUser.name ||
    cotizacion.commercialName === currentUser.name;

  if (currentUser.role !== 'admin' && !isOwner) {
    return NextResponse.json(
      { error: 'No tienes permisos para modificar esta cotización.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { status } = body;

    const validStatuses = ['Borrador', 'Finalizada', 'Enviada', 'Aprobada', 'Rechazada'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
    }

    const updated = await saveCotizacionAsync({
      ...cotizacion,
      status: status || cotizacion.status,
      updatedBy: currentUser.name,
    });

    return NextResponse.json({ success: true, cotizacion: updated });
  } catch (err) {
    console.error('Error updating cotizacion status:', err);
    return NextResponse.json({ error: 'Error al actualizar cotización' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await context.params;
  const cotizacion = await getCotizacionByIdAsync(id);

  if (!cotizacion) {
    return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  }

  // Authorization check: Only admin or the creator of the quote can delete
  const isOwner =
    cotizacion.createdById === currentUser.id ||
    cotizacion.createdBy === currentUser.name ||
    cotizacion.commercialName === currentUser.name;

  if (currentUser.role !== 'admin' && !isOwner) {
    return NextResponse.json(
      { error: 'No tienes permisos para eliminar esta cotización. Solo administradores o el ejecutivo emisor pueden eliminarla.' },
      { status: 403 }
    );
  }

  const result = await deleteCotizacionAsync(id, currentUser.name, currentUser.id, currentUser.role === 'admin');

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Error al eliminar la cotización.' },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true });
}
