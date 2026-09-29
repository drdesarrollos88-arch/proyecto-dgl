import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getTarifario, updateTarifarioItem, createTarifarioItem } from '@/lib/db';
import { isAdminRole } from '@/lib/permissions';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const items = getTarifario();
  return NextResponse.json({ items });
}

export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  const canEdit = currentUser && (isAdminRole(currentUser.role) || currentUser.permissions?.includes('tarifario.editar'));
  if (!canEdit) {
    return NextResponse.json(
      { error: 'No tienes permisos para modificar el tarifario oficial.' },
      { status: 403 }
    );
  }

  try {
    const { id, updates } = await req.json();
    if (!id || !updates) {
      return NextResponse.json({ error: 'ID y datos a actualizar son requeridos' }, { status: 400 });
    }

    const updated = updateTarifarioItem(id, updates, currentUser.name);
    if (!updated) {
      return NextResponse.json({ error: 'Ítem no encontrado en el tarifario' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (err) {
    console.error('Error updating tarifario item:', err);
    return NextResponse.json({ error: 'Error al actualizar el ítem' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || !isAdminRole(currentUser.role)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden agregar ítems al tarifario oficial.' },
      { status: 403 }
    );
  }

  try {
    const itemData = await req.json();
    if (!itemData.designation || itemData.ufPrice === undefined) {
      return NextResponse.json(
        { error: 'Designación y Valor UF son obligatorios' },
        { status: 400 }
      );
    }

    const newItem = createTarifarioItem(
      {
        code: itemData.code || '',
        category: itemData.category || 'ENSAYOS GENERALES',
        subcategory: itemData.subcategory || itemData.category || 'ENSAYOS GENERALES',
        designation: itemData.designation,
        norm: itemData.norm || '',
        minWeightKg: itemData.minWeightKg || 0,
        unit: itemData.unit || 'c/u',
        ufPrice: Number(itemData.ufPrice),
        sku: itemData.sku || '',
        cc: itemData.cc || '',
      },
      currentUser.name
    );

    return NextResponse.json({ success: true, item: newItem });
  } catch (err) {
    console.error('Error adding tarifario item:', err);
    return NextResponse.json({ error: 'Error al crear el nuevo ítem' }, { status: 500 });
  }
}

