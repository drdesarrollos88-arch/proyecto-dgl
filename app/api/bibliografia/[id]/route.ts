import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getBibliografiaById,
  toggleEstadoBibliografia,
  deleteBibliografiaItem,
  saveBibliografiaItem,
} from '@/lib/bibliografia-db';
import { registrarAuditoria } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const item = await getBibliografiaById(id);
  if (!item) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ success: true, item });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  try {
    if (body.action === 'toggleEstado') {
      const updated = await toggleEstadoBibliografia(id);
      if (!updated) {
        return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
      }

      await registrarAuditoria({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        action: 'BIBLIOGRAFIA_ESTADO',
        module: 'Bibliografía',
        description: `Cambio de estado en bibliografía: "${updated.titulo}" ahora está ${updated.estado}.`,
        details: { id: updated.id, estado: updated.estado, tipo: updated.tipo },
        ip,
      });

      return NextResponse.json({ success: true, item: updated });
    }

    // Actualización de campos
    const existing = await getBibliografiaById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
    }

    const updated = await saveBibliografiaItem({
      ...existing,
      ...body,
      id,
    });

    return NextResponse.json({ success: true, item: updated });
  } catch (err: any) {
    console.error('Error al actualizar bibliografía:', err);
    return NextResponse.json({ error: 'Error al actualizar el documento' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  const item = await getBibliografiaById(id);
  const success = await deleteBibliografiaItem(id);

  if (success && item) {
    await registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: 'BIBLIOGRAFIA_ELIMINAR',
      module: 'Bibliografía',
      description: `Eliminación de documento en bibliografía: "${item.titulo}" (${item.tipo}).`,
      details: { id: item.id, tipo: item.tipo, titulo: item.titulo },
      ip,
    });
  }

  return NextResponse.json({ success });
}

