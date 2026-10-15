import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdminRole, hasPermission } from '@/lib/permissions';
import { getAuditLogsPaged, getAuditStats, getClientIp, registrarAuditoria } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

// Acciones que el navegador puede registrar por sí mismo (el resto solo las registra el servidor).
const CLIENT_ALLOWED_ACTIONS = new Set(['ASISTENTE_CHAT_ARCHIVADO']);
const CLIENT_ALLOWED_MODULES = new Set(['Asistente IA']);

/** Convierte 'YYYY-MM-DD' a ISO. `endOfDay` fija 23:59:59.999 para incluir todo el día final. */
function parseDateParam(value: string | null, endOfDay: boolean): string | undefined {
  if (!value) return undefined;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = new Date(isDateOnly ? `${value}T${endOfDay ? '23:59:59.999Z' : '00:00:00.000Z'}` : value);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo administradores, soporte técnico o usuarios con permiso explícito de auditoría tienen acceso
  if (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'auditoria.ver')) {
    return NextResponse.json(
      { error: 'Acceso denegado: Se requieren privilegios de Administrador o permiso de auditoría.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 1000);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
  const includeStats = searchParams.get('stats') === 'true';

  try {
    const { logs, total, source } = await getAuditLogsPaged({
      module: searchParams.get('module') || undefined,
      action: searchParams.get('action') || undefined,
      userId: searchParams.get('userId') || undefined,
      search: searchParams.get('search') || undefined,
      startDate: parseDateParam(searchParams.get('from'), false),
      endDate: parseDateParam(searchParams.get('to'), true),
      limit,
      offset,
    });

    const stats = includeStats ? await getAuditStats() : null;

    return NextResponse.json({
      success: true,
      logs,
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
      source,
      stats,
    });
  } catch (err: any) {
    console.error('Error al recuperar registros de auditoría:', err);
    return NextResponse.json(
      { error: 'Error interno al consultar la bitácora de auditoría' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, module: mod, description, details } = body;

    if (!action || !mod || !description) {
      return NextResponse.json(
        { error: 'Los campos action, module y description son obligatorios.' },
        { status: 400 }
      );
    }

    // Evita la falsificación de la bitácora desde el navegador
    if (!CLIENT_ALLOWED_ACTIONS.has(String(action)) || !CLIENT_ALLOWED_MODULES.has(String(mod))) {
      return NextResponse.json(
        { error: 'Esta acción solo puede ser registrada por el servidor.' },
        { status: 403 }
      );
    }

    const log = await registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: String(action).slice(0, 60),
      module: mod,
      description: String(description).slice(0, 500),
      details,
      ip: getClientIp(req),
    });

    return NextResponse.json({ success: true, log });
  } catch (err: any) {
    console.error('Error al registrar auditoría:', err);
    return NextResponse.json(
      { error: 'Error al registrar evento de auditoría' },
      { status: 500 }
    );
  }
}
