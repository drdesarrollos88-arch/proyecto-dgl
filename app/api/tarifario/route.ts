import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getTarifarioAsync,
  updateTarifarioItemAsync,
  createTarifarioItemAsync,
  batchMoveTarifarioItemsAsync,
} from '@/lib/tarifario-db';
import { isAdminRole } from '@/lib/permissions';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const items = await getTarifarioAsync();
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
    const body = await req.json();

    // Check for batch move operation
    if (body.action === 'batchMove') {
      const { ids, targetCc, targetCategory, targetSubcategory, targetSubSubcategory } = body;
      if (!Array.isArray(ids) || ids.length === 0 || !targetCc || !targetCategory) {
        return NextResponse.json(
          { error: 'Se requiere una lista de IDs, Centro de Costo y Categoría destino.' },
          { status: 400 }
        );
      }

      const result = await batchMoveTarifarioItemsAsync(
        ids,
        targetCc,
        targetCategory,
        targetSubcategory || targetCategory,
        targetSubSubcategory || '',
        currentUser.name
      );

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Error al mover los ensayos en lote.' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Se movieron ${result.count} ensayo(s) exitosamente.`,
        count: result.count,
      });
    }

    const { id, updates } = body;
    if (!id || !updates) {
      return NextResponse.json({ error: 'ID y datos a actualizar son requeridos' }, { status: 400 });
    }

    const updated = await updateTarifarioItemAsync(id, updates, currentUser.name);
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

    const newItem = await createTarifarioItemAsync(
      {
        code: itemData.code || '',
        category: itemData.category || 'ENSAYOS GENERALES',
        subcategory: itemData.subcategory || itemData.category || 'ENSAYOS GENERALES',
        subSubcategory: itemData.subSubcategory || '',
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

