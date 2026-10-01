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
import { hasPermission, isAdminRole } from '@/lib/permissions';
import { registrarAuditoria } from '@/lib/audit-db';
import { AuditAction } from '@/lib/types';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canSeeAll = isAdminRole(currentUser.role) || hasPermission(currentUser, 'cotizaciones.ver_todas');
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
        isAdminRole(currentUser.role) || hasPermission(currentUser, 'cotizador.descargar_definitivo');
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

        if (!isAdminRole(currentUser.role) && !isOwner) {
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
      isAdminRole(currentUser.role) && data.commercialName
        ? data.commercialName
        : userProfile?.name || currentUser.name;

    const commercialTitle =
      isAdminRole(currentUser.role) && data.commercialTitle !== undefined
        ? data.commercialTitle
        : userProfile?.commercialTitle || data.commercialTitle || '';

    const commercialInitials =
      isAdminRole(currentUser.role) && data.commercialInitials !== undefined
        ? data.commercialInitials
        : userProfile?.commercialInitials || data.commercialInitials || '';

    const commercialPhone =
      isAdminRole(currentUser.role) && data.commercialPhone !== undefined
        ? data.commercialPhone
        : userProfile?.phone || data.commercialPhone || '';

    const commercialEmail =
      isAdminRole(currentUser.role) && data.commercialEmail !== undefined
        ? data.commercialEmail
        : userProfile?.email || currentUser.email;

    const commercialSignature =
      isAdminRole(currentUser.role) && data.commercialSignature !== undefined
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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    let action: AuditAction = 'COTIZACION_CREAR';
    if (data.status === 'Borrador') {
      action = 'COTIZACION_BORRADOR';
    } else if (data.status === 'Finalizada') {
      action = 'COTIZACION_FINALIZAR';
    } else if (data.id) {
      action = 'COTIZACION_EDITAR';
    }

    registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action,
      module: 'Cotizaciones',
      description: `${
        action === 'COTIZACION_BORRADOR'
          ? 'Guardado de borrador'
          : action === 'COTIZACION_FINALIZAR'
          ? 'Emisión y finalización oficial'
          : action === 'COTIZACION_EDITAR'
          ? 'Modificación de cotización'
          : 'Creación de cotización'
      }: ${saved.code || saved.id} - ${saved.clientName} (${saved.projectName || 'Sin obra'})`,
      details: {
        id: saved.id,
        code: saved.code,
        cliente: saved.clientName,
        proyecto: saved.projectName,
        totalUf: saved.totalUf,
        status: saved.status,
        itemsCount: saved.items?.length || 0,
      },
      ip,
    }).catch(() => {});

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

  const canDelete = isAdminRole(currentUser.role) || hasPermission(currentUser, 'cotizaciones.eliminar');
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

    const isAdmin = isAdminRole(currentUser.role);
    const result = await deleteCotizacionesBatchAsync(
      ids,
      currentUser.name,
      currentUser.id,
      isAdmin
    );

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: 'COTIZACION_ELIMINAR',
      module: 'Cotizaciones',
      description: `Eliminación de ${ids.length} cotización(es): ${ids.join(', ')}`,
      details: { ids, resultado: result },
      ip,
    }).catch(() => {});

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error batch deleting cotizaciones:', err);
    return NextResponse.json({ error: 'Error interno al eliminar cotizaciones' }, { status: 500 });
  }
}
