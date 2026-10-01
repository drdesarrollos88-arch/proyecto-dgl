import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { searchClientes, createCliente } from '@/lib/clientes-db';
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

  try {
    const clientes = await searchClientes(q, limit);
    return NextResponse.json({ clientes });
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

    const cliente = await createCliente({
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

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    registrarAuditoria({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      action: 'CLIENTE_CREAR',
      module: 'Clientes',
      description: `Registro de nueva empresa cliente: "${cliente.name}" (RUT: ${cliente.rut})`,
      details: { id: cliente.id, name: cliente.name, rut: cliente.rut, email: cliente.email },
      ip,
    }).catch(() => {});

    return NextResponse.json({ success: true, cliente }, { status: 201 });
  } catch (err) {
    console.error('Error creating cliente:', err);
    return NextResponse.json({ error: 'Error al registrar cliente' }, { status: 500 });
  }
}


