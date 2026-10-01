import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getTarifarioAsync,
  updateTarifarioItemAsync,
  createTarifarioItemAsync,
  batchMoveTarifarioItemsAsync,
  batchUpdateTarifarioPricesAsync,
} from '@/lib/tarifario-db';
import { isAdminRole } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit-db';

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

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
      registrarAuditoria({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        action: 'TARIFARIO_MOVER',
        module: 'Tarifario',
        description: `Reorganización de ${result.count} ensayos a destino: [${targetCc}] ${targetCategory} > ${targetSubcategory || targetCategory}`,
        details: { ids, targetCc, targetCategory, targetSubcategory, count: result.count },
        ip,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Se movieron ${result.count} ensayo(s) exitosamente.`,
        count: result.count,
      });
    }

    // Check for batch price update
    if (body.action === 'batchUpdatePrices') {
      const { updates } = body;
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json(
          { error: 'Se requiere una lista de actualizaciones de precios.' },
          { status: 400 }
        );
      }

      const validUpdates = updates
        .filter((u: any) => u && typeof u.id === 'string' && u.ufPrice !== undefined && !isNaN(Number(u.ufPrice)))
        .map((u: any) => ({
          id: String(u.id),
          ufPrice: Number(u.ufPrice),
        }));

      if (validUpdates.length === 0) {
        return NextResponse.json(
          { error: 'No se encontraron actualizaciones de precios válidas.' },
          { status: 400 }
        );
      }

      const result = await batchUpdateTarifarioPricesAsync(validUpdates, currentUser.name);

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
      registrarAuditoria({
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        userRole: currentUser.role,
        action: 'TARIFARIO_EDITAR_MASIVO',
        module: 'Tarifario',
        description: `Actualización rápida de precios en lista para ${result.count} ensayo(s) del tarifario`,
        details: { count: result.count, updates: validUpdates.slice(0, 50) },
        ip,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Se actualizaron ${result.count} precio(s) exitosamente.`,
        count: result.count,
        updatedItems: result.updatedItems,
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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: 'TARIFARIO_EDITAR',
      module: 'Tarifario',
      description: `Edición de ensayo [Cód: ${updated.code}]: "${updated.designation}" (UF: ${updated.ufPrice})`,
      details: { id: updated.id, code: updated.code, updates },
      ip,
    }).catch(() => {});

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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: 'TARIFARIO_NUEVO',
      module: 'Tarifario',
      description: `Creación de nuevo ensayo oficial [Cód: ${newItem.code}]: "${newItem.designation}" en CC ${newItem.cc}`,
      details: { id: newItem.id, code: newItem.code, cc: newItem.cc, ufPrice: newItem.ufPrice },
      ip,
    }).catch(() => {});

    return NextResponse.json({ success: true, item: newItem });
  } catch (err) {
    console.error('Error adding tarifario item:', err);
    return NextResponse.json({ error: 'Error al crear el nuevo ítem' }, { status: 500 });
  }
}

