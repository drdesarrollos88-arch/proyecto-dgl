import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFormatoSettings, saveFormatoSettings } from '@/lib/db';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const settings = getFormatoSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Authorization check: Admin only
  if (currentUser.role !== 'admin') {
    return NextResponse.json(
      { error: 'Acceso denegado: solo administradores pueden modificar el formato oficial.' },
      { status: 403 }
    );
  }

  try {
    const data = await req.json();

    // Validate header image size if provided
    if (data.headerImage) {
      if (typeof data.headerImage !== 'string' || !data.headerImage.startsWith('data:image/')) {
        return NextResponse.json(
          { error: 'Formato de imagen inválido. Debe ser una imagen válida (data URI).' },
          { status: 400 }
        );
      }
      if (data.headerImage.length > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'La imagen de encabezado excede el límite permitido (máximo 5MB).' },
          { status: 400 }
        );
      }
    }

    const updated = saveFormatoSettings(data, currentUser.name);
    return NextResponse.json({ success: true, settings: updated });
  } catch (err) {
    console.error('Error saving formato settings:', err);
    return NextResponse.json({ error: 'Error al guardar la configuración de formato' }, { status: 500 });
  }
}
