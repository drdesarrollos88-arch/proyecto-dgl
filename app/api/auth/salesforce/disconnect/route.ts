import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isAdminRole } from '@/lib/permissions';
import { disconnectSalesforce } from '@/lib/salesforce/salesforce-client';
import { registrarAuditoria } from '@/lib/audit-db';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!isAdminRole(user.role)) {
    return NextResponse.json(
      { error: 'Acceso denegado: solo administradores pueden desconectar la integración con Salesforce.' },
      { status: 403 }
    );
  }

  try {
    await disconnectSalesforce();
    await registrarAuditoria({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'SALESFORCE_DISCONNECTED',
      module: 'Configuración',
      description: `Integración con Salesforce desconectada por el administrador ${user.name}.`,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: 'Sesión de Salesforce desconectada con éxito.' });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Error desconectando' }, { status: 500 });
  }
}

