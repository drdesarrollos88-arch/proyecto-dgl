import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchContactos, upsertContacto, deleteContacto } from '@/lib/contactos-db';
import { hasPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10)) : 10;

  try {
    const contactos = await searchContactos(q, limit);
    return NextResponse.json({ contactos });
  } catch (err) {
    console.error('Error searching contactos:', err);
    return NextResponse.json({ error: 'Error al buscar contactos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { email, name, phone, company } = body;

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'El correo electrónico es obligatorio y debe ser válido.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del contacto es obligatorio.' }, { status: 400 });
    }

    const contacto = await upsertContacto({
      email,
      name,
      phone: phone || '',
      company: company || '',
    });

    if (!contacto) {
      return NextResponse.json({ error: 'No se pudo guardar el contacto.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, contacto });
  } catch (err) {
    console.error('Error saving contacto:', err);
    return NextResponse.json({ error: 'Error al guardar contacto' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const canManage = user.role === 'admin' || hasPermission(user, 'clientes.gestionar');
  if (!canManage) {
    return NextResponse.json(
      { error: 'Acceso denegado: No tienes permisos para eliminar contactos comerciales.' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const emailParam = searchParams.get('email');
  let email = emailParam;

  if (!email) {
    try {
      const body = await req.json();
      email = body.email;
    } catch {}
  }

  if (!email || !email.trim()) {
    return NextResponse.json({ error: 'El correo electrónico es obligatorio para eliminar el contacto.' }, { status: 400 });
  }

  const success = await deleteContacto(email);
  if (!success) {
    return NextResponse.json({ error: 'Contacto no encontrado o no pudo eliminarse.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

