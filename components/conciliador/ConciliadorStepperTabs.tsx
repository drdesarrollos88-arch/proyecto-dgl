'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Scissors,
  ChevronDown,
  ChevronRight,
  Search,
  CheckSquare,
  Square,
  ArrowRight,
  Layers,
  ShieldCheck,
  Sparkles,
  ArrowLeftRight,
} from 'lucide-react';
import {
  ConciliacionGroup,
  OportunidadClienteRef,
  StagingAction,
  WorkflowStage,
} from '@/lib/conciliador-types';
import { formatClp } from './ConciliadorHeaderBalance';
import TabMesaCirugiaSplit from './TabMesaCirugiaSplit';

const MESES_CORTOS = [
  '',
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

interface AiBatchSuggestion {
  eerrId: string;
  cuotaId: string;
  confianza: number;
  justificacion: string;
}

interface ConciliadorStepperTabsProps {
  activeStage: WorkflowStage;
  onChangeStage: (stage: WorkflowStage) => void;
  groups: ConciliacionGroup[];
  oportunidadesClientes: OportunidadClienteRef[];
  mesActual: number;
  anioActual: number;
  incluirTraspasosInternos: boolean;
  stagedActions: StagingAction[];
  aiLoading: boolean;
  aiSuggestions: AiBatchSuggestion[];
  onStageActions: (actions: StagingAction[]) => void;
  onManualLinkGroups: (
    eerrGroupIds: string[],
    sfGroupIds: string[],
    autoAdjustMonto: boolean
  ) => void;
  onRunAiBatch: () => void;
}

export default function ConciliadorStepperTabs({
  activeStage,
  onChangeStage,
  groups,
  oportunidadesClientes,
  mesActual,
  anioActual,
  incluirTraspasosInternos,
  stagedActions,
  aiLoading,
  aiSuggestions,
  onStageActions,
  onManualLinkGroups,
  onRunAiBatch,
}: ConciliadorStepperTabsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([]);
  const [selectedDiffGroupIds, setSelectedDiffGroupIds] = useState<string[]>([]);
  const [selectedDesfaseGroupIds, setSelectedDesfaseGroupIds] = useState<string[]>([]);

  // Clasificar grupos por stage
  const stageGroups = useMemo(() => {
    const map: Record<WorkflowStage, ConciliacionGroup[]> = {
      CUADRADOS: [],
      DIFERENCIA_MONTO: [],
      DESFASE_TEMPORAL: [],
      MESA_CIRUGIA: [],
      TRASPASO_INTERNO: [],
      ANULADO_NC: [],
    };
    for (const g of groups) {
      map[g.stage]?.push(g);
    }
    return map;
  }, [groups]);

  // Cuotas que ya tienen una acción en el StagingCart
  const stagedCuotaIds = useMemo(() => {
    const set = new Set<string>();
    for (const a of stagedActions) {
      if (a.type === 'UPDATE_MONTO' || a.type === 'UPDATE_FECHA') {
        set.add(a.cuotaId);
      }
    }
    return set;
  }, [stagedActions]);

  // Filtrar grupos de la pestaña activa por buscador
  const currentTabGroups = useMemo(() => {
    const list = stageGroups[activeStage] || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) =>
        g.cliente.toLowerCase().includes(q) ||
        g.rut.toLowerCase().includes(q) ||
        (g.codigoProyecto || '').toLowerCase().includes(q) ||
        g.eerrItems.some(
          (e) =>
            e.glosa.toLowerCase().includes(q) ||
            e.referenciaExterna.toLowerCase().includes(q)
        ) ||
        g.sfItems.some((c) => c.opportunityName.toLowerCase().includes(q))
    );
  }, [stageGroups, activeStage, searchQuery]);

  const toggleExpand = (groupId: string) => {
    setExpandedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  // Acción masiva Tab 2: Ajustar seleccionados en SF al monto real EERR
  const handleBulkAdjustMonto = (targetGroups: ConciliacionGroup[]) => {
    const actions: StagingAction[] = [];
    for (const g of targetGroups) {
      if (g.sfItems.length === 0) continue;
      if (g.sfItems.length === 1) {
        const c = g.sfItems[0];
        actions.push({
          id: `upd-monto-${c.id}-${Date.now()}`,
          type: 'UPDATE_MONTO',
          groupId: g.id,
          cuotaId: c.id,
          opportunityId: c.opportunityId,
          opportunityName: c.opportunityName,
          cliente: g.cliente,
          rut: g.rut,
          montoAnterior: c.montoClp,
          montoNuevo: g.totalEerrClp,
          motivo: `Ajuste a facturación real EERR (${
            Math.abs(g.deltaPct) <= 4 ? 'Variación UF' : 'Diferencia monto facturado'
          })`,
        });
      } else {
        // Si hay M cuotas en el grupo (ej. 1:N o N:M), ajustamos la última cuota por el delta del grupo
        const lastCuota = g.sfItems[g.sfItems.length - 1];
        const nuevoMontoUltima = Math.max(0, lastCuota.montoClp + g.deltaClp);
        actions.push({
          id: `upd-monto-${lastCuota.id}-${Date.now()}`,
          type: 'UPDATE_MONTO',
          groupId: g.id,
          cuotaId: lastCuota.id,
          opportunityId: lastCuota.opportunityId,
          opportunityName: lastCuota.opportunityName,
          cliente: g.cliente,
          rut: g.rut,
          montoAnterior: lastCuota.montoClp,
          montoNuevo: nuevoMontoUltima,
          motivo: `Ajuste de saldo grupal (${g.cardinalidad}) a facturación real EERR`,
        });
      }
    }
    if (actions.length > 0) {
      onStageActions(actions);
      setSelectedDiffGroupIds([]);
    }
  };

  // Acción masiva Tab 3: Traer cuotas seleccionadas al mes actual
  const handleBulkMoveToCurrentMonth = (targetGroups: ConciliacionGroup[]) => {
    const actions: StagingAction[] = [];
    const defaultFechaMesActual = `${anioActual}-${String(mesActual).padStart(
      2,
      '0'
    )}-15`;

    for (const g of targetGroups) {
      const refEerrFecha = g.eerrItems[0]?.fecha || defaultFechaMesActual;
      for (const c of g.sfItems) {
        if (c.mes === mesActual && c.anio === anioActual) continue;
        actions.push({
          id: `upd-fecha-${c.id}-${Date.now()}`,
          type: 'UPDATE_FECHA',
          groupId: g.id,
          cuotaId: c.id,
          opportunityId: c.opportunityId,
          opportunityName: c.opportunityName,
          cliente: g.cliente,
          rut: g.rut,
          montoClp: c.montoClp,
          fechaAnterior: c.fechaPago,
          fechaNueva: refEerrFecha,
          motivo: `Sincronización al mes real de facturación EERR (${MESES_CORTOS[mesActual]} ${anioActual})`,
        });
      }
    }
    if (actions.length > 0) {
      onStageActions(actions);
      setSelectedDesfaseGroupIds([]);
    }
  };

  const tabs: {
    id: WorkflowStage;
    step: string;
    title: string;
    subtitle: string;
    count: number;
    icon: React.ReactNode;
    badgeColor: string;
  }[] = [
    {
      id: 'CUADRADOS',
      step: 'Paso 1',
      title: 'Cuadrados Automáticos',
      subtitle: '1:1, Grupales y Subset-Sum (Δ ≤ $2.000)',
      count: stageGroups.CUADRADOS.length,
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    {
      id: 'DIFERENCIA_MONTO',
      step: 'Paso 2',
      title: 'Diferencias de Monto / UF',
      subtitle: 'Ajuste en 1 clic al monto real EERR',
      count: stageGroups.DIFERENCIA_MONTO.length,
      icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    {
      id: 'DESFASE_TEMPORAL',
      step: 'Paso 3',
      title: 'Desfases de Período',
      subtitle: 'Cuotas en M-1 / M+1 facturadas este mes',
      count: stageGroups.DESFASE_TEMPORAL.length,
      icon: <CalendarClock className="w-4 h-4 text-orange-600" />,
      badgeColor: 'bg-orange-100 text-orange-800 border-orange-200',
    },
    {
      id: 'MESA_CIRUGIA',
      step: 'Paso 4',
      title: 'Mesa de Cirugía (50/50)',
      subtitle: 'Huérfanos EERR y Cuotas SF No Facturadas',
      count: stageGroups.MESA_CIRUGIA.length,
      icon: <Scissors className="w-4 h-4 text-blue-600" />,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    },
  ];

  if (incluirTraspasosInternos) {
    tabs.push({
      id: 'TRASPASO_INTERNO',
      step: 'Anexo TI',
      title: 'Traspasos Internos (TI)',
      subtitle: 'Operaciones inter-división IDIEM',
      count: stageGroups.TRASPASO_INTERNO.length,
      icon: <ArrowLeftRight className="w-4 h-4 text-purple-600" />,
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    });
  }

  return (
    <div className="space-y-4">
      {/* Navegación Stepper Inbox Zero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {tabs.map((tab) => {
          const isActive = activeStage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChangeStage(tab.id)}
              className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isActive
                  ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {tab.icon}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {tab.step}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs font-bold rounded-full border ${tab.badgeColor}`}
                >
                  {tab.count}
                </span>
              </div>
              <div className="mt-2">
                <div className="text-xs sm:text-sm font-bold text-slate-900">
                  {tab.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                  {tab.subtitle}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Contenido de la Pestaña 4: Mesa de Cirugía Split 50/50 */}
      {activeStage === 'MESA_CIRUGIA' ? (
        <TabMesaCirugiaSplit
          orphanGroups={stageGroups.MESA_CIRUGIA}
          oportunidadesClientes={oportunidadesClientes}
          mesActual={mesActual}
          anioActual={anioActual}
          aiLoading={aiLoading}
          aiSuggestions={aiSuggestions}
          stagedActions={stagedActions}
          onRunAiBatch={onRunAiBatch}
          onManualLinkGroups={onManualLinkGroups}
          onStageActions={onStageActions}
        />
      ) : (
        /* Contenido de las Pestañas 1, 2, 3 y Anexo TI */
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header de la tabla y barra de acciones masivas */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {activeStage === 'CUADRADOS' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Grupos Pre-Aprobados ({currentTabGroups.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Cruces exactos 1:1, agrupaciones por código núcleo y resoluciones Subset-Sum dentro de tolerancia (≤ $2.000 CLP)
                  </p>
                </div>
              )}

              {activeStage === 'DIFERENCIA_MONTO' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Diferencias de Monto / Variación UF ({currentTabGroups.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Mismo proyecto y período, pero el monto facturado EERR difiere del proyectado en Salesforce
                  </p>
                </div>
              )}

              {activeStage === 'DESFASE_TEMPORAL' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-orange-600" />
                    Desfases de Período M-1 / M+1 ({currentTabGroups.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Facturas emitidas en el mes actual cuya cuota en Salesforce estaba planificada en otro mes
                  </p>
                </div>
              )}

              {activeStage === 'TRASPASO_INTERNO' && (
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-purple-600" />
                    Traspasos Internos Aislados ({currentTabGroups.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Comprobantes TI e ingresos internos entre unidades IDIEM/UChile separados de la venta externa
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Botón de acción masiva en Tab 2 (Diferencia de Monto) */}
              {activeStage === 'DIFERENCIA_MONTO' && currentTabGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const targets =
                      selectedDiffGroupIds.length > 0
                        ? currentTabGroups.filter((g) =>
                            selectedDiffGroupIds.includes(g.id)
                          )
                        : currentTabGroups;
                    handleBulkAdjustMonto(targets);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {selectedDiffGroupIds.length > 0
                    ? `Ajustar seleccionados (${selectedDiffGroupIds.length}) en SF al monto real EERR`
                    : `Ajustar todos (${currentTabGroups.length}) en SF al monto real EERR`}
                </button>
              )}

              {/* Botón de acción masiva en Tab 3 (Desfase Temporal) */}
              {activeStage === 'DESFASE_TEMPORAL' && currentTabGroups.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const targets =
                      selectedDesfaseGroupIds.length > 0
                        ? currentTabGroups.filter((g) =>
                            selectedDesfaseGroupIds.includes(g.id)
                          )
                        : currentTabGroups;
                    handleBulkMoveToCurrentMonth(targets);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <CalendarClock className="w-3.5 h-3.5" />
                  {selectedDesfaseGroupIds.length > 0
                    ? `Traer cuotas seleccionadas (${selectedDesfaseGroupIds.length}) al mes actual`
                    : `Traer todas las cuotas (${currentTabGroups.length}) al mes actual`}
                </button>
              )}

              {/* Buscador */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar por cliente, RUT o código..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Tabla de 6 columnas con soporte para expansión N:M */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3 w-10">
                    {activeStage === 'DIFERENCIA_MONTO' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedDiffGroupIds.length === currentTabGroups.length) {
                            setSelectedDiffGroupIds([]);
                          } else {
                            setSelectedDiffGroupIds(currentTabGroups.map((g) => g.id));
                          }
                        }}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        {selectedDiffGroupIds.length > 0 &&
                        selectedDiffGroupIds.length === currentTabGroups.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    {activeStage === 'DESFASE_TEMPORAL' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            selectedDesfaseGroupIds.length === currentTabGroups.length
                          ) {
                            setSelectedDesfaseGroupIds([]);
                          } else {
                            setSelectedDesfaseGroupIds(
                              currentTabGroups.map((g) => g.id)
                            );
                          }
                        }}
                        className="text-slate-500 hover:text-slate-800"
                      >
                        {selectedDesfaseGroupIds.length > 0 &&
                        selectedDesfaseGroupIds.length === currentTabGroups.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </th>
                  <th className="py-2.5 px-3">Cliente / RUT</th>
                  <th className="py-2.5 px-3">Proyecto / Cardinalidad</th>
                  <th className="py-2.5 px-3 text-right">
                    {activeStage === 'DESFASE_TEMPORAL'
                      ? 'Período SF → Período EERR'
                      : 'Monto SF → Monto EERR'}
                  </th>
                  <th className="py-2.5 px-3 text-right">Diferencia (Δ $ y %)</th>
                  <th className="py-2.5 px-3 text-right">Score / Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {currentTabGroups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-slate-500 text-xs"
                    >
                      No hay registros en esta etapa con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  currentTabGroups.map((g) => {
                    const isExpanded = expandedGroupIds.includes(g.id);
                    const isDiffSelected = selectedDiffGroupIds.includes(g.id);
                    const isDesfaseSelected = selectedDesfaseGroupIds.includes(g.id);
                    const hasStagedChange = g.sfItems.some((c) =>
                      stagedCuotaIds.has(c.id)
                    );
                    const firstSf = g.sfItems[0];
                    const firstEerr = g.eerrItems[0];

                    return (
                      <React.Fragment key={g.id}>
                        <tr className="hover:bg-slate-50/80 transition-colors">
                          {/* Col 1: Checkbox + Expand */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5">
                              {activeStage === 'DIFERENCIA_MONTO' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedDiffGroupIds((prev) =>
                                      prev.includes(g.id)
                                        ? prev.filter((x) => x !== g.id)
                                        : [...prev, g.id]
                                    )
                                  }
                                >
                                  {isDiffSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                              )}
                              {activeStage === 'DESFASE_TEMPORAL' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedDesfaseGroupIds((prev) =>
                                      prev.includes(g.id)
                                        ? prev.filter((x) => x !== g.id)
                                        : [...prev, g.id]
                                    )
                                  }
                                >
                                  {isDesfaseSelected ? (
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleExpand(g.id)}
                                className="p-1 rounded hover:bg-slate-200/60 text-slate-500"
                                title="Ver detalle N:M y ScoreBreakdown"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* Col 2: Cliente / RUT */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{g.cliente}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] text-slate-500">
                                {g.rut}
                              </span>
                              {g.esCuentaComercial && (
                                <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Corporativo
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Proyecto / Cardinalidad N:M */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {g.codigoProyecto ? (
                                <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-blue-50 text-blue-700 border border-blue-200">
                                  {g.codigoProyecto}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  Sin código explícito
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-700 border border-slate-200">
                                <Layers className="w-3 h-3 text-slate-500" />
                                {g.cardinalidad} ({g.eerrItems.length} EERR :{' '}
                                {g.sfItems.length} SF)
                              </span>
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 text-slate-600">
                                {g.scoreBreakdown.matchType}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 truncate max-w-md">
                              {firstSf?.opportunityName ||
                                firstEerr?.glosa ||
                                firstEerr?.referenciaInterna}
                            </p>
                          </td>

                          {/* Col 4: Monto SF -> Monto EERR (o Período SF -> Período EERR) */}
                          <td className="py-3 px-3 text-right">
                            {activeStage === 'DESFASE_TEMPORAL' ? (
                              <div className="space-y-0.5">
                                <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                                  <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200">
                                    SF:{' '}
                                    {firstSf
                                      ? `${MESES_CORTOS[firstSf.mes]} ${firstSf.anio}`
                                      : 'N/A'}
                                  </span>
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    EERR:{' '}
                                    {firstEerr
                                      ? `${MESES_CORTOS[firstEerr.mes]} ${firstEerr.anio}`
                                      : 'N/A'}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 tabular-nums">
                                  {formatClp(g.totalSfClp)} → {formatClp(g.totalEerrClp)}
                                </div>
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-end gap-1.5 tabular-nums">
                                <span className="text-slate-500 font-medium">
                                  {formatClp(g.totalSfClp)}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-bold text-slate-900">
                                  {formatClp(g.totalEerrClp)}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* Col 5: Delta $ y % */}
                          <td className="py-3 px-3 text-right tabular-nums">
                            <div
                              className={`font-bold ${
                                Math.abs(g.deltaClp) <= 2000
                                  ? 'text-emerald-600'
                                  : g.deltaClp > 0
                                  ? 'text-amber-600'
                                  : 'text-rose-600'
                              }`}
                            >
                              {g.deltaClp > 0
                                ? `+${formatClp(g.deltaClp)}`
                                : formatClp(g.deltaClp)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {g.deltaPct > 0 ? `+${g.deltaPct}%` : `${g.deltaPct}%`} (
                              {g.deltaUf > 0 ? `+${g.deltaUf}` : g.deltaUf} UF)
                            </div>
                          </td>

                          {/* Col 6: Score y Acción Individual */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                  g.scoreBreakdown.totalScore >= 85
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}
                                title={g.scoreBreakdown.explicacion}
                              >
                                {g.scoreBreakdown.totalScore} pts
                              </span>

                              {hasStagedChange ? (
                                <span className="px-2 py-1 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  En Staging Cart
                                </span>
                              ) : (
                                <>
                                  {activeStage === 'DIFERENCIA_MONTO' && (
                                    <button
                                      type="button"
                                      onClick={() => handleBulkAdjustMonto([g])}
                                      className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-semibold transition-colors cursor-pointer"
                                    >
                                      Ajustar SF
                                    </button>
                                  )}
                                  {activeStage === 'DESFASE_TEMPORAL' && (
                                    <button
                                      type="button"
                                      onClick={() => handleBulkMoveToCurrentMonth([g])}
                                      className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-200 text-[11px] font-semibold transition-colors cursor-pointer"
                                    >
                                      Traer a Mes Actual
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Fila Expandible: Detalle N:M de Facturas EERR vs Cuotas SF + ScoreBreakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={6} className="p-4">
                              <div className="space-y-3">
                                {/* Explicación del Score Multicriterio */}
                                <div className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                                  <div className="text-slate-700">
                                    <strong className="text-slate-900">
                                      Explicabilidad del Motor v2.0:
                                    </strong>{' '}
                                    {g.scoreBreakdown.explicacion}
                                  </div>
                                  <div className="flex items-center gap-2 font-mono text-[10px]">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      Código: {g.scoreBreakdown.codigoScore}/45
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      Monto: {g.scoreBreakdown.montoScore}/25
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      Texto: {g.scoreBreakdown.textoScore}/15
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      Tiempo: {g.scoreBreakdown.tiempoScore}/10
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                      Sección: {g.scoreBreakdown.seccionScore}/5
                                    </span>
                                  </div>
                                </div>

                                {/* Sub-tablas lado a lado: Facturas EERR (N) vs Cuotas SF (M) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                                      Facturas EERR en el Grupo ({g.eerrItems.length})
                                    </div>
                                    {g.eerrItems.map((e) => (
                                      <div
                                        key={e.id}
                                        className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-[11px]"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-800 truncate">
                                            Doc #{e.referenciaExterna || e.comprobante} •{' '}
                                            {e.fecha}
                                          </div>
                                          <div className="text-slate-500 truncate">
                                            {e.glosa || e.referenciaInterna}
                                          </div>
                                        </div>
                                        <div className="font-bold text-slate-900 tabular-nums shrink-0">
                                          {formatClp(e.montoClp)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                                      Cuotas Salesforce en el Grupo ({g.sfItems.length})
                                    </div>
                                    {g.sfItems.map((c) => (
                                      <div
                                        key={c.id}
                                        className="p-2 rounded bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-[11px]"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-800 truncate">
                                            Cuota #{c.numeroCuota} • {c.fechaPago} ({c.etapa})
                                          </div>
                                          <div className="text-slate-500 truncate">
                                            {c.opportunityName}
                                          </div>
                                        </div>
                                        <div className="font-bold text-slate-900 tabular-nums shrink-0">
                                          {formatClp(c.montoClp)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

