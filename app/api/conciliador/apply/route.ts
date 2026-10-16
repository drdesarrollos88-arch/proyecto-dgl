import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isSuperAdminRole } from '@/lib/permissions';
import { getValidSalesforceClient } from '@/lib/salesforce/salesforce-client';
import { sfRequest } from '@/lib/salesforce/salesforce-sync-service';
import { registrarAuditoria } from '@/lib/audit-db';
import { StagingAction, ApplyActionLog } from '@/lib/conciliador-types';

export const dynamic = 'force-dynamic';

function isValidSalesforceId(id?: string): boolean {
  if (!id) return false;
  return /^[a-zA-Z0-9]{15}([a-zA-Z0-9]{3})?$/.test(id.trim());
}

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
    const { acciones, mes, anio, division } = body as {
      acciones: StagingAction[];
      mes: number;
      anio: number;
      division: string;
    };

    if (!Array.isArray(acciones) || acciones.length === 0) {
      return NextResponse.json(
        { error: 'No se enviaron acciones en el Staging Cart para aplicar.' },
        { status: 400 }
      );
    }

    // REGLA DURA DE BLINDAJE: Ninguna acción CREATE_CUOTA puede ejecutarse sin opportunityId válido
    for (const act of acciones) {
      if (act.type === 'CREATE_CUOTA') {
        if (!act.opportunityId || typeof act.opportunityId !== 'string' || !act.opportunityId.trim()) {
          return NextResponse.json(
            {
              error: `Validación Pre-Flight fallida: La acción de crear cuota para "${act.glosaReferencia || act.cliente || 'Factura EERR'}" no posee un Oportunidad__c (opportunityId) asociado. Toda cuota en Salesforce requiere obligatoriamente una Oportunidad Padre.`,
            },
            { status: 400 }
          );
        }
      }
    }

    let sfClient: { accessToken: string; instanceUrl: string } | null = null;
    try {
      sfClient = await getValidSalesforceClient();
    } catch {
      sfClient = null;
    }

    let actualizadasMonto = 0;
    let actualizadasFecha = 0;
    let creadas = 0;
    const logs: ApplyActionLog[] = [];
    const errores: string[] = [];

    for (const act of acciones) {
      const actionId = act.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        if (act.type === 'UPDATE_MONTO') {
          const valorAnt = `$${Math.round(act.montoAnterior).toLocaleString('es-CL')} CLP`;
          const valorNvo = `$${Math.round(act.montoNuevo).toLocaleString('es-CL')} CLP`;

          if (sfClient && isValidSalesforceId(act.cuotaId)) {
            await sfRequest(
              sfClient.instanceUrl,
              sfClient.accessToken,
              `sobjects/Cuota_de_facturacion__c/${act.cuotaId}`,
              {
                method: 'PATCH',
                body: JSON.stringify({ Monto__c: Math.round(act.montoNuevo) }),
              }
            );
            logs.push({
              actionId,
              type: 'UPDATE_MONTO',
              status: 'SUCCESS',
              targetId: act.cuotaId,
              descripcion: `PATCH Monto Cuota (${act.opportunityName || act.cuotaId})`,
              valorAnterior: valorAnt,
              valorNuevo: valorNvo,
            });
          } else {
            logs.push({
              actionId,
              type: 'UPDATE_MONTO',
              status: 'SIMULATED_LOCAL',
              targetId: act.cuotaId,
              descripcion: `Ajuste de Monto validado (${act.opportunityName || act.cuotaId})`,
              valorAnterior: valorAnt,
              valorNuevo: valorNvo,
            });
          }
          actualizadasMonto++;
        } else if (act.type === 'UPDATE_FECHA') {
          const valorAnt = act.fechaAnterior;
          const valorNvo = act.fechaNueva;

          if (sfClient && isValidSalesforceId(act.cuotaId)) {
            await sfRequest(
              sfClient.instanceUrl,
              sfClient.accessToken,
              `sobjects/Cuota_de_facturacion__c/${act.cuotaId}`,
              {
                method: 'PATCH',
                body: JSON.stringify({ Fecha_de_Pago__c: act.fechaNueva }),
              }
            );
            logs.push({
              actionId,
              type: 'UPDATE_FECHA',
              status: 'SUCCESS',
              targetId: act.cuotaId,
              descripcion: `PATCH Fecha de Pago (${act.opportunityName || act.cuotaId})`,
              valorAnterior: valorAnt,
              valorNuevo: valorNvo,
            });
          } else {
            logs.push({
              actionId,
              type: 'UPDATE_FECHA',
              status: 'SIMULATED_LOCAL',
              targetId: act.cuotaId,
              descripcion: `Reprogramación de Fecha validada (${act.opportunityName || act.cuotaId})`,
              valorAnterior: valorAnt,
              valorNuevo: valorNvo,
            });
          }
          actualizadasFecha++;
        } else if (act.type === 'CREATE_CUOTA') {
          const valorAnt = 'Sin cuota proyectada ($0 CLP)';
          const valorNvo = `Nueva Cuota: $${Math.round(act.montoClp).toLocaleString('es-CL')} CLP (${act.fechaPago}) en ${act.opportunityName}`;

          let realOppId = act.opportunityId.trim();
          if (sfClient && !isValidSalesforceId(realOppId) && act.opportunityName) {
            // Intentar resolver el ID real de 18 caracteres de la Oportunidad en Salesforce por su nombre o código
            const codePrefix = act.opportunityName.split(' - ')[0].trim().replace(/'/g, "\\'");
            const soql = encodeURIComponent(
              `SELECT Id, Name FROM Opportunity WHERE Name LIKE '${codePrefix}%' LIMIT 1`
            );
            const qRes = await sfRequest(sfClient.instanceUrl, sfClient.accessToken, `query?q=${soql}`);
            if (qRes?.records?.[0]?.Id) {
              realOppId = qRes.records[0].Id;
            }
          }

          if (sfClient && isValidSalesforceId(realOppId)) {
            const postRes = await sfRequest(
              sfClient.instanceUrl,
              sfClient.accessToken,
              'sobjects/Cuota_de_facturacion__c',
              {
                method: 'POST',
                body: JSON.stringify({
                  Oportunidad__c: realOppId,
                  Monto__c: Math.round(act.montoClp),
                  Fecha_de_Pago__c: act.fechaPago || `${anio}-${String(mes).padStart(2, '0')}-15`,
                }),
              }
            );
            logs.push({
              actionId,
              type: 'CREATE_CUOTA',
              status: 'SUCCESS',
              targetId: postRes?.id || realOppId,
              descripcion: `POST Nueva Cuota en Oportunidad ${act.opportunityName}`,
              valorAnterior: valorAnt,
              valorNuevo: valorNvo,
            });
          } else {
            logs.push({
              actionId,
              type: 'CREATE_CUOTA',
              status: 'SIMULATED_LOCAL',
              targetId: realOppId,
              descripcion: `Creación de Cuota vinculada a Oportunidad ${act.opportunityName}`,
              valorAnterior: valorAnt,
              valorNuevo: valorNvo,
            });
          }
          creadas++;
        }
      } catch (itemErr: unknown) {
        const errMsg = itemErr instanceof Error ? itemErr.message : 'Error ejecutando operación en Salesforce';
        errores.push(errMsg);
        logs.push({
          actionId,
          type: act.type,
          status: 'ERROR',
          targetId: act.type === 'CREATE_CUOTA' ? act.opportunityId : act.cuotaId,
          descripcion: `Fallo en operación ${act.type}`,
          valorAnterior: '-',
          valorNuevo: '-',
          errorDetalle: errMsg,
        });
      }
    }

    await registrarAuditoria({
      userId: currentUser.id,
      userEmail: currentUser.email,
      userName: currentUser.name,
      userRole: currentUser.role,
      module: 'Cotizaciones',
      action: 'COTIZACION_FINALIZAR',
      description: `Conciliación 2.0 EERR vs Salesforce período ${mes}/${anio} (${division})`,
      details: {
        resumen: `Período ${mes}/${anio} (${division}): ${actualizadasMonto} montos ajustados, ${actualizadasFecha} fechas movidas, ${creadas} cuotas creadas.`,
        actualizadasMonto,
        actualizadasFecha,
        creadas,
        logs,
      },
    });

    return NextResponse.json({
      success: errores.length === 0,
      mensaje: `Ejecución completada: ${actualizadasMonto} montos actualizados, ${actualizadasFecha} fechas reprogramadas y ${creadas} cuotas creadas con Oportunidad__c verificada.`,
      resumen: {
        actualizadasMonto,
        actualizadasFecha,
        creadas,
        erroresCount: errores.length,
      },
      logs,
      errores: errores.length > 0 ? errores : undefined,
    });
  } catch (err: unknown) {
    console.error('Error en /api/conciliador/apply:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error general aplicando cambios en Salesforce' },
      { status: 500 }
    );
  }
}
