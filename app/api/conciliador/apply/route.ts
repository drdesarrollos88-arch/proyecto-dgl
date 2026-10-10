import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdminRole } from '@/lib/permissions';
import { getValidSalesforceClient } from '@/lib/salesforce/salesforce-client';
import { sfRequest } from '@/lib/salesforce/salesforce-sync-service';
import { registrarAuditoria } from '@/lib/audit-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const isAuthorized =
    isSuperAdminRole(currentUser.role) || currentUser.profileId === 'superadmin';
  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Acceso denegado: Restringido a Administrador / Soporte.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const { acciones, mes, anio, division } = body;

    if (!Array.isArray(acciones) || acciones.length === 0) {
      return NextResponse.json(
        { error: 'No se enviaron acciones de conciliación para aplicar.' },
        { status: 400 }
      );
    }

    const { accessToken, instanceUrl } = await getValidSalesforceClient();

    let actualizadas = 0;
    let creadas = 0;
    let movidas = 0;
    let eliminadas = 0;
    const errores: string[] = [];

    for (const item of acciones) {
      try {
        const { accion, cuotaId, opportunityId, nuevoMontoClp, nuevaFecha, justificacion } = item;

        if (accion === 'ajustar_cuota' && cuotaId && !cuotaId.startsWith('sf-')) {
          await sfRequest(instanceUrl, accessToken, `sobjects/Cuota_de_facturacion__c/${cuotaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ Monto__c: Math.round(nuevoMontoClp) }),
          });
          actualizadas++;
        } else if (accion === 'mover_cuota' && cuotaId && !cuotaId.startsWith('sf-') && nuevaFecha) {
          await sfRequest(instanceUrl, accessToken, `sobjects/Cuota_de_facturacion__c/${cuotaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ Fecha_de_Pago__c: nuevaFecha }),
          });
          movidas++;
        } else if (accion === 'postergar_mes' && cuotaId && !cuotaId.startsWith('sf-') && nuevaFecha) {
          await sfRequest(instanceUrl, accessToken, `sobjects/Cuota_de_facturacion__c/${cuotaId}`, {
            method: 'PATCH',
            body: JSON.stringify({ Fecha_de_Pago__c: nuevaFecha }),
          });
          movidas++;
        } else if (accion === 'crear_cuota' && opportunityId && nuevoMontoClp) {
          await sfRequest(instanceUrl, accessToken, 'sobjects/Cuota_de_facturacion__c', {
            method: 'POST',
            body: JSON.stringify({
              Oportunidad__c: opportunityId,
              Monto__c: Math.round(nuevoMontoClp),
              Fecha_de_Pago__c: nuevaFecha || `${anio}-${String(mes).padStart(2, '0')}-15`,
            }),
          });
          creadas++;
        } else if (accion === 'eliminar_cuota' && cuotaId && !cuotaId.startsWith('sf-')) {
          await sfRequest(instanceUrl, accessToken, `sobjects/Cuota_de_facturacion__c/${cuotaId}`, {
            method: 'DELETE',
          });
          eliminadas++;
        }
      } catch (err: any) {
        console.error('Error aplicando acción individual de conciliación:', err);
        errores.push(err?.message || 'Error desconocido');
      }
    }

    // Registrar en auditoría
    await registrarAuditoria({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      module: 'Cotizaciones',
      action: 'COTIZACION_FINALIZAR',
      description: `Conciliación EERR vs Salesforce período ${mes}/${anio} (${division})`,
      details: {
        resumen: `Período ${mes}/${anio} (${division}): ${actualizadas} cuotas ajustadas, ${movidas} movidas/postergadas, ${creadas} creadas, ${eliminadas} eliminadas.`,
        actualizadas,
        movidas,
        creadas,
        eliminadas,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: `Conciliación aplicada con éxito: ${actualizadas} cuotas ajustadas, ${movidas} movidas, ${creadas} creadas y ${eliminadas} eliminadas en Salesforce.`,
      resumen: { actualizadas, creadas, movidas, eliminadas },
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (err: any) {
    console.error('Error en /api/conciliador/apply:', err);
    return NextResponse.json(
      { error: err?.message || 'Error general aplicando cambios en Salesforce' },
      { status: 500 }
    );
  }
}
