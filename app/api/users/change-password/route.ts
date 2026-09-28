import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { getUserById, updateUserPassword } from '@/lib/db';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Debe ingresar la contraseña actual y la nueva contraseña.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const user = getUserById(currentUser.id);
    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'La contraseña actual no es correcta.' },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(newPassword);
    const updated = updateUserPassword(currentUser.id, newHash);

    if (!updated) {
      return NextResponse.json({ error: 'Error al actualizar la contraseña.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Contraseña actualizada con éxito.',
    });
  } catch (err) {
    console.error('Error changing password:', err);
    return NextResponse.json({ error: 'Error al cambiar la contraseña.' }, { status: 500 });
  }
}

