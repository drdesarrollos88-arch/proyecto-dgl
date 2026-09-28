import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchProyectos, createOrGetProyecto, updateProyecto, deleteProyecto } from '@/lib/proyectos-db';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10)) : 10;

  try {
    const proyectos = searchProyectos(q, limit);
    return NextResponse.json({ proyectos });
  } catch (err) {
    console.error('Error searching proyectos:', err);
    return NextResponse.json({ error: 'Error al buscar proyectos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, name, reference, city, clientName } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del proyecto es obligatorio.' }, { status: 400 });
    }

    const proyecto = createOrGetProyecto({
      id,
      name,
      reference: reference || '',
      city: city || '',
      clientName: clientName || '',
    });

    return NextResponse.json({ success: true, proyecto });
  } catch (err) {
    console.error('Error creating or getting proyecto:', err);
    return NextResponse.json({ error: 'Error al procesar el proyecto' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canManage = user.role === 'admin' || hasPermission(user, 'clientes.gestionar');
  if (!canManage) {
    return NextResponse.json(
      { error: 'Acceso denegado: No tienes permisos para editar proyectos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, name, reference, city, clientName } = body;

    if (!id || !id.trim()) {
      return NextResponse.json({ error: 'El ID del proyecto es obligatorio.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del proyecto es obligatorio.' }, { status: 400 });
    }

    const updated = updateProyecto(id, {
      name,
      reference: reference || '',
      city: city || '',
      clientName: clientName || '',
    });

    if (!updated) {
      return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, proyecto: updated });
  } catch (err) {
    console.error('Error updating proyecto:', err);
    return NextResponse.json({ error: 'Error al actualizar el proyecto' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canManage = user.role === 'admin' || hasPermission(user, 'clientes.gestionar');
  if (!canManage) {
    return NextResponse.json(
      { error: 'Acceso denegado: No tienes permisos para eliminar proyectos.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const idParam = searchParams.get('id');
  let id = idParam;

  if (!id) {
    try {
      const body = await req.json();
      id = body.id;
    } catch {}
  }

  if (!id || !id.trim()) {
    return NextResponse.json({ error: 'El ID del proyecto es obligatorio para eliminarlo.' }, { status: 400 });
  }

  const success = deleteProyecto(id.trim());
  if (!success) {
    return NextResponse.json({ error: 'Proyecto no encontrado o no pudo eliminarse.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

