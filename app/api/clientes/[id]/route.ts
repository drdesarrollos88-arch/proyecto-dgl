import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getClienteById, updateCliente, deleteCliente } from '@/lib/clientes-db';
import {
  isSalesforceCrmAvailable,
  getSalesforceAccountById,
  updateSalesforceAccount,
} from '@/lib/salesforce/salesforce-crm-service';
import { isAdminRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  // 1. Si el ID tiene formato de ID de Salesforce (e.g. '001...') o Salesforce está disponible
  if (id.startsWith('001') || (await isSalesforceCrmAvailable())) {
    try {
      const sfCliente = await getSalesforceAccountById(id);
      if (sfCliente) {
        return NextResponse.json({ cliente: sfCliente, source: 'salesforce' });
      }
    } catch (sfErr) {
      console.warn(`Error buscando cuenta ${id} en Salesforce, revisando base local:`, sfErr);
    }
  }

  // 2. Si no es de Salesforce o no se encontró, buscar en base local
  const cliente = await getClienteById(id);
  if (!cliente) {
    return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ cliente, source: 'local' });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();

    // 1. Si es una cuenta de Salesforce, actualizar directamente en Salesforce CRM
    if (id.startsWith('001') || body.source === 'salesforce' || (await isSalesforceCrmAvailable())) {
      try {
        const updatedSf = await updateSalesforceAccount(id, body);
        if (updatedSf) {
          // Replicar en base de datos local si existiera
          try {
            await updateCliente(id, body);
          } catch {}
          return NextResponse.json({ success: true, cliente: updatedSf, source: 'salesforce' });
        }
      } catch (sfErr) {
        console.warn(`Error actualizando cuenta ${id} en Salesforce:`, sfErr);
        // Si no es un ID exclusivo de Salesforce, permitir fallback a actualización local
        if (!id.startsWith('001')) {
          const updatedLocal = await updateCliente(id, body);
          if (updatedLocal) {
            return NextResponse.json({ success: true, cliente: updatedLocal, source: 'local' });
          }
        }
        throw sfErr;
      }
    }

    // 2. Si es local, actualizar en DB local
    const updated = await updateCliente(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, cliente: updated, source: 'local' });
  } catch (err: any) {
    console.error('Error updating cliente:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json(
      { error: 'Solo administradores pueden eliminar clientes.' },
      { status: 403 }
    );
  }

  const { id } = await params;
  const ok = await deleteCliente(id);
  return NextResponse.json({ success: ok });
}
