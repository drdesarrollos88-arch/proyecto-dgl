import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchContactos, upsertContacto, deleteContacto } from '@/lib/contactos-db';
import {
  isSalesforceCrmAvailable,
  searchSalesforceContacts,
  createSalesforceContact,
} from '@/lib/salesforce/salesforce-crm-service';
import { hasPermission, isAdminRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const accountId = searchParams.get('accountId') || undefined;
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 10)) : 10;

  // 1. Prioridad: Consulta en tiempo real a Contactos de Salesforce CRM si está disponible
  if (await isSalesforceCrmAvailable()) {
    try {
      const contactos = await searchSalesforceContacts(q, accountId, limit);
      return NextResponse.json({ contactos, source: 'salesforce' });
    } catch (sfErr) {
      console.warn('Error buscando contactos en Salesforce, usando base local como fallback:', sfErr);
    }
  }

  // 2. Fallback resiliente a base local
  try {
    const contactos = await searchContactos(q, limit);
    return NextResponse.json({ contactos, source: 'local' });
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
    const { email, name, phone, company, accountId, cargo } = body;

    if (!email || !email.trim() || !email.includes('@')) {
      return NextResponse.json({ error: 'El correo electrónico es obligatorio y debe ser válido.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del contacto es obligatorio.' }, { status: 400 });
    }

    let createdContacto = null;

    // 1. Si Salesforce está activo, registrar el contacto en Salesforce CRM
    if (await isSalesforceCrmAvailable()) {
      try {
        createdContacto = await createSalesforceContact({
          email,
          name,
          phone,
          company,
          accountId,
          cargo,
        });
      } catch (sfErr) {
        console.warn('No se pudo crear contacto en Salesforce CRM, respaldando en base local:', sfErr);
      }
    }

    // 2. Sincronizar en la base de datos local
    const localContacto = await upsertContacto({
      email,
      name,
      phone: phone || '',
      company: company || '',
    });

    const finalContacto = createdContacto || localContacto;
    if (!finalContacto) {
      return NextResponse.json({ error: 'No se pudo guardar el contacto.' }, { status: 400 });
    }

    return NextResponse.json({ success: true, contacto: finalContacto }, { status: 201 });
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

  const canManage = isAdminRole(user.role) || hasPermission(user, 'clientes.gestionar');
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
