import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import { getUsers, createUser, deleteUser, getUserByEmail, getUserByRut, updateUserProfile } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

// GET: Consultar el listado de usuarios del sistema
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== 'admin' && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para consultar el listado de usuarios.' },
      { status: 403 }
    );
  }

  const allUsers = getUsers().map((u) => ({
    id: u.id,
    rut: u.rut,
    name: u.name,
    email: u.email,
    role: u.role,
    profileId: u.profileId || (u.role === 'admin' ? 'admin' : 'comercial_junior'),
    customPermissions: u.customPermissions || [],
    commercialTitle: u.commercialTitle || '',
    phone: u.phone || '',
    commercialInitials: u.commercialInitials || '',
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ users: allUsers });
}

// POST: Registrar un nuevo usuario con credenciales y perfil asignado
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== 'admin' && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para crear usuarios.' },
      { status: 403 }
    );
  }

  try {
    const { rut, name, email, password, role, profileId, customPermissions } = await req.json();

    if (!rut || !name || !email || !password) {
      return NextResponse.json(
        { error: 'RUT, Nombre, Correo y Clave son obligatorios.' },
        { status: 400 }
      );
    }

    // Verificar duplicidad de correo o RUT
    if (getUserByEmail(email)) {
      return NextResponse.json(
        { error: 'Ya existe un usuario registrado con ese correo electrónico.' },
        { status: 400 }
      );
    }

    if (getUserByRut(rut)) {
      return NextResponse.json(
        { error: 'Ya existe un usuario registrado con ese RUT.' },
        { status: 400 }
      );
    }

    const assignedRole = role === 'admin' ? 'admin' : 'comercial';
    const assignedProfileId = profileId || (assignedRole === 'admin' ? 'admin' : 'comercial_junior');

    const passwordHash = await hashPassword(password);
    const newUser = createUser({
      rut: rut.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: assignedRole,
      profileId: assignedProfileId,
      customPermissions: Array.isArray(customPermissions) ? customPermissions : undefined,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        rut: newUser.rut,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        profileId: newUser.profileId,
        customPermissions: newUser.customPermissions || [],
        createdAt: newUser.createdAt,
      },
    });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    return NextResponse.json({ error: 'Error al registrar el usuario.' }, { status: 500 });
  }
}

// PUT: Actualizar rol, perfil o información de un usuario
export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== 'admin' && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para modificar usuarios.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, profileId, role, name, email, commercialTitle, phone, commercialInitials, customPermissions } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const updated = updateUserProfile(id, {
      ...(profileId ? { profileId } : {}),
      ...(role ? { role } : {}),
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(commercialTitle !== undefined ? { commercialTitle } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(commercialInitials !== undefined ? { commercialInitials } : {}),
      ...(customPermissions !== undefined ? { customPermissions } : {}),
    });

    if (!updated) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    const { passwordHash: _, ...safeUser } = updated;
    return NextResponse.json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Error al actualizar usuario:', err);
    return NextResponse.json({ error: 'Error al actualizar usuario.' }, { status: 500 });
  }
}

// DELETE: Revocar acceso y eliminar usuario
export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (currentUser.role !== 'admin' && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para eliminar usuarios.' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propio usuario administrador en sesión.' },
        { status: 400 }
      );
    }

    const success = deleteUser(id);
    if (!success) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    return NextResponse.json({ error: 'Error al eliminar usuario.' }, { status: 500 });
  }
}
