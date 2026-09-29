import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { importClientesFromExcel } from '@/lib/clientes-db';
import { isAdminRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden cargar bases de datos de clientes.' },
      { status: 403 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const count = await importClientesFromExcel(arrayBuffer);

    return NextResponse.json({
      success: true,
      count,
      message: `Base de datos de clientes actualizada exitosamente (${count.toLocaleString('es-CL')} empresas procesadas).`,
    });
  } catch (err) {
    console.error('Error uploading clientes Excel:', err);
    return NextResponse.json(
      { error: 'Error al procesar el archivo Excel de clientes. Verifique el formato.' },
      { status: 500 }
    );
  }
}

