'use client';

import React, { useState, useMemo } from 'react';
import {
  Link2,
  PlusCircle,
  Sparkles,
  Search,
  CalendarClock,
  CheckSquare,
  Square,
  Building2,
  FileText,
  Briefcase,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Filter,
} from 'lucide-react';
import {
  ConciliacionGroup,
  OportunidadClienteRef,
  StagingAction,
} from '@/lib/conciliador-types';
import { formatClp } from './ConciliadorHeaderBalance';

interface AiBatchSuggestion {
  eerrId: string;
  cuotaId: string;
  confianza: number;
  justificacion: string;
}

interface TabMesaCirugiaSplitProps {
  orphanGroups: ConciliacionGroup[];
  oportunidadesClientes: OportunidadClienteRef[];
  mesActual: number;
  anioActual: number;
  aiLoading: boolean;
  aiSuggestions: AiBatchSuggestion[];
  stagedActions: StagingAction[];
  onRunAiBatch: () => void;
  onManualLinkGroups: (
    eerrGroupIds: string[],
    sfGroupIds: string[],
    autoAdjustMonto: boolean
  ) => void;
  onStageActions: (actions: StagingAction[]) => void;
}

export default function TabMesaCirugiaSplit({
  orphanGroups,
  oportunidadesClientes,
  mesActual,
  anioActual,
  aiLoading,
  aiSuggestions,
  stagedActions,
  onRunAiBatch,
  onManualLinkGroups,
  onStageActions,
}: TabMesaCirugiaSplitProps) {
  const [selectedEerrGroupIds, setSelectedEerrGroupIds] = useState<string[]>([]);
  const [selectedSfGroupIds, setSelectedSfGroupIds] = useState<string[]>([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string>('');
  const [searchEerr, setSearchEerr] = useState('');
  const [searchSf, setSearchSf] = useState('');
  const [searchOpp, setSearchOpp] = useState('');
  const [filterBySelectedRut, setFilterBySelectedRut] = useState(true);
  const [autoAdjustOnLink, setAutoAdjustOnLink] = useState(true);
  const [comercialFilter, setComercialFilter] = useState<string>('TODOS');
  const [motivoPostergacion, setMotivoPostergacion] = useState(
    'Postergación de facturación al mes siguiente (cierre mensual)'
  );

  // Separar huérfanos EERR (1:0) y huérfanos SF (0:1)
  const eerrOrphanGroups = useMemo(
    () =>
      orphanGroups.filter(
        (g) => g.eerrItems.length > 0 && g.sfItems.length === 0
      ),
    [orphanGroups]
  );

  const sfOrphanGroups = useMemo(
    () =>
      orphanGroups.filter(
        (g) => g.sfItems.length > 0 && g.eerrItems.length === 0
      ),
    [orphanGroups]
  );

  // Identificar qué facturas o cuotas ya tienen acción en el StagingCart
  const stagedEerrIds = useMemo(() => {
    const set = new Set<string>();
    for (const act of stagedActions) {
      if (act.type === 'CREATE_CUOTA') {
        act.eerrIds.forEach((id) => set.add(id));
      }
    }
    return set;
  }, [stagedActions]);

  const stagedCuotaIds = useMemo(() => {
    const set = new Set<string>();
    for (const act of stagedActions) {
      if (act.type === 'UPDATE_MONTO' || act.type === 'UPDATE_FECHA') {
        set.add(act.cuotaId);
      }
    }
    return set;
  }, [stagedActions]);

  // Grupos EERR seleccionados actualmente
  const selectedEerrGroups = useMemo(
    () => eerrOrphanGroups.filter((g) => selectedEerrGroupIds.includes(g.id)),
    [eerrOrphanGroups, selectedEerrGroupIds]
  );

  // Grupos SF seleccionados actualmente
  const selectedSfGroups = useMemo(
    () => sfOrphanGroups.filter((g) => selectedSfGroupIds.includes(g.id)),
    [sfOrphanGroups, selectedSfGroupIds]
  );

  // RUT activo derivado de las facturas EERR seleccionadas
  const activeRuts = useMemo(() => {
    const ruts = new Set<string>();
    selectedEerrGroups.forEach((g) => {
      if (g.rut) ruts.add(g.rut.replace(/[^0-9kK]/g, '').toUpperCase());
    });
    return ruts;
  }, [selectedEerrGroups]);

  // Mapa de candidatos sugeridos (Top 3) desde los grupos EERR seleccionados
  const candidateScoresByCuotaId = useMemo(() => {
    const map = new Map<string, { score: number; explicacion: string }>();
    for (const eg of selectedEerrGroups) {
      for (const cand of eg.candidatosSugeridos || []) {
        if (cand.targetType === 'SF_CUOTA') {
          const prev = map.get(cand.targetId);
          if (!prev || cand.scoreBreakdown.totalScore > prev.score) {
            map.set(cand.targetId, {
              score: cand.scoreBreakdown.totalScore,
              explicacion: cand.scoreBreakdown.explicacion,
            });
          }
        }
      }
    }
    return map;
  }, [selectedEerrGroups]);

  // Lista de comerciales únicos en cuotas SF huérfanas
  const comercialesList = useMemo(() => {
    const set = new Set<string>();
    sfOrphanGroups.forEach((g) => {
      const com = g.sfItems[0]?.comercialResponsable || g.sfItems[0]?.unidad;
      if (com) set.add(com);
    });
    return Array.from(set).sort();
  }, [sfOrphanGroups]);

  // Filtrado de Facturas EERR Huérfanas (Panel Izquierdo)
  const filteredEerrGroups = useMemo(() => {
    const q = searchEerr.trim().toLowerCase();
    return eerrOrphanGroups.filter((g) => {
      if (!q) return true;
      const e = g.eerrItems[0];
      return (
        g.cliente.toLowerCase().includes(q) ||
        g.rut.toLowerCase().includes(q) ||
        (g.codigoProyecto || '').toLowerCase().includes(q) ||
        (e?.glosa || '').toLowerCase().includes(q) ||
        (e?.referenciaExterna || '').toLowerCase().includes(q)
      );
    });
  }, [eerrOrphanGroups, searchEerr]);

  // Filtrado y ordenamiento de Cuotas SF Huérfanas (Panel Derecho Superior)
  const filteredSfGroups = useMemo(() => {
    const q = searchSf.trim().toLowerCase();
    const list = sfOrphanGroups.filter((g) => {
      const c = g.sfItems[0];
      if (!c) return false;
      if (
        comercialFilter !== 'TODOS' &&
        (c.comercialResponsable || c.unidad || 'Sin asignar') !== comercialFilter
      ) {
        return false;
      }
      if (filterBySelectedRut && activeRuts.size > 0) {
        const normRut = g.rut.replace(/[^0-9kK]/g, '').toUpperCase();
        const isCandidate = candidateScoresByCuotaId.has(c.id);
        if (!activeRuts.has(normRut) && !isCandidate) return false;
      }
      if (!q) return true;
      return (
        g.cliente.toLowerCase().includes(q) ||
        g.rut.toLowerCase().includes(q) ||
        (g.codigoProyecto || '').toLowerCase().includes(q) ||
        c.opportunityName.toLowerCase().includes(q)
      );
    });

    // Ordenar poniendo primero los candidatos sugeridos con mayor Score
    return [...list].sort((a, b) => {
      const idA = a.sfItems[0]?.id || '';
      const idB = b.sfItems[0]?.id || '';
      const scoreA = candidateScoresByCuotaId.get(idA)?.score ?? -1;
      const scoreB = candidateScoresByCuotaId.get(idB)?.score ?? -1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      return b.totalSfClp - a.totalSfClp;
    });
  }, [
    sfOrphanGroups,
    searchSf,
    comercialFilter,
    filterBySelectedRut,
    activeRuts,
    candidateScoresByCuotaId,
  ]);

  // Filtrado de Oportunidades Activas del Cliente (Panel Derecho Inferior)
  const filteredOpportunities = useMemo(() => {
    const q = searchOpp.trim().toLowerCase();
    return oportunidadesClientes.filter((opp) => {
      if (filterBySelectedRut && activeRuts.size > 0) {
        const normRut = opp.rutEmpresa.replace(/[^0-9kK]/g, '').toUpperCase();
        if (!activeRuts.has(normRut)) return false;
      }
      if (!q) return true;
      return (
        opp.opportunityName.toLowerCase().includes(q) ||
        opp.cuenta.toLowerCase().includes(q) ||
        opp.rutEmpresa.toLowerCase().includes(q) ||
        (opp.codigoExtraido || '').toLowerCase().includes(q)
      );
    });
  }, [oportunidadesClientes, filterBySelectedRut, activeRuts, searchOpp]);

  // Totales de selección actual para previsualizar el cruce N:M
  const sumSelectedEerrClp = useMemo(
    () => selectedEerrGroups.reduce((acc, g) => acc + g.totalEerrClp, 0),
    [selectedEerrGroups]
  );

  const sumSelectedSfClp = useMemo(
    () => selectedSfGroups.reduce((acc, g) => acc + g.totalSfClp, 0),
    [selectedSfGroups]
  );

  const deltaSelectionClp = sumSelectedEerrClp - sumSelectedSfClp;

  const toggleEerrSelection = (id: string) => {
    setSelectedEerrGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSfSelection = (id: string) => {
    setSelectedSfGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleLinkSelected = () => {
    if (selectedEerrGroupIds.length === 0 || selectedSfGroupIds.length === 0) return;
    onManualLinkGroups(selectedEerrGroupIds, selectedSfGroupIds, autoAdjustOnLink);
    setSelectedEerrGroupIds([]);
    setSelectedSfGroupIds([]);
  };

  const handleCreateCuotaInOpportunity = () => {
    if (selectedEerrGroups.length === 0 || !selectedOpportunityId) return;
    const targetOpp = oportunidadesClientes.find(
      (o) => o.opportunityId === selectedOpportunityId
    );
    if (!targetOpp || !targetOpp.opportunityId) return;

    const eerrItems = selectedEerrGroups.flatMap((g) => g.eerrItems);
    const totalMonto = eerrItems.reduce((acc, item) => acc + item.montoClp, 0);
    const firstEerr = eerrItems[0];
    const refs = eerrItems
      .map((e) => e.referenciaExterna || e.comprobante)
      .filter(Boolean)
      .join(', ');

    const newAction: StagingAction = {
      id: `create-cuota-${Date.now()}`,
      type: 'CREATE_CUOTA',
      opportunityId: targetOpp.opportunityId, // REGLA DURA: Estrictamente obligatorio
      opportunityName: targetOpp.opportunityName,
      cliente: targetOpp.cuenta || firstEerr?.razonSocial,
      rut: targetOpp.rutEmpresa || firstEerr?.rut,
      montoClp: totalMonto,
      fechaPago:
        firstEerr?.fecha ||
        `${anioActual}-${String(mesActual).padStart(2, '0')}-28`,
      glosaReferencia: `Facturación EERR (${refs || 'S/R'}): ${
        firstEerr?.glosa || ''
      }`.slice(0, 140),
      eerrIds: eerrItems.map((e) => e.id),
    };

    onStageActions([newAction]);
    setSelectedEerrGroupIds([]);
  };

  const handlePostponeSelectedSfToNextMonth = () => {
    if (selectedSfGroups.length === 0) return;
    const nextMes = mesActual === 12 ? 1 : mesActual + 1;
    const nextAnio = mesActual === 12 ? anioActual + 1 : anioActual;
    const nuevaFecha = `${nextAnio}-${String(nextMes).padStart(2, '0')}-15`;

    const actions: StagingAction[] = [];
    for (const g of selectedSfGroups) {
      for (const c of g.sfItems) {
        actions.push({
          id: `postpone-${c.id}-${Date.now()}`,
          type: 'UPDATE_FECHA',
          groupId: g.id,
          cuotaId: c.id,
          opportunityId: c.opportunityId,
          opportunityName: c.opportunityName,
          cliente: c.cuenta,
          rut: c.rutEmpresa,
          montoClp: c.montoClp,
          fechaAnterior: c.fechaPago,
          fechaNueva: nuevaFecha,
          motivo: motivoPostergacion,
        });
      }
    }
    onStageActions(actions);
    setSelectedSfGroupIds([]);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Comando de la Mesa de Cirugía (Consola N:M + IA On-Demand) */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Workbench 50/50
              </span>
              <h3 className="text-sm font-bold text-white">
                Mesa de Cirugía: Resolución N:M de Huérfanos y Creación Validada
              </h3>
            </div>
            <p className="text-xs text-slate-300">
              Selecciona 1 o más facturas EERR a la izquierda para filtrar automáticamente por RUT las cuotas candidatas y oportunidades padre a la derecha.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botón IA Gemini On-Demand */}
            <button
              type="button"
              onClick={onRunAiBatch}
              disabled={aiLoading || (eerrOrphanGroups.length === 0 && sfOrphanGroups.length === 0)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
            >
              <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
              {aiLoading ? 'Analizando con Gemini...' : 'Sugerir Cruces con IA (Batch)'}
            </button>

            {/* Toggle Filtrar por RUT seleccionado */}
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filterBySelectedRut}
                onChange={(e) => setFilterBySelectedRut(e.target.checked)}
                className="rounded border-slate-600 text-blue-500 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Auto-filtrar panel derecho por RUT seleccionado</span>
            </label>
          </div>
        </div>

        {/* Barra de acción contextual cuando hay ítems seleccionados */}
        {(selectedEerrGroups.length > 0 || selectedSfGroups.length > 0) && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-slate-400">EERR Seleccionadas: </span>
                <span className="font-bold text-emerald-400">
                  {selectedEerrGroups.length} ({formatClp(sumSelectedEerrClp)})
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-500" />
              <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                <span className="text-slate-400">Cuotas SF Seleccionadas: </span>
                <span className="font-bold text-blue-400">
                  {selectedSfGroups.length} ({formatClp(sumSelectedSfClp)})
                </span>
              </div>
              {selectedEerrGroups.length > 0 && selectedSfGroups.length > 0 && (
                <div className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
                  <span className="text-slate-400">Diferencia: </span>
                  <span
                    className={`font-bold ${
                      Math.abs(deltaSelectionClp) <= 2000
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {formatClp(deltaSelectionClp)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedEerrGroups.length > 0 && selectedSfGroups.length > 0 && (
                <>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-300 mr-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoAdjustOnLink}
                      onChange={(e) => setAutoAdjustOnLink(e.target.checked)}
                      className="rounded border-slate-600 text-blue-500 w-3.5 h-3.5"
                    />
                    <span>Ajustar monto SF si difiere</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleLinkSelected}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Vincular Manualmente ({selectedEerrGroups.length}:{selectedSfGroups.length})
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setSelectedEerrGroupIds([]);
                  setSelectedSfGroupIds([]);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sugerencias IA On-Demand (si existen) */}
      {aiSuggestions.length > 0 && (
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              Sugerencias Semánticas IA Gemini ({aiSuggestions.length} hallazgos)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {aiSuggestions.map((sug, idx) => {
              const eg = eerrOrphanGroups.find((g) =>
                g.eerrItems.some((e) => e.id === sug.eerrId)
              );
              const sg = sfOrphanGroups.find((g) =>
                g.sfItems.some((c) => c.id === sug.cuotaId)
              );
              if (!eg || !sg) return null;
              return (
                <div
                  key={`${sug.eerrId}-${sug.cuotaId}-${idx}`}
                  className="bg-white rounded-lg p-2.5 border border-indigo-200 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">
                      {eg.cliente} ({formatClp(eg.totalEerrClp)}) ↔{' '}
                      {sg.sfItems[0]?.opportunityName} ({formatClp(sg.totalSfClp)})
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">
                      Confianza {sug.confianza}%: {sug.justificacion}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onManualLinkGroups([eg.id], [sg.id], true)}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0"
                  >
                    Vincular
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Split Screen 50 / 50 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* PANEL IZQUIERDO (6 cols): Facturas EERR Huérfanas (No Proyectadas) */}
        <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  1. Facturas EERR Huérfanas ({filteredEerrGroups.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  Facturadas en contabilidad sin cuota asignada en Salesforce
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchEerr}
                onChange={(e) => setSearchEerr(e.target.value)}
                placeholder="Buscar RUT, cliente, factura..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
            {filteredEerrGroups.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No hay facturas EERR huérfanas con los filtros actuales.
              </div>
            ) : (
              filteredEerrGroups.map((g) => {
                const e = g.eerrItems[0];
                const isSelected = selectedEerrGroupIds.includes(g.id);
                const isStaged = e && stagedEerrIds.has(e.id);
                const topCandidates = g.candidatosSugeridos || [];

                return (
                  <div
                    key={g.id}
                    onClick={() => toggleEerrSelection(g.id)}
                    className={`p-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 text-slate-400">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {g.cliente}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-700">
                              {g.rut}
                            </span>
                            {g.codigoProyecto && (
                              <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                {g.codigoProyecto}
                              </span>
                            )}
                            {isStaged && (
                              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800">
                                En Staging Cart
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                            <span className="font-semibold text-slate-700">
                              Doc #{e?.referenciaExterna || e?.comprobante}:
                            </span>{' '}
                            {e?.glosa || e?.referenciaInterna || 'Sin glosa'}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            <span>Fecha: {e?.fecha}</span>
                            <span>•</span>
                            <span>Sección: {e?.seccion || 'S/I'}</span>
                            <span>•</span>
                            <span>CC: {e?.centroCosto || 'S/I'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-bold text-slate-900 tabular-nums">
                          {formatClp(g.totalEerrClp)}
                        </div>
                        <div className="text-[10px] text-slate-500 tabular-nums">
                          {g.totalEerrUf} UF
                        </div>
                      </div>
                    </div>

                    {/* Top 3 candidatos sugeridos para esta factura */}
                    {topCandidates.length > 0 && (
                      <div className="mt-2 pl-6 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-slate-500">
                          Candidatos SF:
                        </span>
                        {topCandidates.map((cand) => (
                          <span
                            key={cand.targetId}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200"
                            title={cand.scoreBreakdown.explicacion}
                          >
                            <span className="font-bold">
                              {cand.scoreBreakdown.totalScore}%
                            </span>
                            <span className="truncate max-w-[140px]">
                              {cand.codigoExtraido || cand.titulo}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* PANEL DERECHO (6 cols): Cuotas SF Candidatas + Selector de Oportunidades Activas */}
        <div className="lg:col-span-6 space-y-4">
          {/* Parte Superior Derecha: Cuotas SF No Facturadas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      2A. Cuotas Salesforce No Facturadas ({filteredSfGroups.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Selecciona para vincular con EERR o postergar al mes siguiente
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={comercialFilter}
                    onChange={(e) => setComercialFilter(e.target.value)}
                    className="px-2 py-1 text-[11px] rounded-lg border border-slate-200 bg-white text-slate-700"
                    title="Filtrar por Comercial / Unidad"
                  >
                    <option value="TODOS">Todos los Comerciales</option>
                    {comercialesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchSf}
                      onChange={(e) => setSearchSf(e.target.value)}
                      placeholder="Buscar cuota u Opp..."
                      className="w-full pl-8 pr-2 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Barra rápida para postergar cuotas SF seleccionadas al mes siguiente */}
              {selectedSfGroups.length > 0 && selectedEerrGroups.length === 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-amber-900">
                    <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{selectedSfGroups.length} cuota(s)</strong> sin factura seleccionada(s). ¿Mover al próximo mes?
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={motivoPostergacion}
                      onChange={(e) => setMotivoPostergacion(e.target.value)}
                      placeholder="Motivo de postergación..."
                      className="px-2 py-1 text-[11px] rounded border border-amber-300 bg-white text-slate-800 w-44"
                    />
                    <button
                      type="button"
                      onClick={handlePostponeSelectedSfToNextMonth}
                      className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shrink-0 cursor-pointer"
                    >
                      Postergar a M+1
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="divide-y divide-slate-100 max-h-[310px] overflow-y-auto">
              {filteredSfGroups.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {activeRuts.size > 0 && filterBySelectedRut
                    ? 'Este RUT no tiene cuotas SF pendientes de facturar. Puedes crear una nueva cuota en una Oportunidad abajo o desactivar el auto-filtro por RUT.'
                    : 'No hay cuotas Salesforce pendientes con los filtros actuales.'}
                </div>
              ) : (
                filteredSfGroups.map((g) => {
                  const c = g.sfItems[0];
                  const isSelected = selectedSfGroupIds.includes(g.id);
                  const isStaged = c && stagedCuotaIds.has(c.id);
                  const candInfo = c ? candidateScoresByCuotaId.get(c.id) : undefined;

                  return (
                    <div
                      key={g.id}
                      onClick={() => toggleSfSelection(g.id)}
                      className={`p-3 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/70 border-l-4 border-l-blue-600'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="mt-0.5 text-slate-400">
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 truncate">
                                {g.cliente}
                              </span>
                              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-100 text-slate-700">
                                {g.rut}
                              </span>
                              {g.codigoProyecto && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {g.codigoProyecto}
                                </span>
                              )}
                              {candInfo && (
                                <span
                                  className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  title={candInfo.explicacion}
                                >
                                  Match {candInfo.score}%
                                </span>
                              )}
                              {isStaged && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">
                                  En Staging Cart
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                              Cuota #{c?.numeroCuota} • {c?.opportunityName}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                              <span>Fecha SF: {c?.fechaPago}</span>
                              <span>•</span>
                              <span>Etapa: {c?.etapa}</span>
                              {(c?.comercialResponsable || c?.unidad) && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-0.5 text-slate-600 font-medium">
                                    <UserCheck className="w-3 h-3" />
                                    {c?.comercialResponsable || c?.unidad}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-bold text-slate-900 tabular-nums">
                            {formatClp(g.totalSfClp)}
                          </div>
                          <div className="text-[10px] text-slate-500 tabular-nums">
                            {g.totalSfUf} UF
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Parte Inferior Derecha: Buscador/Selector de Oportunidades Padre para CREATE_CUOTA */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-indigo-600" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    2B. Crear Cuota en Oportunidad Padre ({filteredOpportunities.length})
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Regla estricta: Toda nueva cuota requiere seleccionar una Oportunidad padre válida
                  </p>
                </div>
              </div>
              <div className="relative w-full sm:w-52">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchOpp}
                  onChange={(e) => setSearchOpp(e.target.value)}
                  placeholder="Buscar Oportunidad..."
                  className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white text-slate-800"
                />
              </div>
            </div>

            <div className="p-3.5 space-y-3">
              {selectedEerrGroups.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>
                    Selecciona primero una o más facturas EERR huérfanas en el panel izquierdo para habilitar la creación de cuota en una Oportunidad de ese cliente.
                  </span>
                </div>
              ) : (
                <>
                  <div className="max-h-[190px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                    {filteredOpportunities.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No se encontraron oportunidades para este RUT. Desmarca &ldquo;Auto-filtrar por RUT&rdquo; arriba si deseas buscar en todo el catálogo.
                      </div>
                    ) : (
                      filteredOpportunities.map((opp) => {
                        const isSelected = selectedOpportunityId === opp.opportunityId;
                        return (
                          <div
                            key={opp.opportunityId}
                            onClick={() => setSelectedOpportunityId(opp.opportunityId)}
                            className={`p-2.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-50/90 border-l-4 border-l-indigo-600'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-900 truncate">
                                  {opp.opportunityName}
                                </span>
                                {opp.codigoExtraido && (
                                  <span className="px-1.5 py-0.2 text-[10px] font-mono font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    {opp.codigoExtraido}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                {opp.cuenta} ({opp.rutEmpresa}) • Etapa: {opp.etapa} • ID:{' '}
                                <span className="font-mono">{opp.opportunityId}</span>
                              </div>
                            </div>
                            <input
                              type="radio"
                              name="selectedOpportunity"
                              checked={isSelected}
                              onChange={() => setSelectedOpportunityId(opp.opportunityId)}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-slate-600">
                      Monto nueva cuota:{' '}
                      <strong className="text-slate-900">
                        {formatClp(sumSelectedEerrClp)}
                      </strong>{' '}
                      ({selectedEerrGroups.length} factura(s) EERR)
                    </div>
                    <button
                      type="button"
                      disabled={!selectedOpportunityId || selectedEerrGroups.length === 0}
                      onClick={handleCreateCuotaInOpportunity}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-xs font-bold text-white shadow-xs transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Encolar Nueva Cuota en Oportunidad
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

