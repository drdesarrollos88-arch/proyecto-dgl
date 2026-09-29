import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hashPassword } from '@/lib/auth';
import {
  getUsersAsync,
  getUserByIdAsync,
  getUserByEmailAsync,
  getUserByRutAsync,
  createUserAsync,
  updateUserAsync,
  deleteUserAsync,
} from '@/lib/users-db';
import { hasPermission, isAdminRole } from '@/lib/permissions';
import { sendWelcomeEmail } from '@/lib/email-service';
import { UserRole } from '@/lib/types';

// GET: Consultar el listado de usuarios del sistema
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser || (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para consultar el listado de usuarios.' },
      { status: 403 }
    );
  }

  const allUsers = await getUsersAsync();
  const safeUsers = allUsers.map((u) => ({
    id: u.id,
    rut: u.rut,
    name: u.name,
    email: u.email,
    role: u.role,
    profileId: u.profileId || (u.role === 'superadmin' ? 'superadmin' : u.role === 'admin' ? 'admin' : 'comercial_junior'),
    customPermissions: u.customPermissions || [],
    commercialTitle: u.commercialTitle || '',
    phone: u.phone || '',
    commercialInitials: u.commercialInitials || '',
    createdAt: u.createdAt,
  }));

  return NextResponse.json({ users: safeUsers });
}

// POST: Registrar un nuevo usuario con credenciales, perfil y notificación por correo
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para crear usuarios.' },
      { status: 403 }
    );
  }

  try {
    const { rut, name, email, password, role, profileId, customPermissions } = await req.json();

    if (!rut || !name || !email || !password) {
      return NextResponse.json(
        { error: 'RUT, Nombre, Correo y Contraseña provisoria son obligatorios.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña provisoria debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    // Regla de Jerarquía: Solo un 'superadmin' (Administrador / Soporte) puede crear o asignar otro 'superadmin'
    if (role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acceso denegado: Solo un usuario con rol Administrador / Soporte puede crear o asignar otro usuario Administrador / Soporte.' },
        { status: 403 }
      );
    }

    // Verificar duplicidad de correo o RUT en base de datos persistente
    const existingByEmail = await getUserByEmailAsync(email);
    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Ya existe un usuario registrado con ese correo electrónico.' },
        { status: 400 }
      );
    }

    const existingByRut = await getUserByRutAsync(rut);
    if (existingByRut) {
      return NextResponse.json(
        { error: 'Ya existe un usuario registrado con ese RUT.' },
        { status: 400 }
      );
    }

    // Determinar rol y perfil correspondiente
    let assignedRole: UserRole = 'comercial';
    if (role === 'superadmin' && currentUser.role === 'superadmin') {
      assignedRole = 'superadmin';
    } else if (role === 'admin') {
      assignedRole = 'admin';
    }

    const assignedProfileId =
      profileId || (assignedRole === 'superadmin' ? 'superadmin' : assignedRole === 'admin' ? 'admin' : 'comercial_junior');

    const passwordHash = await hashPassword(password);
    const newUser = await createUserAsync({
      rut: rut.trim(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: assignedRole,
      profileId: assignedProfileId,
      customPermissions: Array.isArray(customPermissions) ? customPermissions : undefined,
    });

    // 2. Despachar correo electrónico con notificación y credenciales provisorias
    let emailResult = null;
    try {
      const origin = req.headers.get('origin') || 'https://dgl-cotizador.dr-desarrollos88.workers.dev';
      emailResult = await sendWelcomeEmail({
        name: newUser.name,
        email: newUser.email,
        rut: newUser.rut,
        provisionalPassword: password,
        role: newUser.role,
        loginUrl: `${origin}/login`,
      });
    } catch (mailErr) {
      console.error('Error al despachar correo de bienvenida:', mailErr);
    }

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
      emailNotification: emailResult,
    });
  } catch (err) {
    console.error('Error al registrar usuario:', err);
    return NextResponse.json({ error: 'Error interno al registrar el usuario.' }, { status: 500 });
  }
}

// PUT: Actualizar rol, perfil o información de un usuario
export async function PUT(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser || (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'usuarios.administrar'))) {
    return NextResponse.json(
      { error: 'Acceso denegado: se requieren permisos para modificar usuarios.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, profileId, role, name, email, password, commercialTitle, phone, commercialInitials, customPermissions } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido.' }, { status: 400 });
    }

    const targetUser = await getUserByIdAsync(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    // Regla de Jerarquía: Un Administrador estándar NO puede quitar permisos ni modificar a un Administrador / Soporte
    if (targetUser.role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acceso denegado: No tienes autorización para modificar ni alterar permisos a un usuario con rol Administrador / Soporte.' },
        { status: 403 }
      );
    }

    // Regla de Jerarquía: Solo un Administrador / Soporte puede promover a alguien a Administrador / Soporte
    if (role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acceso denegado: Solo un Administrador / Soporte puede asignar o promover usuarios a ese rol.' },
        { status: 403 }
      );
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim().toLowerCase();
    if (role !== undefined) updates.role = role as UserRole;
    if (profileId !== undefined) updates.profileId = profileId;
    if (commercialTitle !== undefined) updates.commercialTitle = commercialTitle;
    if (phone !== undefined) updates.phone = phone;
    if (commercialInitials !== undefined) updates.commercialInitials = commercialInitials;
    if (customPermissions !== undefined) updates.customPermissions = customPermissions;

    if (password && typeof password === 'string' && password.trim().length >= 6) {
      updates.passwordHash = await hashPassword(password.trim());
    }

    const updated = await updateUserAsync(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Error al actualizar usuario.' }, { status: 500 });
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
  if (!currentUser || (!isAdminRole(currentUser.role) && !hasPermission(currentUser, 'usuarios.administrar'))) {
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
        { error: 'No puedes eliminar tu propio usuario en sesión activa.' },
        { status: 400 }
      );
    }

    const targetUser = await getUserByIdAsync(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado.' }, { status: 404 });
    }

    // Regla de Jerarquía: Un Administrador estándar NO puede eliminar a un Administrador / Soporte
    if (targetUser.role === 'superadmin' && currentUser.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acceso denegado: No tienes autorización para eliminar a un usuario con rol Administrador / Soporte.' },
        { status: 403 }
      );
    }

    const success = await deleteUserAsync(id);
    if (!success) {
      return NextResponse.json({ error: 'Error al eliminar usuario.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Error al eliminar usuario:', err);
    return NextResponse.json({ error: 'Error al eliminar usuario.' }, { status: 500 });
  }
}
