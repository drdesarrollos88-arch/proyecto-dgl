import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { parseUsersFromExcel } from '@/lib/users-excel';
import { isAdminRole, hasPermission } from '@/lib/permissions';
import { auditRequest } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos administrativos para importar usuarios.' },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No se ha adjuntado ningún archivo Excel.' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Formato inválido. Por favor suba un archivo de tipo Excel (.xlsx).' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const result = await parseUsersFromExcel(arrayBuffer, currentUser);

    await auditRequest(req, currentUser, {
      action: 'USUARIOS_CARGA_MASIVA',
      module: 'Usuarios',
      description: `Carga masiva de usuarios desde Excel. Creados: ${result.creados}, Actualizados: ${result.actualizados}, Errores: ${result.errores.length}.`,
      details: {
        archivo: file.name,
        tamanoBytes: file.size,
        totalFilas: result.totalFilas,
        creados: result.creados,
        actualizados: result.actualizados,
        errores: result.errores,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Procesamiento completado: ${result.creados} usuario(s) creado(s), ${result.actualizados} actualizado(s)${result.errores.length > 0 ? `, con ${result.errores.length} advertencia(s)` : ''}.`,
      result,
    });
  } catch (error: any) {
    console.error('Error en carga masiva de usuarios:', error);
    return NextResponse.json(
      { error: error?.message || 'Error inesperado al procesar la planilla de usuarios.' },
      { status: 500 }
    );
  }
}

