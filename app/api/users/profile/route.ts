import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserByIdAsync, updateUserAsync } from '@/lib/users-db';
import { auditRequest } from '@/lib/audit-db';

export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const user = await getUserByIdAsync(currentUser.id);
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ success: true, user: safeUser });
}

export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const data = await req.json();

    const allowedFields = {
      name: data.name?.trim() || currentUser.name,
      rut: data.rut?.trim() || currentUser.rut,
      email: data.email?.trim().toLowerCase() || currentUser.email,
      commercialTitle: data.commercialTitle !== undefined ? data.commercialTitle.trim() : undefined,
      phone: data.phone !== undefined ? data.phone.trim() : undefined,
      commercialInitials: data.commercialInitials !== undefined ? data.commercialInitials.trim() : undefined,
      signature: data.signature !== undefined ? data.signature : undefined,
    };

    const updated = await updateUserAsync(currentUser.id, allowedFields);
    if (!updated) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    await auditRequest(req, currentUser, {
      action: 'USUARIO_PERFIL_PROPIO',
      module: 'Usuarios',
      description: 'El usuario ' + currentUser.name + ' actualizó sus datos de perfil.',
      details: {
        targetId: currentUser.id,
        camposModificados: ['name', 'rut', 'email', 'commercialTitle', 'phone', 'commercialInitials', 'signature'].filter(
          (k) => data[k] !== undefined
        ),
      },
    });

    const { passwordHash: _, ...safeUser } = updated;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Error updating user profile:', err);
    return NextResponse.json({ error: 'Error al actualizar el perfil' }, { status: 500 });
  }
}

