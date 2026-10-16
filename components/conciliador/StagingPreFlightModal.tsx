'use client';

import React from 'react';
import {
  X,
  ShoppingCart,
  Download,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  ApplyActionLog,
  ConciliacionGroup,
  StagingAction,
} from '@/lib/conciliador-types';
import { formatClp } from './ConciliadorHeaderBalance';

interface StagingPreFlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  stagedActions: StagingAction[];
  groups: ConciliacionGroup[];
  currentForecastSfClp: number;
  currentEerrClp: number;
  mes: number;
  anio: number;
  division: string;
  applying: boolean;
  executionLogs: ApplyActionLog[];
  onRemoveAction: (actionId: string) => void;
  onClearAll: () => void;
  onExecuteStaging: () => void;
}

export default function StagingPreFlightModal({
  isOpen,
  onClose,
  stagedActions,
  groups,
  currentForecastSfClp,
  currentEerrClp,
  mes,
  anio,
  division,
  applying,
  executionLogs,
  onRemoveAction,
  onClearAll,
  onExecuteStaging,
}: StagingPreFlightModalProps) {
  if (!isOpen) return null;

  // Calcular el impacto neto en el Forecast del mes actual
  let deltaForecastClp = 0;
  for (const act of stagedActions) {
    if (act.type === 'UPDATE_MONTO') {
      deltaForecastClp += act.montoNuevo - act.montoAnterior;
    } else if (act.type === 'CREATE_CUOTA') {
      deltaForecastClp += act.montoClp;
    } else if (act.type === 'UPDATE_FECHA') {
      const targetMes = Number(act.fechaNueva.split('-')[1] || 0);
      const origMes = Number(act.fechaAnterior.split('-')[1] || 0);
      const monto = act.montoClp || 0;
      if (targetMes === mes && origMes !== mes) {
        deltaForecastClp += monto;
      } else if (origMes === mes && targetMes !== mes) {
        deltaForecastClp -= monto;
      }
    }
  }

  const projectedForecastSfClp = currentForecastSfClp + deltaForecastClp;
  const projectedBrechaClp = currentEerrClp - projectedForecastSfClp;

  // Validar regla dura: ningún CREATE_CUOTA sin opportunityId
  const invalidActions = stagedActions.filter(
    (a) => a.type === 'CREATE_CUOTA' && (!a.opportunityId || !a.opportunityId.trim())
  );

  // Exportar Pre-Conciliación y Carrito a CSV (compatible con Excel en español con BOM UTF-8)
  const handleExportCsv = () => {
    const headers = [
      'Seccion_Reporte',
      'ID_Grupo_o_Accion',
      'Stage_o_Operacion',
      'Cardinalidad',
      'RUT',
      'Cliente',
      'Codigo_Proyecto',
      'Total_EERR_CLP',
      'Total_SF_CLP',
      'Delta_CLP',
      'Score_Motor',
      'Valor_Anterior_SF',
      'Valor_Nuevo_SF',
      'Detalle_Auditoria',
    ];

    const rows: string[][] = [];

    // 1. Primero las acciones encoladas en el StagingCart
    for (const act of stagedActions) {
      if (act.type === 'UPDATE_MONTO') {
        rows.push([
          'STAGING_ACTION',
          act.id,
          'PATCH Cuota__c (UPDATE_MONTO)',
          '1:1',
          act.rut || '',
          act.cliente || '',
          act.opportunityName || '',
          String(act.montoNuevo),
          String(act.montoAnterior),
          String(act.montoNuevo - act.montoAnterior),
          '100',
          String(act.montoAnterior),
          String(act.montoNuevo),
          `Cuota ${act.cuotaId}: ${act.motivo}`,
        ]);
      } else if (act.type === 'UPDATE_FECHA') {
        rows.push([
          'STAGING_ACTION',
          act.id,
          'PATCH Cuota__c (UPDATE_FECHA)',
          '1:1',
          act.rut || '',
          act.cliente || '',
          act.opportunityName || '',
          '0',
          String(act.montoClp || 0),
          '0',
          '100',
          act.fechaAnterior,
          act.fechaNueva,
          `Cuota ${act.cuotaId}: ${act.motivo}`,
        ]);
      } else if (act.type === 'CREATE_CUOTA') {
        rows.push([
          'STAGING_ACTION',
          act.id,
          'POST Cuota__c (CREATE_CUOTA)',
          `${act.eerrIds.length}:1`,
          act.rut || '',
          act.cliente || '',
          act.opportunityName,
          String(act.montoClp),
          '0',
          String(act.montoClp),
          '100',
          'SIN_CUOTA_PREVIA',
          `${act.montoClp} (${act.fechaPago})`,
          `OppId=${act.opportunityId} | ${act.glosaReferencia}`,
        ]);
      }
    }

    // 2. Todos los grupos de la conciliación del período
    for (const g of groups) {
      rows.push([
        'GRUPO_CONCILIACION',
        g.id,
        g.stage,
        g.cardinalidad,
        g.rut,
        g.cliente,
        g.codigoProyecto || '',
        String(g.totalEerrClp),
        String(g.totalSfClp),
        String(g.deltaClp),
        String(g.scoreBreakdown.totalScore),
        String(g.totalSfClp),
        String(g.totalEerrClp),
        g.scoreBreakdown.explicacion,
      ]);
    }

    const escapeCsv = (val: string) =>
      `"${String(val ?? '').replace(/"/g, '""')}"`;

    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PreConciliacion_${division}_${anio}_${String(mes).padStart(
      2,
      '0'
    )}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header del Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Pre-Flight Check — Carrito de Escritura en Salesforce
              </h2>
              <p className="text-xs text-slate-500">
                Revisa y audita el impacto en el Forecast de {division} ({mes}/{anio}) antes de ejecutar los cambios
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
          {/* Resumen de Impacto en el Forecast */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Forecast SF Actual
              </span>
              <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                {formatClp(currentForecastSfClp)}
              </div>
              <div className="text-[11px] text-slate-500">
                Antes de aplicar carrito
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Impacto Neto Carrito ({stagedActions.length} ops)
              </span>
              <div className="mt-1 text-lg font-bold text-blue-800 tabular-nums">
                {deltaForecastClp >= 0
                  ? `+${formatClp(deltaForecastClp)}`
                  : formatClp(deltaForecastClp)}
              </div>
              <div className="text-[11px] text-blue-600">
                Nuevo Forecast SF: {formatClp(projectedForecastSfClp)}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Brecha Restante Post-Ejecución
              </span>
              <div className="mt-1 text-lg font-bold text-emerald-800 tabular-nums">
                {projectedBrechaClp > 0
                  ? `+${formatClp(projectedBrechaClp)}`
                  : formatClp(projectedBrechaClp)}
              </div>
              <div className="text-[11px] text-emerald-700">
                vs Facturación EERR ({formatClp(currentEerrClp)})
              </div>
            </div>
          </div>

          {/* Alerta de blindaje si existiera alguna acción inválida */}
          {invalidActions.length > 0 && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>
                <strong>Bloqueo de Seguridad:</strong> Hay {invalidActions.length} acción(es) CREATE_CUOTA sin{' '}
                <code>opportunityId</code> obligatorio. Elimínalas antes de continuar.
              </span>
            </div>
          )}

          {/* Tabla Auditable de Operaciones en Staging */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Cola de Operaciones REST / Composite API ({stagedActions.length})
              </span>
              {stagedActions.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Vaciar Carrito
                </button>
              )}
            </div>

            {stagedActions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay operaciones encoladas en el Staging Cart. Puedes agregar ajustes desde las pestañas &ldquo;Diferencias de Monto&rdquo;, &ldquo;Desfases de Período&rdquo; o &ldquo;Mesa de Cirugía&rdquo;.
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100">
                {stagedActions.map((act) => (
                  <div
                    key={act.id}
                    className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {act.type === 'UPDATE_MONTO' && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                            PATCH Cuota__c.Monto_CLP__c
                          </span>
                        )}
                        {act.type === 'UPDATE_FECHA' && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-orange-100 text-orange-800 border border-orange-200">
                            PATCH Cuota__c.Fecha_Pago__c
                          </span>
                        )}
                        {act.type === 'CREATE_CUOTA' && (
                          <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                            POST Cuota__c (Oportunidad__c: {act.opportunityId})
                          </span>
                        )}
                        <span className="font-bold text-slate-900 truncate">
                          {act.cliente || act.opportunityName}
                        </span>
                      </div>

                      {act.type === 'UPDATE_MONTO' && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                          <span>Cuota {act.cuotaId}:</span>
                          <span className="line-through text-slate-400">
                            {formatClp(act.montoAnterior)}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <strong className="text-emerald-700">
                            {formatClp(act.montoNuevo)}
                          </strong>
                          <span className="text-slate-400">• {act.motivo}</span>
                        </div>
                      )}

                      {act.type === 'UPDATE_FECHA' && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
                          <span>Cuota {act.cuotaId}:</span>
                          <span className="line-through text-slate-400">
                            {act.fechaAnterior}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400" />
                          <strong className="text-orange-700">
                            {act.fechaNueva}
                          </strong>
                          <span className="text-slate-400">• {act.motivo}</span>
                        </div>
                      )}

                      {act.type === 'CREATE_CUOTA' && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <span>Nueva Cuota en {act.opportunityName}:</span>
                          <strong className="text-indigo-700">
                            {formatClp(act.montoClp)}
                          </strong>
                          <span>• Fecha: {act.fechaPago}</span>
                          <span className="text-slate-400">
                            • {act.glosaReferencia}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveAction(act.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                      title="Quitar del carrito"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Log Auditable Post-Ejecución (si ya se ejecutó) */}
          {executionLogs.length > 0 && (
            <div className="border border-emerald-200 rounded-xl overflow-hidden bg-emerald-50/40">
              <div className="px-4 py-2.5 bg-emerald-100/70 border-b border-emerald-200 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  Registro de Auditoría Salesforce ({executionLogs.length} resultados)
                </span>
              </div>
              <div className="max-h-[200px] overflow-y-auto divide-y divide-emerald-100 p-3 space-y-1.5">
                {executionLogs.map((log) => (
                  <div
                    key={log.actionId}
                    className="text-xs flex items-center justify-between gap-2 py-1"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2
                        className={`w-4 h-4 shrink-0 ${
                          log.status === 'ERROR'
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      />
                      <span className="font-semibold text-slate-800 truncate">
                        {log.descripcion}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] shrink-0">
                      <span className="text-slate-500">{log.valorAnterior}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-emerald-700">
                        {log.valorNuevo}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-slate-200 text-slate-700">
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer de Acciones: Exportar Respaldo + Confirmar y Escribir en SF */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Exportar Pre-Conciliación (.csv / Excel)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors"
            >
              Cerrar
            </button>

            <button
              type="button"
              disabled={
                stagedActions.length === 0 ||
                invalidActions.length > 0 ||
                applying
              }
              onClick={onExecuteStaging}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Escribiendo en Salesforce...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Confirmar y Escribir en Salesforce ({stagedActions.length})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

