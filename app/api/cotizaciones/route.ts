import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserById } from '@/lib/db';
import {
  getCotizacionesAsync,
  getCotizacionByIdAsync,
  saveCotizacionAsync,
  deleteCotizacionesBatchAsync,
} from '@/lib/cotizaciones-db';
import { upsertContacto } from '@/lib/contactos-db';
import { createOrGetProyecto } from '@/lib/proyectos-db';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canSeeAll = currentUser.role === 'admin' || hasPermission(currentUser, 'cotizaciones.ver_todas');
  let cotizaciones = await getCotizacionesAsync();
  if (!canSeeAll) {
    cotizaciones = cotizaciones.filter(
      (c) =>
        c.createdBy === currentUser.name ||
        c.createdById === currentUser.id ||
        c.commercialName === currentUser.name
    );
  }
  return NextResponse.json({ cotizaciones });
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const data = await req.json();

    if (!data.clientName) {
      return NextResponse.json({ error: 'Razón Social es obligatoria' }, { status: 400 });
    }

    // 0. Permission check for finalized / official quotes
    if (data.status === 'Finalizada' || data.status === 'Enviada' || data.status === 'Aprobada') {
      const canFinalize =
        currentUser.role === 'admin' || hasPermission(currentUser, 'cotizador.descargar_definitivo');
      if (!canFinalize) {
        return NextResponse.json(
          { error: 'Acceso denegado: No tienes permisos para emitir o finalizar cotizaciones oficiales.' },
          { status: 403 }
        );
      }
    }

    // 1. Authorization & IDOR Check
    let originalCreatedBy = currentUser.name;
    let originalCreatedById = currentUser.id;
    if (data.id) {
      const existing = await getCotizacionByIdAsync(data.id);
      if (existing) {
        const isOwner =
          existing.createdById === currentUser.id ||
          existing.createdBy === currentUser.name ||
          existing.commercialName === currentUser.name;

        if (currentUser.role !== 'admin' && !isOwner) {
          return NextResponse.json(
            { error: 'Acceso denegado: No tienes permisos para modificar esta cotización.' },
            { status: 403 }
          );
        }
        originalCreatedBy = existing.createdBy;
        originalCreatedById = existing.createdById || currentUser.id;
      }
    }

    // 2. Anti-Impersonation: Bind signature and commercial data to authenticated user
    const userProfile = getUserById(currentUser.id);
    const commercialName =
      currentUser.role === 'admin' && data.commercialName
        ? data.commercialName
        : userProfile?.name || currentUser.name;

    const commercialTitle =
      currentUser.role === 'admin' && data.commercialTitle !== undefined
        ? data.commercialTitle
        : userProfile?.commercialTitle || data.commercialTitle || '';

    const commercialInitials =
      currentUser.role === 'admin' && data.commercialInitials !== undefined
        ? data.commercialInitials
        : userProfile?.commercialInitials || data.commercialInitials || '';

    const commercialPhone =
      currentUser.role === 'admin' && data.commercialPhone !== undefined
        ? data.commercialPhone
        : userProfile?.phone || data.commercialPhone || '';

    const commercialEmail =
      currentUser.role === 'admin' && data.commercialEmail !== undefined
        ? data.commercialEmail
        : userProfile?.email || currentUser.email;

    const commercialSignature =
      currentUser.role === 'admin' && data.commercialSignature !== undefined
        ? data.commercialSignature
        : userProfile?.signature || data.commercialSignature || '';

    // 3. Auto-register or update contact (Email is unique ID)
    if (data.clientEmail && typeof data.clientEmail === 'string' && data.clientEmail.includes('@') && data.clientAttention?.trim()) {
      try {
        await upsertContacto({
          email: data.clientEmail.trim(),
          name: data.clientAttention.trim(),
          phone: data.clientPhone?.trim() || '',
          company: data.clientName?.trim() || '',
        });
      } catch (err) {
        console.error('Error auto-saving contacto in cotizacion:', err);
      }
    }

    // 4. Auto-register or link project (Unique, irrepeatable sequential ID)
    let assignedProjectId = data.projectId;
    if (data.projectName && typeof data.projectName === 'string' && data.projectName.trim()) {
      try {
        const proj = await createOrGetProyecto({
          id: data.projectId,
          name: data.projectName.trim(),
          reference: data.reference?.trim() || '',
          city: data.city?.trim() || '',
          clientName: data.clientName?.trim() || '',
        });
        assignedProjectId = proj.id;
      } catch (err) {
        console.error('Error auto-registering proyecto in cotizacion:', err);
      }
    }

    const saved = await saveCotizacionAsync({
      ...data,
      projectId: assignedProjectId || data.projectId,
      commercialName,
      commercialTitle,
      commercialInitials,
      commercialPhone,
      commercialEmail,
      commercialSignature,
      createdBy: originalCreatedBy,
      createdById: originalCreatedById,
      updatedBy: currentUser.name,
    });

    return NextResponse.json({ success: true, cotizacion: saved });
  } catch (err) {
    console.error('Error saving cotizacion:', err);
    return NextResponse.json({ error: 'Error al guardar la cotización' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canDelete = currentUser.role === 'admin' || hasPermission(currentUser, 'cotizaciones.eliminar');
  if (!canDelete) {
    return NextResponse.json(
      { error: 'No tienes permisos para eliminar cotizaciones.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Debe especificar un listado de IDs a eliminar.' }, { status: 400 });
    }

    const isAdmin = currentUser.role === 'admin';
    const result = await deleteCotizacionesBatchAsync(
      ids,
      currentUser.name,
      currentUser.id,
      isAdmin
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error batch deleting cotizaciones:', err);
    return NextResponse.json({ error: 'Error interno al eliminar cotizaciones' }, { status: 500 });
  }
}
