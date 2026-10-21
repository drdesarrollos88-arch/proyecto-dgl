import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateUsersTemplateExcel } from '@/lib/users-excel';
import { isAdminRole, hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos administrativos para descargar el formato de usuarios.' },
      { status: 403 }
    );
  }

  try {
    const buffer = await generateUsersTemplateExcel();

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Plantilla_Carga_Masiva_Usuarios_DGL.xlsx"',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error generando plantilla de usuarios Excel:', error);
    return NextResponse.json(
      { error: 'Error al generar la plantilla de carga masiva de usuarios.' },
      { status: 500 }
    );
  }
}

