'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import ConciliadorHeaderBalance from '@/components/conciliador/ConciliadorHeaderBalance';
import ConciliadorStepperTabs from '@/components/conciliador/ConciliadorStepperTabs';
import StagingPreFlightModal from '@/components/conciliador/StagingPreFlightModal';
import {
  ApplyActionLog,
  ConciliacionGroup,
  ConciliacionResumen,
  EerrRegistro,
  FiltroCuentaComercial,
  OportunidadClienteRef,
  SalesforceCuotaRegistro,
  StagingAction,
  WorkflowStage,
} from '@/lib/conciliador-types';
import { SessionUser } from '@/lib/types';
import { isSuperAdminRole } from '@/lib/permissions';
import { Upload, X, FileSpreadsheet, Loader2, RotateCcw } from 'lucide-react';

interface UploadedSessionState {
  allEerrItems: EerrRegistro[];
  allSfItems: SalesforceCuotaRegistro[];
  nombreArchivoEerr?: string;
  nombreArchivoSf?: string;
}

export default function ConciliadorPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Contexto de período y filtros
  const [mes, setMes] = useState<number>(1);
  const [anio, setAnio] = useState<number>(2026);
  const [division, setDivision] = useState<string>('DGL');
  const [sourceMode, setSourceMode] = useState<'excel' | 'salesforce'>('excel');
  const [filtroCuentaComercial, setFiltroCuentaComercial] =
    useState<FiltroCuentaComercial>('todas');
  const [incluirTraspasosInternos, setIncluirTraspasosInternos] =
    useState<boolean>(false);
  const [activeStage, setActiveStage] = useState<WorkflowStage>('CUADRADOS');

  // Estado principal del Motor v2.0
  const [groups, setGroups] = useState<ConciliacionGroup[]>([]);
  const [oportunidadesClientes, setOportunidadesClientes] = useState<
    OportunidadClienteRef[]
  >([]);
  const [resumen, setResumen] = useState<ConciliacionResumen | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carrito de Acciones (Staging Cart) y Auditoría
  const [stagedActions, setStagedActions] = useState<StagingAction[]>([]);
  const [showStagingModal, setShowStagingModal] = useState<boolean>(false);
  const [applying, setApplying] = useState<boolean>(false);
  const [executionLogs, setExecutionLogs] = useState<ApplyActionLog[]>([]);

  // IA Gemini On-Demand (Batch sobre huérfanos)
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiSuggestions, setAiSuggestions] = useState<
    Array<{ eerrId: string; cuotaId: string; confianza: number; justificacion: string }>
  >([]);

  // Carga de archivos Excel personalizados
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [fileEerr, setFileEerr] = useState<File | null>(null);
  const [fileSf, setFileSf] = useState<File | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<boolean>(false);
  const [uploadedSession, setUploadedSession] =
    useState<UploadedSessionState | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setAiSuggestions([]);
    try {
      if (uploadedSession) {
        const res = await fetch('/api/conciliador/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mes,
            anio,
            division,
            filtroCuentaComercial,
            allEerrItems: uploadedSession.allEerrItems,
            allSfItems: uploadedSession.allSfItems,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al recalcular datos.');
        setGroups(data.groups || []);
        setOportunidadesClientes(data.oportunidadesClientes || []);
        setResumen(data.resumen || null);
      } else {
        const sfParam = sourceMode === 'salesforce' ? 'salesforce_live' : 'excel';
        const res = await fetch(
          `/api/conciliador/data?mes=${mes}&anio=${anio}&division=${division}&source=${sfParam}&filtroCuentaComercial=${filtroCuentaComercial}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al obtener conciliación.');
        setGroups(data.groups || []);
        setOportunidadesClientes(data.oportunidadesClientes || []);
        setResumen(data.resumen || null);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error cargando conciliación.');
    } finally {
      setLoading(false);
    }
  }, [mes, anio, division, sourceMode, filtroCuentaComercial, uploadedSession]);

  useEffect(() => {
    if (user && (isSuperAdminRole(user.role) || user.profileId === 'superadmin')) {
      fetchData();
    }
  }, [user, fetchData]);

  // Encolar acciones en el Staging Cart evitando duplicados sobre la misma cuota/factura
  const handleStageActions = (newActions: StagingAction[]) => {
    setStagedActions((prev) => {
      const next = [...prev];
      for (const act of newActions) {
        const dupIdx = next.findIndex((existing) => {
          if (
            (act.type === 'UPDATE_MONTO' || act.type === 'UPDATE_FECHA') &&
            existing.type === act.type
          ) {
            return existing.cuotaId === act.cuotaId;
          }
          if (act.type === 'CREATE_CUOTA' && existing.type === 'CREATE_CUOTA') {
            return existing.eerrIds.join(',') === act.eerrIds.join(',');
          }
          return false;
        });
        if (dupIdx >= 0) next[dupIdx] = act;
        else next.push(act);
      }
      return next;
    });
  };

  // Vinculación Manual N:M desde la Mesa de Cirugía
  const handleManualLinkGroups = (
    eerrGroupIds: string[],
    sfGroupIds: string[],
    autoAdjustMonto: boolean
  ) => {
    const eerrGroups = groups.filter((g) => eerrGroupIds.includes(g.id));
    const sfGroups = groups.filter((g) => sfGroupIds.includes(g.id));
    if (eerrGroups.length === 0 || sfGroups.length === 0) return;

    const mergedEerr = eerrGroups.flatMap((g) => g.eerrItems);
    const mergedSf = sfGroups.flatMap((g) => g.sfItems);
    const totalEerrClp = mergedEerr.reduce((acc, e) => acc + e.montoClp, 0);
    const totalSfClp = mergedSf.reduce((acc, c) => acc + c.montoClp, 0);
    const deltaClp = totalEerrClp - totalSfClp;
    const isExact = Math.abs(deltaClp) <= 2000;

    const card: ConciliacionGroup['cardinalidad'] =
      mergedEerr.length === 1 && mergedSf.length === 1
        ? '1:1'
        : mergedEerr.length > 1 && mergedSf.length === 1
        ? 'N:1'
        : mergedEerr.length === 1 && mergedSf.length > 1
        ? '1:N'
        : 'N:M';

    const newGroup: ConciliacionGroup = {
      id: `grp-manual-${Date.now()}`,
      stage: isExact || autoAdjustMonto ? 'CUADRADOS' : 'DIFERENCIA_MONTO',
      cardinalidad: card,
      rut: mergedEerr[0]?.rut || mergedSf[0]?.rutEmpresa || '',
      cliente: mergedEerr[0]?.razonSocial || mergedSf[0]?.cuenta || '',
      codigoProyecto:
        mergedSf[0]?.codigoOportunidadExtraido ||
        mergedEerr[0]?.codigoOportunidadExtraido,
      codigoNucleo: mergedSf[0]?.codigoNucleo || mergedEerr[0]?.codigoNucleo,
      eerrItems: mergedEerr,
      sfItems: mergedSf,
      totalEerrClp,
      totalEerrUf: Math.round((totalEerrClp / 38500) * 100) / 100,
      totalSfClp,
      totalSfUf: Math.round((totalSfClp / 38500) * 100) / 100,
      deltaClp,
      deltaPct:
        totalSfClp !== 0
          ? Math.round(((totalEerrClp - totalSfClp) / Math.abs(totalSfClp)) * 1000) / 10
          : 0,
      deltaUf: Math.round((deltaClp / 38500) * 100) / 100,
      scoreBreakdown: {
        totalScore: 100,
        codigoScore: 45,
        montoScore: 25,
        textoScore: 15,
        tiempoScore: 10,
        seccionScore: 5,
        matchType: 'MANUAL',
        explicacion: `Vinculación manual (${card}) realizada en Mesa de Cirugía`,
      },
    };

    const removeSet = new Set([...eerrGroupIds, ...sfGroupIds]);
    setGroups((prev) => [newGroup, ...prev.filter((g) => !removeSet.has(g.id))]);

    if (autoAdjustMonto && !isExact && mergedSf.length > 0) {
      const targetCuota = mergedSf[mergedSf.length - 1];
      handleStageActions([
        {
          id: `manual-adj-${targetCuota.id}-${Date.now()}`,
          type: 'UPDATE_MONTO',
          groupId: newGroup.id,
          cuotaId: targetCuota.id,
          opportunityId: targetCuota.opportunityId,
          opportunityName: targetCuota.opportunityName,
          cliente: newGroup.cliente,
          rut: newGroup.rut,
          montoAnterior: targetCuota.montoClp,
          montoNuevo: Math.max(0, targetCuota.montoClp + deltaClp),
          motivo: `Ajuste automático por vinculación manual (${card}) en Mesa de Cirugía`,
        },
      ]);
    }
  };

  // Ejecutar IA Gemini On-Demand (Batch sobre huérfanos)
  const handleRunAiBatch = async () => {
    const orphans = groups.filter((g) => g.stage === 'MESA_CIRUGIA');
    const huerfanosEerr = orphans.flatMap((g) => g.eerrItems);
    const huerfanosSf = orphans.flatMap((g) => g.sfItems);
    if (huerfanosEerr.length === 0 || huerfanosSf.length === 0) return;

    setAiLoading(true);
    try {
      const res = await fetch('/api/conciliador/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ai_batch_orphan_match',
          huerfanosEerr,
          huerfanosSf,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data.sugerencias)) {
        setAiSuggestions(data.sugerencias);
      }
    } catch (err) {
      console.error('Error en IA Batch:', err);
    } finally {
      setAiLoading(false);
    }
  };

  // Ejecutar escritura del Staging Cart hacia Salesforce
  const handleExecuteStaging = async () => {
    if (stagedActions.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch('/api/conciliador/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stagingActions: stagedActions,
          mes,
          anio,
          division,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error aplicando cambios en SF.');
      setExecutionLogs(data.logs || []);
      setStagedActions([]);
    } catch (err: any) {
      alert(err?.message || 'Error al ejecutar Staging Cart.');
    } finally {
      setApplying(false);
    }
  };

  // Subir archivos Excel personalizados
  const handleUploadExcelFiles = async () => {
    if (!fileEerr && !fileSf) return;
    setUploadingFiles(true);
    try {
      const formData = new FormData();
      if (fileEerr) formData.append('fileEerr', fileEerr);
      if (fileSf) formData.append('fileSf', fileSf);
      formData.append('division', division);
      formData.append('filtroCuentaComercial', filtroCuentaComercial);

      const res = await fetch('/api/conciliador/data', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error procesando Excel.');

      if (data.mesDetectado) setMes(data.mesDetectado);
      if (data.anioDetectado) setAnio(data.anioDetectado);
      setGroups(data.groups || []);
      setOportunidadesClientes(data.oportunidadesClientes || []);
      setResumen(data.resumen || null);
      setUploadedSession({
        allEerrItems: data.allEerrItems || [],
        allSfItems: data.allSfItems || [],
        nombreArchivoEerr: data.nombreArchivoEerr,
        nombreArchivoSf: data.nombreArchivoSf,
      });
      setShowUploadModal(false);
    } catch (err: any) {
      alert(err?.message || 'Error al procesar archivos Excel.');
    } finally {
      setUploadingFiles(false);
    }
  };

  if (loadingUser) return null;

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        <ConciliadorHeaderBalance
          mes={mes}
          anio={anio}
          division={division}
          sourceMode={sourceMode}
          filtroCuentaComercial={filtroCuentaComercial}
          incluirTraspasosInternos={incluirTraspasosInternos}
          loading={loading}
          resumen={resumen}
          stagingCount={stagedActions.length}
          customFileName={
            uploadedSession
              ? `${uploadedSession.nombreArchivoEerr || ''} ${
                  uploadedSession.nombreArchivoSf || ''
                }`.trim()
              : null
          }
          onChangeMes={setMes}
          onChangeAnio={setAnio}
          onChangeDivision={setDivision}
          onChangeSourceMode={setSourceMode}
          onChangeFiltroCuentaComercial={setFiltroCuentaComercial}
          onToggleTraspasosInternos={setIncluirTraspasosInternos}
          onRefresh={fetchData}
          onOpenUploadModal={() => setShowUploadModal(true)}
          onOpenStagingModal={() => setShowStagingModal(true)}
        />

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        <ConciliadorStepperTabs
          activeStage={activeStage}
          onChangeStage={setActiveStage}
          groups={groups}
          oportunidadesClientes={oportunidadesClientes}
          mesActual={mes}
          anioActual={anio}
          incluirTraspasosInternos={incluirTraspasosInternos}
          stagedActions={stagedActions}
          aiLoading={aiLoading}
          aiSuggestions={aiSuggestions}
          onStageActions={handleStageActions}
          onManualLinkGroups={handleManualLinkGroups}
          onRunAiBatch={handleRunAiBatch}
        />
      </main>

      <StagingPreFlightModal
        isOpen={showStagingModal}
        onClose={() => setShowStagingModal(false)}
        stagedActions={stagedActions}
        groups={groups}
        currentForecastSfClp={
          resumen?.totalSfVentaExternaClp ?? resumen?.totalSalesforceClp ?? 0
        }
        currentEerrClp={
          resumen?.totalEerrVentaExternaClp ?? resumen?.totalEerrClp ?? 0
        }
        mes={mes}
        anio={anio}
        division={division}
        applying={applying}
        executionLogs={executionLogs}
        onRemoveAction={(id) =>
          setStagedActions((prev) => prev.filter((a) => a.id !== id))
        }
        onClearAll={() => setStagedActions([])}
        onExecuteStaging={handleExecuteStaging}
      />

      {/* Modal ligero de Carga Dual Excel */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                Cargar Planillas EERR y Cuotas Salesforce
              </h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  1. Planilla EERR / Facturaciones (.xlsx / .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFileEerr(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600"
                />
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5">
                <label className="font-bold text-slate-700 block">
                  2. Reporte Cuotas Salesforce (.xlsx / .csv)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setFileSf(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {uploadedSession ? (
                <button
                  type="button"
                  onClick={() => {
                    setUploadedSession(null);
                    setShowUploadModal(false);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar datos base
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={uploadingFiles || (!fileEerr && !fileSf)}
                  onClick={handleUploadExcelFiles}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-xs font-bold text-white"
                >
                  {uploadingFiles ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  Procesar Archivos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
