import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdminRole } from '@/lib/permissions';
import {
  getTarifarioStructure,
  getTarifario,
  addCategoryToStructure,
  addSubcategoryToStructure,
  renameCategoryInDb,
  renameSubcategoryInDb,
  deleteCategoryFromStructure,
  deleteSubcategoryFromStructure,
} from '@/lib/db';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const structure = getTarifarioStructure();
  const items = getTarifario();

  // Compute counts
  const itemCounts: Record<string, number> = {};
  items.forEach((it) => {
    if (it.cc) {
      itemCounts[it.cc] = (itemCounts[it.cc] || 0) + 1;
      if (it.category) {
        const catKey = `${it.cc}:::${it.category}`;
        itemCounts[catKey] = (itemCounts[catKey] || 0) + 1;
        if (it.subcategory) {
          const subKey = `${it.cc}:::${it.category}:::${it.subcategory}`;
          itemCounts[subKey] = (itemCounts[subKey] || 0) + 1;
        }
      }
    }
  });

  return NextResponse.json({
    success: true,
    structure,
    itemCounts,
    totalItems: items.length,
    items,
  });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isAdminRole(currentUser.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes. Se requiere rol administrador.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, cc, category, subcategory, subcategories } = body;

    if (type === 'category') {
      if (!cc || !category) {
        return NextResponse.json({ error: 'Centro de costo y nombre de categoría requeridos.' }, { status: 400 });
      }
      const result = addCategoryToStructure(cc, category, subcategories || []);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Categoría creada con éxito.' });
    }

    if (type === 'subcategory') {
      if (!cc || !category || !subcategory) {
        return NextResponse.json(
          { error: 'Centro de costo, categoría y nombre de subcategoría requeridos.' },
          { status: 400 }
        );
      }
      const result = addSubcategoryToStructure(cc, category, subcategory);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Subcategoría creada con éxito.' });
    }

    return NextResponse.json({ error: 'Tipo de creación no reconocido.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al procesar solicitud.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isAdminRole(currentUser.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes. Se requiere rol administrador.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, cc, oldCategory, newCategory, category, oldSubcategory, newSubcategory } = body;

    if (type === 'renameCategory') {
      if (!cc || !oldCategory || !newCategory) {
        return NextResponse.json(
          { error: 'Centro de costo, categoría actual y nuevo nombre requeridos.' },
          { status: 400 }
        );
      }
      const result = renameCategoryInDb(cc, oldCategory, newCategory);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: `Categoría renombrada. Se actualizaron ${result.updatedCount} ensayo(s).`,
        updatedCount: result.updatedCount,
      });
    }

    if (type === 'renameSubcategory') {
      if (!cc || !category || !oldSubcategory || !newSubcategory) {
        return NextResponse.json(
          { error: 'Centro de costo, categoría, subcategoría actual y nuevo nombre requeridos.' },
          { status: 400 }
        );
      }
      const result = renameSubcategoryInDb(cc, category, oldSubcategory, newSubcategory);
      if (!result.success) {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        message: `Subcategoría renombrada. Se actualizaron ${result.updatedCount} ensayo(s).`,
        updatedCount: result.updatedCount,
      });
    }

    return NextResponse.json({ error: 'Tipo de actualización no reconocido.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!isAdminRole(currentUser.role)) {
    return NextResponse.json({ error: 'Permisos insuficientes. Se requiere rol administrador.' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { type, cc, category, subcategory } = body;

    if (type === 'category') {
      if (!cc || !category) {
        return NextResponse.json({ error: 'Centro de costo y categoría requeridos.' }, { status: 400 });
      }
      const result = deleteCategoryFromStructure(cc, category);
      if (!result.success) {
        return NextResponse.json({ error: result.message, count: result.count }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Categoría eliminada correctamente.' });
    }

    if (type === 'subcategory') {
      if (!cc || !category || !subcategory) {
        return NextResponse.json(
          { error: 'Centro de costo, categoría y subcategoría requeridos.' },
          { status: 400 }
        );
      }
      const result = deleteSubcategoryFromStructure(cc, category, subcategory);
      if (!result.success) {
        return NextResponse.json({ error: result.message, count: result.count }, { status: 400 });
      }
      return NextResponse.json({ success: true, message: 'Subcategoría eliminada correctamente.' });
    }

    return NextResponse.json({ error: 'Tipo de eliminación no reconocido.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al eliminar.' }, { status: 500 });
  }
}

