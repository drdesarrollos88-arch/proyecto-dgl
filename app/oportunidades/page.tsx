'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  KpisOportunidades,
  MetaComercialPeriodo,
  OportunidadCRM,
} from '@/lib/oportunidades-types';
import {
  Trophy,
  TrendingUp,
  Target,
  RefreshCw,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Briefcase,
  Layers,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Settings,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  X,
  FileSpreadsheet,
} from 'lucide-react';

const MESES = [
  { value: 0, label: 'Todo el Año (Acumulado YTD)' },
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const DIVISIONES = ['DGL', 'DCH', 'DSCA', 'DIE', 'DIPC', 'DIM', 'TODAS'];

function formatClp(val: number): string {
  const abs = Math.abs(Math.round(val));
  const formatted = abs.toLocaleString('es-CL');
  return val < 0 ? `-$${formatted}` : `$${formatted}`;
}

export default function OportunidadesPage() {
  const [selectedAnio, setSelectedAnio] = useState<number>(2026);
  const [selectedMes, setSelectedMes] = useState<number>(0); // 0 = Acumulado YTD
  const [selectedDivision, setSelectedDivision] = useState<string>('DGL');
  const [sourceFilter, setSourceFilter] = useState<'TODOS' | 'WEB_DGL' | 'SALESFORCE'>('TODOS');
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | 'ganada' | 'perdida' | 'en_curso'>('TODOS');
  const [search, setSearch] = useState<string>('');

  const [items, setItems] = useState<OportunidadCRM[]>([]);
  const [kpis, setKpis] = useState<KpisOportunidades | null>(null);
  const [metas, setMetas] = useState<MetaComercialPeriodo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingSf, setSyncingSf] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Modal de edición de metas comerciales
  const [showMetasModal, setShowMetasModal] = useState<boolean>(false);
  const [editingMetas, setEditingMetas] = useState<MetaComercialPeriodo[]>([]);
  const [savingMetas, setSavingMetas] = useState<boolean>(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setSyncSuccessMsg(null);
    try {
      const q = new URLSearchParams({
        anio: String(selectedAnio),
        mes: String(selectedMes),
        division: selectedDivision,
        source: sourceFilter,
        estado: estadoFilter,
        search,
      });

      const res = await fetch(`/api/oportunidades?${q.toString()}`);
      if (!res.ok) throw new Error('Error al consultar oportunidades');
      const data = await res.json();
      setItems(data.items || []);
      setKpis(data.kpis || null);
      setMetas(data.metas || []);
    } catch (err) {
      console.error('Error cargando oportunidades:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAnio, selectedMes, selectedDivision, sourceFilter, estadoFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronizar Oportunidades de Salesforce en vivo
  const handleSyncSalesforce = async () => {
    setSyncingSf(true);
    setSyncSuccessMsg(null);
    try {
      const res = await fetch('/api/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_salesforce',
          anio: selectedAnio,
          division: selectedDivision,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar con Salesforce');
      setSyncSuccessMsg(data.message || 'Sincronización completada.');
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Error conectando con Salesforce');
    } finally {
      setSyncingSf(false);
    }
  };

  // Abrir modal de metas
  const handleOpenMetasModal = () => {
    setEditingMetas(JSON.parse(JSON.stringify(metas)));
    setShowMetasModal(true);
  };

  // Guardar metas modificadas
  const handleSaveMetas = async () => {
    setSavingMetas(true);
    try {
      const res = await fetch('/api/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_metas',
          metas: editingMetas,
        }),
      });
      if (!res.ok) throw new Error('Error al guardar metas');
      setShowMetasModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Error guardando metas');
    } finally {
      setSavingMetas(false);
    }
  };

  // Exportar a CSV compatible con Excel
  const handleExportCsv = () => {
    const headers = [
      'Origen',
      'Codigo',
      'Oportunidad',
      'Cliente',
      'RUT',
      'Comercial',
      'Fecha_Cierre',
      'Mes',
      'Anio',
      'Etapa',
      'Estado',
      'Monto_CLP',
      'Monto_UF',
      'Cuotas',
    ];

    const rows = items.map((o) => [
      o.source,
      o.codigo,
      o.nombre,
      o.cliente,
      o.rut,
      o.comercial,
      o.fechaCierre,
      String(o.mes),
      String(o.anio),
      o.etapa,
      o.estado,
      String(o.montoClp),
      String(o.montoUf),
      String(o.cuotasCount),
    ]);

    const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' +
      [headers.map(escapeCsv).join(';'), ...rows.map((r) => r.map(escapeCsv).join(';'))].join(
        '\r\n'
      );

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Oportunidades_${selectedDivision}_${selectedAnio}_${
      selectedMes === 0 ? 'YTD' : `M${selectedMes}`
    }.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Barra Superior de Control y Contexto */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Oportunidades & Pipeline Comercial
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  CRM Unificado
                </span>
                {syncSuccessMsg && (
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {syncSuccessMsg}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Historial completo de cotizaciones del portal y ventas de Salesforce con comparativa de objetivos comerciales
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Selector División */}
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                {DIVISIONES.map((d) => (
                  <option key={d} value={d}>
                    {d === 'TODAS' ? 'Todas las Divisiones' : `División ${d}`}
                  </option>
                ))}
              </select>

              {/* Selector Año */}
              <select
                value={selectedAnio}
                onChange={(e) => setSelectedAnio(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    Año {y}
                  </option>
                ))}
              </select>

              {/* Selector Período */}
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              {/* Botón Sincronizar Salesforce */}
              <button
                type="button"
                onClick={handleSyncSalesforce}
                disabled={syncingSf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-800 transition-colors cursor-pointer"
                title="Consultar e importar oportunidades desde Salesforce vía SOQL"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingSf ? 'animate-spin text-blue-600' : ''}`} />
                {syncingSf ? 'Sincronizando...' : 'Importar Salesforce'}
              </button>

              {/* Botón Metas Comerciales */}
              <button
                type="button"
                onClick={handleOpenMetasModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <Target className="w-3.5 h-3.5 text-amber-600" />
                Metas & Objetivos
              </button>

              {/* Botón Exportar CSV */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
                title="Exportar listado a Excel / CSV"
              >
                <Download className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          </div>
        </div>

        {/* Bloque 1: Tarjetas Ejecutivas de KPIs vs Metas */}
        {kpis && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Ventas Ganadas vs Meta */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-emerald-600" />
                  Ventas Ganadas / Cerradas
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    kpis.cumplimientoVentaPct >= 100
                      ? 'bg-emerald-100 text-emerald-800'
                      : kpis.cumplimientoVentaPct >= 70
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {kpis.cumplimientoVentaPct}% Cumplimiento
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                  {formatClp(kpis.montoGanadoClp)}
                </span>
                <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                  {kpis.montoGanadoUf} UF
                </span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all"
                    style={{ width: `${Math.min(100, kpis.cumplimientoVentaPct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Meta: {formatClp(kpis.metaVentaClp)}</span>
                  <span className={kpis.gapVentaClp >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600'}>
                    Gap: {kpis.gapVentaClp >= 0 ? `+${formatClp(kpis.gapVentaClp)}` : formatClp(kpis.gapVentaClp)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Pipeline en Curso (En Negociación) */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Pipeline en Curso
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {kpis.conteoEnCurso} oportunidades
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                  {formatClp(kpis.montoEnCursoClp)}
                </span>
                <span className="text-xs font-semibold text-blue-700 tabular-nums">
                  {kpis.montoEnCursoUf} UF
                </span>
              </div>
              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Propuestas vivas en negociación</span>
                <span className="font-semibold text-slate-700">Probabilidad activa</span>
              </div>
            </div>

            {/* Card 3: Total Cotizado vs Meta */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-amber-600" />
                  Volumen Cotizado Total
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  {kpis.cumplimientoCotizacionPct}% de Meta
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                  {formatClp(kpis.montoCotizadoTotalClp)}
                </span>
                <span className="text-xs font-semibold text-amber-700 tabular-nums">
                  {kpis.montoCotizadoTotalUf} UF
                </span>
              </div>
              <div className="space-y-1 pt-1">
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, kpis.cumplimientoCotizacionPct)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Meta: {formatClp(kpis.metaCotizacionClp)}</span>
                  <span>{kpis.totalOportunidades} cotizaciones</span>
                </div>
              </div>
            </div>

            {/* Card 4: Tasa de Cierre y Ticket Promedio */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                  Efectividad de Cierre
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {kpis.tasaCierrePct}% Conversión
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                  {formatClp(kpis.ticketPromedioClp)}
                </span>
                <span className="text-xs font-semibold text-indigo-700 tabular-nums">
                  {kpis.ticketPromedioUf} UF ticket
                </span>
              </div>
              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                <span>
                  {kpis.conteoGanadas} ganadas / {kpis.conteoPerdidas} perdidas
                </span>
                <span className="font-semibold text-slate-700">Ticket promedio</span>
              </div>
            </div>
          </div>
        )}

        {/* Bloque 2: Gráficos de Evolución Mensual y Ranking de Comerciales */}
        {kpis && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Evolución Mensual Real vs Meta (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Evolución Mensual: Ventas Reales vs Meta Presupuestada ({selectedAnio})
                </h3>
                <span className="text-[11px] text-slate-500">Montos en Millones CLP</span>
              </div>

              <div className="grid grid-cols-12 gap-1.5 pt-4 items-end h-44 border-b border-slate-100 pb-2">
                {kpis.evolucionMeses.map((m) => {
                  const maxVal = Math.max(
                    ...kpis.evolucionMeses.map((x) => Math.max(x.ganadoClp, x.metaVentaClp)),
                    1
                  );
                  const hReal = Math.min(100, Math.round((m.ganadoClp / maxVal) * 100));
                  const hMeta = Math.min(100, Math.round((m.metaVentaClp / maxVal) * 100));
                  const isCurrentMonth = m.mes === selectedMes;

                  return (
                    <div
                      key={m.mes}
                      onClick={() => setSelectedMes(m.mes === selectedMes ? 0 : m.mes)}
                      className={`flex flex-col items-center justify-end h-full cursor-pointer group p-0.5 rounded transition-colors ${
                        isCurrentMonth ? 'bg-blue-50/80 ring-1 ring-blue-500' : 'hover:bg-slate-50'
                      }`}
                      title={`${m.nombreMes}: Real ${formatClp(m.ganadoClp)} | Meta ${formatClp(
                        m.metaVentaClp
                      )} (${m.cumplimientoPct}%)`}
                    >
                      <div className="w-full flex items-end justify-center gap-1 h-32">
                        {/* Barra Real */}
                        <div
                          className={`w-2.5 sm:w-3.5 rounded-t transition-all ${
                            m.cumplimientoPct >= 100 ? 'bg-emerald-600' : 'bg-blue-600'
                          }`}
                          style={{ height: `${Math.max(4, hReal)}%` }}
                        />
                        {/* Barra Meta (sombra) */}
                        <div
                          className="w-1.5 sm:w-2 bg-slate-200 rounded-t"
                          style={{ height: `${Math.max(4, hMeta)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-600 mt-2 truncate">
                        {m.nombreMes}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-center gap-5 text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-blue-600" />
                  <span>Venta Real Ganada</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Meta Superada (≥ 100%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded bg-slate-200" />
                  <span>Meta Presupuestada</span>
                </div>
              </div>
            </div>

            {/* Ranking de Comerciales / Sección (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  Aporte por Asesor Comercial ({kpis.porComercial.length})
                </h3>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {kpis.porComercial.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No hay datos de comerciales para este período.
                  </div>
                ) : (
                  kpis.porComercial.map((c, idx) => (
                    <div
                      key={c.comercial}
                      className="py-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                          <span>{c.comercial}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {c.ganadasCount} ganadas • {c.enCursoCount} en curso ({c.totalOpps} total)
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900 tabular-nums">
                          {formatClp(c.montoGanadoClp)}
                        </div>
                        <div className="text-[10px] text-emerald-700 font-medium tabular-nums">
                          {c.montoGanadoUf} UF
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bloque 3: Explorador y Tabla Maestra de Oportunidades */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Barra de Filtros */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Pestañas de Estado */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
              {(
                [
                  { id: 'TODOS', label: 'Todas' },
                  { id: 'ganada', label: 'Ganadas' },
                  { id: 'en_curso', label: 'En Curso' },
                  { id: 'perdida', label: 'Perdidas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEstadoFilter(tab.id)}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    estadoFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Filtro Origen: Todos | Web DGL | Salesforce */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs">
                {(
                  [
                    { id: 'TODOS', label: 'Todas' },
                    { id: 'WEB_DGL', label: 'Portal DGL' },
                    { id: 'SALESFORCE', label: 'Salesforce' },
                  ] as const
                ).map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => setSourceFilter(src.id)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all cursor-pointer ${
                      sourceFilter === src.id
                        ? 'bg-white text-slate-900 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {src.label}
                  </button>
                ))}
              </div>

              {/* Buscador de Oportunidades */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar cliente, código, proyecto..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Tabla de Oportunidades */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3">Origen / Código</th>
                  <th className="py-2.5 px-3">Oportunidad / Proyecto</th>
                  <th className="py-2.5 px-3">Cliente / RUT</th>
                  <th className="py-2.5 px-3">Comercial / Cierre</th>
                  <th className="py-2.5 px-3">Etapa</th>
                  <th className="py-2.5 px-3 text-right">Monto CLP / UF</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                      {loading
                        ? 'Cargando oportunidades...'
                        : 'No se encontraron oportunidades con los filtros seleccionados. Puedes hacer clic en "Importar Salesforce" para cargar el historial de ese año.'}
                    </td>
                  </tr>
                ) : (
                  items.map((o) => {
                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Col 1: Origen + Código */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {o.source === 'WEB_DGL' ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                                Web DGL
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-100 text-purple-800 border border-purple-200">
                                Salesforce
                              </span>
                            )}
                            <span className="font-mono font-bold text-slate-900 text-[11px]">
                              {o.codigo}
                            </span>
                          </div>
                        </td>

                        {/* Col 2: Nombre de Oportunidad */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900 max-w-sm truncate" title={o.nombre}>
                            {o.nombre}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>Cuotas: {o.cuotasCount}</span>
                            {o.codigoNucleo && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-blue-600">Núcleo: {o.codigoNucleo}</span>
                              </>
                            )}
                          </div>
                        </td>

                        {/* Col 3: Cliente / RUT */}
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-800 max-w-xs truncate" title={o.cliente}>
                            {o.cliente}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500">{o.rut || 'Sin RUT'}</div>
                        </td>

                        {/* Col 4: Comercial / Fecha Cierre */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-slate-800 truncate max-w-[150px]">
                            {o.comercial}
                          </div>
                          <div className="text-[11px] text-slate-500">Cierre: {o.fechaCierre}</div>
                        </td>

                        {/* Col 5: Etapa */}
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              o.estado === 'ganada'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.estado === 'perdida'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {o.estado === 'ganada' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : o.estado === 'perdida' ? (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-600" />
                            )}
                            {o.etapa}
                          </span>
                        </td>

                        {/* Col 6: Monto CLP & UF */}
                        <td className="py-3 px-3 text-right tabular-nums">
                          <div className="font-bold text-slate-900">{formatClp(o.montoClp)}</div>
                          <div className="text-[11px] text-slate-500">{o.montoUf} UF</div>
                        </td>

                        {/* Col 7: Acciones */}
                        <td className="py-3 px-3 text-right">
                          {o.source === 'WEB_DGL' && o.cotizacionDglId ? (
                            <Link
                              href={`/cotizador?id=${o.cotizacionDglId}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold transition-colors"
                            >
                              <span>Ver Cotización</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              SF: {o.salesforceId?.slice(0, 10)}...
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal de Configuración de Metas Comerciales */}
      {showMetasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Metas Comerciales {selectedDivision} — Año {selectedAnio}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowMetasModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <p className="text-slate-500">
                Define los presupuestos objetivos mensuales para la división. Estos valores se comparan en tiempo real contra la venta y cotizaciones ganadas.
              </p>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  <div className="col-span-3">Mes</div>
                  <div className="col-span-4">Meta Venta Facturada (CLP)</div>
                  <div className="col-span-5">Meta Cotizaciones Emitidas (CLP)</div>
                </div>

                {editingMetas.map((meta, idx) => (
                  <div key={meta.mes} className="grid grid-cols-12 gap-2 p-2 items-center hover:bg-slate-50">
                    <div className="col-span-3 font-semibold text-slate-800">
                      {MESES.find((m) => m.value === meta.mes)?.label || `Mes ${meta.mes}`}
                    </div>
                    <div className="col-span-4">
                      <input
                        type="number"
                        value={meta.metaVentaClp}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingMetas((prev) => {
                            const next = [...prev];
                            next[idx].metaVentaClp = val;
                            next[idx].metaVentaUf = Math.round(val / 38500);
                            return next;
                          });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-200 text-xs text-slate-900 tabular-nums"
                      />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="number"
                        value={meta.metaCotizacionClp}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setEditingMetas((prev) => {
                            const next = [...prev];
                            next[idx].metaCotizacionClp = val;
                            next[idx].metaCotizacionUf = Math.round(val / 38500);
                            return next;
                          });
                        }}
                        className="w-full px-2 py-1 rounded border border-slate-200 text-xs text-slate-900 tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowMetasModal(false)}
                className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingMetas}
                onClick={handleSaveMetas}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs"
              >
                {savingMetas ? 'Guardando...' : 'Guardar Metas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

