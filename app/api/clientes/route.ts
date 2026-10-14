import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchClientes, createCliente } from '@/lib/clientes-db';
import {
  isSalesforceCrmAvailable,
  searchSalesforceAccounts,
  createSalesforceAccount,
} from '@/lib/salesforce/salesforce-crm-service';
import { registrarAuditoria } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 20)) : 20;

  // 1. Prioridad: Consulta en tiempo real a Salesforce CRM si está conectado
  if (await isSalesforceCrmAvailable()) {
    try {
      const sfClientes = await searchSalesforceAccounts(q, limit);
      return NextResponse.json({ clientes: sfClientes, source: 'salesforce' });
    } catch (sfErr) {
      console.warn('Fallo al consultar Salesforce Accounts, usando base local como fallback:', sfErr);
    }
  }

  // 2. Fallback resiliente a base local (Supabase / SQLite)
  try {
    const clientes = await searchClientes(q, limit);
    return NextResponse.json({ clientes, source: 'local' });
  } catch (err) {
    console.error('Error searching clientes:', err);
    return NextResponse.json({ error: 'Error al buscar clientes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, rut } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'El nombre o razón social es obligatorio.' }, { status: 400 });
    }
    if (!rut || !rut.trim()) {
      return NextResponse.json({ error: 'El RUT es obligatorio.' }, { status: 400 });
    }

    let cliente = null;

    // 1. Si Salesforce está conectado, crear la cuenta directamente en Salesforce CRM
    if (await isSalesforceCrmAvailable()) {
      try {
        cliente = await createSalesforceAccount({
          name,
          rut,
          comuna: body.comuna || '',
          address: body.address || '',
          giro: body.giro || '',
          phone: body.phone || '',
          paymentCondition: body.paymentCondition || '50% AL CONTADO Y 50% CONTRA ENTREGA',
          email: body.email || '',
          contactPerson: body.contactPerson || '',
        });
      } catch (sfErr) {
        console.warn('Error creando Account en Salesforce, respaldando en base local:', sfErr);
      }
    }

    // 2. Replicar en base de datos local para redundancia y caché
    try {
      const localCliente = await createCliente({
        name,
        rut,
        comuna: body.comuna || '',
        address: body.address || '',
        giro: body.giro || '',
        phone: body.phone || '',
        paymentCondition: body.paymentCondition || '',
        email: body.email || '',
        contactPerson: body.contactPerson || '',
      });
      if (!cliente) {
        cliente = localCliente;
      }
    } catch (localErr) {
      console.warn('Advertencia al guardar copia local del cliente:', localErr);
    }

    if (!cliente) {
      return NextResponse.json({ error: 'No se pudo crear el cliente en Salesforce ni en la base local.' }, { status: 500 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    registrarAuditoria({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'CLIENTE_CREAR',
      module: 'Clientes',
      description: `Registro de nueva empresa cliente: "${cliente.name}" (RUT: ${cliente.rut}) [${cliente.source || 'salesforce'}]`,
      details: { id: cliente.id, name: cliente.name, rut: cliente.rut, email: cliente.email, source: cliente.source },
      ip,
    }).catch(() => {});

    return NextResponse.json({ success: true, cliente }, { status: 201 });
  } catch (err) {
    console.error('Error creating cliente:', err);
    return NextResponse.json({ error: 'Error al registrar cliente' }, { status: 500 });
  }
}
