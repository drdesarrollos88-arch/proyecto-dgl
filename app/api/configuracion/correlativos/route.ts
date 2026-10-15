import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCorrelativoConfigAsync, saveCorrelativoConfigAsync } from '@/lib/configuracion-db';
import { hasPermission, isAdminRole } from '@/lib/permissions';
import { auditRequest } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const config = await getCorrelativoConfigAsync();
    return NextResponse.json({ success: true, config });
  } catch (err) {
    console.error('Error fetching correlativo config:', err);
    return NextResponse.json({ error: 'Error al obtener configuración de correlativos' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const isAdmin = isAdminRole(user.role) || hasPermission(user, 'usuarios.administrar');
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'No tienes permisos administrativos para modificar la secuencia de correlativos.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Cuerpo de solicitud no válido' }, { status: 400 });
    }

    const before = await getCorrelativoConfigAsync();
    const beforeSequences = JSON.parse(JSON.stringify(before.sequences || {}));
    const updated = await saveCorrelativoConfigAsync(body);
    await auditRequest(req, user, {
      action: 'CONFIG_CORRELATIVOS',
      module: 'Configuración',
      description: 'Modificación de la secuencia de correlativos oficiales de cotización.',
      details: { antes: beforeSequences, despues: updated.sequences, numeroInicialPorDefecto: updated.defaultInitialNumber },
    });
    return NextResponse.json({ success: true, config: updated });
  } catch (err) {
    console.error('Error saving correlativo config:', err);
    return NextResponse.json({ error: 'Error al actualizar configuración de correlativos' }, { status: 500 });
  }
}

