import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getProfiles, saveProfile, deleteProfile } from '@/lib/db';
import { hasPermission } from '@/lib/permissions';

// GET: Obtener lista de todos los perfiles de usuario y sus permisos configurados
export async function GET() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const profiles = getProfiles();
  return NextResponse.json({ profiles });
}

// POST: Crear o actualizar un perfil de usuario con permisos personalizados
export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  // Verificar que el usuario tenga permiso de administración de usuarios
  if (currentUser.role !== 'admin' && !hasPermission(currentUser, 'usuarios.administrar')) {
    return NextResponse.json(
      { error: 'No tienes permisos suficientes para administrar perfiles de usuario.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { id, name, description, permissions } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del perfil es obligatorio.' }, { status: 400 });
    }

    if (!Array.isArray(permissions)) {
      return NextResponse.json({ error: 'La lista de permisos no es válida.' }, { status: 400 });
    }

    const saved = saveProfile({
      id: id || undefined,
      name: name.trim(),
      description: (description || '').trim(),
      permissions,
      isSystem: body.isSystem || false,
    });

    return NextResponse.json({ success: true, profile: saved });
  } catch (err) {
    console.error('Error al guardar perfil:', err);
    return NextResponse.json({ error: 'Error interno al procesar el perfil.' }, { status: 500 });
  }
}

// DELETE: Eliminar un perfil de usuario personalizado (si no es del sistema ni está en uso)
export async function DELETE(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (currentUser.role !== 'admin' && !hasPermission(currentUser, 'usuarios.administrar')) {
    return NextResponse.json(
      { error: 'No tienes permisos para eliminar perfiles de usuario.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID de perfil no especificado.' }, { status: 400 });
  }

  const res = deleteProfile(id);
  if (!res.success) {
    return NextResponse.json({ error: res.message || 'No se pudo eliminar el perfil.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

