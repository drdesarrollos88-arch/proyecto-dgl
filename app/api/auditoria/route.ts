import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdminRole } from '@/lib/permissions';
import { getAuditLogs, getAuditStats, registrarAuditoria } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // Solo administradores y soporte técnico tienen acceso a la auditoría del sistema
  if (!isAdminRole(currentUser.role)) {
    return NextResponse.json(
      { error: 'Acceso denegado: Se requieren privilegios de Administrador o Soporte.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const moduleParam = searchParams.get('module') || undefined;
  const actionParam = searchParams.get('action') || undefined;
  const search = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const includeStats = searchParams.get('stats') === 'true';

  try {
    const logs = await getAuditLogs({
      module: moduleParam,
      action: actionParam,
      search,
      limit,
    });

    let stats = null;
    if (includeStats) {
      stats = await getAuditStats();
    }

    return NextResponse.json({
      success: true,
      logs,
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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

    const log = await registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action,
      module: mod,
      description,
      details,
      ip,
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

