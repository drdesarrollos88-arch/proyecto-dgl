import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getUserByIdAsync, updateUserAsync } from '@/lib/users-db';

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

    const { passwordHash: _, ...safeUser } = updated;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Error updating user profile:', err);
    return NextResponse.json({ error: 'Error al actualizar el perfil' }, { status: 500 });
  }
}

