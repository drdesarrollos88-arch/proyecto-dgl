'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import SalesforceStatusBadge from '@/components/salesforce/SalesforceStatusBadge';
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
  Plus,
  Settings,
  Sparkles,
  SlidersHorizontal,
  ChevronDown,
  X,
  FileSpreadsheet,
  AlertTriangle,
  Cloud,
  CreditCard,
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

const NOMBRES_MESES = [
  '',
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function formatClp(val: number): string {
  const abs = Math.abs(Math.round(val));
  const formatted = abs.toLocaleString('es-CL');
  return val < 0 ? `-$${formatted}` : `$${formatted}`;
}

export default function OportunidadesPage() {
  const [selectedAnio, setSelectedAnio] = useState<number>(2026);
  const [selectedMes, setSelectedMes] = useState<number>(0); // 0 = Acumulado YTD
  const [sourceFilter, setSourceFilter] = useState<'TODOS' | 'WEB_DGL' | 'SALESFORCE'>('TODOS');
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | 'ganada' | 'perdida' | 'en_curso'>('TODOS');
  const [search, setSearch] = useState<string>('');

  const [items, setItems] = useState<OportunidadCRM[]>([]);
  const [kpis, setKpis] = useState<KpisOportunidades | null>(null);
  const [metas, setMetas] = useState<MetaComercialPeriodo[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncingSf, setSyncingSf] = useState<boolean>(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState<boolean>(false);

  // Modal de configuración y creación de metas comerciales
  const [showMetasModal, setShowMetasModal] = useState<boolean>(false);
  const [editingAnio, setEditingAnio] = useState<number>(2026);
  const [editingMetas, setEditingMetas] = useState<MetaComercialPeriodo[]>([]);
  const [newYearInput, setNewYearInput] = useState<string>('');
  const [savingMetas, setSavingMetas] = useState<boolean>(false);

  // Solo años creados en presupuestos
  const availableYears = useMemo(() => {
    const list = kpis?.aniosDisponibles || [2026];
    if (!list.includes(selectedAnio)) {
      list.push(selectedAnio);
    }
    return Array.from(new Set(list)).sort((a, b) => b - a);
  }, [kpis?.aniosDisponibles, selectedAnio]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setSyncSuccessMsg(null);
    try {
      const q = new URLSearchParams({
        anio: String(selectedAnio),
        mes: String(selectedMes),
        division: 'DGL',
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
  }, [selectedAnio, selectedMes, sourceFilter, estadoFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Conectar con Salesforce vía Popup OAuth
  const handleConnectSalesforce = () => {
    const width = 600;
    const height = 720;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;

    window.open(
      '/api/auth/salesforce/login',
      'SalesforceAuthWindow',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
  };

  // Sincronizar Oportunidades de Salesforce en vivo
  const handleSyncSalesforce = useCallback(async () => {
    setSyncingSf(true);
    setSyncSuccessMsg(null);
    setSyncErrorMsg(null);
    setIsAuthError(false);
    try {
      const res = await fetch('/api/oportunidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_salesforce',
          anio: selectedAnio,
          division: 'DGL',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al sincronizar con Salesforce');
      setSyncSuccessMsg(data.message || 'Sincronización completada.');
      loadData();
    } catch (err: any) {
      const msg = err?.message || 'Error conectando con Salesforce';
      setSyncErrorMsg(msg);
      const isAuth =
        msg.toLowerCase().includes('caducado') ||
        msg.toLowerCase().includes('expirado') ||
        msg.toLowerCase().includes('token') ||
        msg.toLowerCase().includes('invalid_grant') ||
        msg.toLowerCase().includes('inicia sesión') ||
        msg.toLowerCase().includes('conectar salesforce');
      setIsAuthError(isAuth);
    } finally {
      setSyncingSf(false);
    }
  }, [selectedAnio, loadData]);

  // Escuchar mensaje del popup OAuth cuando finalice la autorización
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SALESFORCE_AUTH_SUCCESS') {
        setSyncErrorMsg(null);
        setIsAuthError(false);
        handleSyncSalesforce();
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [handleSyncSalesforce]);

  // Abrir modal de metas
  const handleOpenMetasModal = () => {
    setEditingAnio(selectedAnio);
    const yearMetas = metas.filter((m) => m.anio === selectedAnio);
    if (yearMetas.length === 12) {
      setEditingMetas(JSON.parse(JSON.stringify(yearMetas)));
    } else {
      generateInitialYearMetas(selectedAnio);
    }
    setShowMetasModal(true);
  };

  // Generar meses para un año seleccionado o nuevo
  const generateInitialYearMetas = (targetYear: number) => {
    const list: MetaComercialPeriodo[] = [];
    for (let m = 1; m <= 12; m++) {
      list.push({
        id: `meta-DGL-${targetYear}-${m}`,
        anio: targetYear,
        mes: m,
        division: 'DGL',
        metaVentaClp: 120000000,
        metaVentaUf: Math.round(120000000 / 38500),
        metaCotizacionClp: 250000000,
        metaCotizacionUf: Math.round(250000000 / 38500),
        conteoCotizacionesMeta: 25,
        descripcion: `Meta estándar ${NOMBRES_MESES[m]} ${targetYear}`,
      });
    }
    setEditingMetas(list);
  };

  // Crear nuevo año para objetivos
  const handleCreateNewYear = () => {
    const parsed = parseInt(newYearInput.trim(), 10);
    if (isNaN(parsed) || parsed < 2020 || parsed > 2040) {
      alert('Por favor ingresa un año válido (ej. 2027)');
      return;
    }
    setEditingAnio(parsed);
    generateInitialYearMetas(parsed);
    setNewYearInput('');
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
      setSelectedAnio(editingAnio);
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
      'Condicion_Pago',
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
      o.condicionPago || '50% AL CONTADO Y 50% CONTRA ENTREGA',
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
    link.download = `Oportunidades_DGL_${selectedAnio}_${
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
                  CRM Unificado DGL
                </span>
                {syncSuccessMsg && (
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {syncSuccessMsg}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Panel integral de cotizaciones del portal y ventas de Salesforce con control presupuestario de metas
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Badge fijo: Solo División DGL */}
              <div className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>División DGL</span>
              </div>

              {/* Selector Año (Solo años creados en presupuestos) */}
              <select
                value={selectedAnio}
                onChange={(e) => setSelectedAnio(Number(e.target.value))}
                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                {availableYears.map((y) => (
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

              {/* Estado / Conexión Salesforce */}
              <SalesforceStatusBadge />

              {/* Botón Sincronizar Salesforce */}
              <button
                type="button"
                onClick={handleSyncSalesforce}
                disabled={syncingSf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-xs font-semibold text-blue-800 transition-colors cursor-pointer"
                title="Consultar e importar cotizaciones y ventas de Salesforce vía SOQL"
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
                Presupuestos & Metas
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

          {/* Banner de Alerta / Sesión Caducada de Salesforce */}
          {syncErrorMsg && (
            <div className="mt-4 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <div className="font-bold text-rose-950">
                    {isAuthError ? 'Sesión de Salesforce Caducada o Desconectada' : 'Aviso al sincronizar con Salesforce'}
                  </div>
                  <div className="text-rose-800 mt-0.5">{syncErrorMsg}</div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                {isAuthError && (
                  <button
                    type="button"
                    onClick={handleConnectSalesforce}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Conectar Salesforce</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSyncErrorMsg(null)}
                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                  title="Cerrar aviso"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bloque 1: DASHBOARD DUAL 50 / 50 (VENTAS vs COTIZACIONES) */}
        {kpis && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
            {/* PANEL IZQUIERDO (50%): DASHBOARD DE VENTAS / CIERRES */}
            <div className="bg-white rounded-xl border border-emerald-200/90 shadow-sm p-4 space-y-4">
              {/* Header Panel Ventas */}
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                      1. Dashboard de Ventas (Facturadas / Ganadas)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Cierres de negocio exitosos {selectedMes === 0 ? `acumulados ${selectedAnio}` : `${NOMBRES_MESES[selectedMes]} ${selectedAnio}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    kpis.cumplimientoVentaPct >= 100
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : kpis.cumplimientoVentaPct >= 70
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  {kpis.cumplimientoVentaPct}% Cumplimiento Meta
                </span>
              </div>

              {/* Tarjetas KPI de Ventas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Total Ganado */}
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                    Monto Total Ganado
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      {formatClp(kpis.montoGanadoClp)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700 tabular-nums">
                      {kpis.montoGanadoUf} UF
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-emerald-200/50 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis.cumplimientoVentaPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Meta: {formatClp(kpis.metaVentaClp)}</span>
                    <span className={kpis.gapVentaClp >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-600'}>
                      Gap: {kpis.gapVentaClp >= 0 ? `+${formatClp(kpis.gapVentaClp)}` : formatClp(kpis.gapVentaClp)}
                    </span>
                  </div>
                </div>

                {/* Tasa de Cierre y Ticket */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Tasa de Conversión & Ticket
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      {kpis.tasaCierrePct}%
                    </span>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {kpis.conteoGanadas} ganadas / {kpis.conteoPerdidas} perdidas
                    </span>
                  </div>
                  <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Ticket Promedio Venta:</span>
                    <strong className="text-slate-800 tabular-nums">{formatClp(kpis.ticketPromedioClp)}</strong>
                  </div>
                </div>
              </div>

              {/* Gráfico de Evolución Mensual de Ventas (Real vs Meta) */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Evolución Mensual: Venta Ganada vs Meta Presupuestada ({selectedAnio})
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-600 inline-block" /> Real Ganado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-slate-300 inline-block" /> Meta
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1 items-end h-32 pt-2 border-b border-slate-200/80 pb-1">
                  {kpis.evolucionMeses.map((m) => {
                    const maxVal = Math.max(
                      ...kpis.evolucionMeses.map((x) => Math.max(x.ganadoClp, x.metaVentaClp)),
                      1
                    );
                    const hReal = Math.min(100, Math.round((m.ganadoClp / maxVal) * 100));
                    const hMeta = Math.min(100, Math.round((m.metaVentaClp / maxVal) * 100));
                    const isCurrent = m.mes === selectedMes;

                    return (
                      <div
                        key={m.mes}
                        onClick={() => setSelectedMes(m.mes === selectedMes ? 0 : m.mes)}
                        className={`flex flex-col items-center justify-end h-full cursor-pointer p-0.5 rounded transition-colors ${
                          isCurrent ? 'bg-emerald-100 ring-1 ring-emerald-500' : 'hover:bg-slate-200/50'
                        }`}
                        title={`${m.nombreMes}: Real ${formatClp(m.ganadoClp)} | Meta ${formatClp(
                          m.metaVentaClp
                        )} (${m.cumplimientoVentaPct}%)`}
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-24">
                          <div
                            className={`w-2 sm:w-2.5 rounded-t transition-all ${
                              m.cumplimientoVentaPct >= 100 ? 'bg-emerald-600' : 'bg-emerald-500'
                            }`}
                            style={{ height: `${Math.max(4, hReal)}%` }}
                          />
                          <div
                            className="w-1.5 sm:w-2 bg-slate-300 rounded-t"
                            style={{ height: `${Math.max(4, hMeta)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-semibold text-slate-600 mt-1">{m.nombreMes}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aporte por Asesor en Ventas */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Ranking de Comerciales en Ventas Ganadas
                </span>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {kpis.porComercial.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-slate-500">Sin datos de ventas</div>
                  ) : (
                    kpis.porComercial
                      .filter((c) => c.ganadasCount > 0 || c.montoGanadoClp > 0)
                      .map((c, idx) => (
                        <div key={c.comercial} className="p-2 flex items-center justify-between text-xs hover:bg-slate-50">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800">
                              #{idx + 1} {c.comercial}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-2">({c.ganadasCount} ganadas)</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 tabular-nums">{formatClp(c.montoGanadoClp)}</span>
                            <span className="text-[10px] text-emerald-700 ml-1.5 tabular-nums">({c.montoGanadoUf} UF)</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>

            {/* PANEL DERECHO (50%): DASHBOARD DE COTIZACIONES / PIPELINE */}
            <div className="bg-white rounded-xl border border-blue-200/90 shadow-sm p-4 space-y-4">
              {/* Header Panel Cotizaciones */}
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                      2. Dashboard de Cotizaciones (Emitidas & Pipeline)
                    </h2>
                    <p className="text-[11px] text-slate-500">
                      Volumen cotizado total y propuestas vivas {selectedMes === 0 ? `acumuladas ${selectedAnio}` : `${NOMBRES_MESES[selectedMes]} ${selectedAnio}`}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    kpis.cumplimientoCotizacionPct >= 100
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}
                >
                  {kpis.cumplimientoCotizacionPct}% de Meta Cotización
                </span>
              </div>

              {/* Tarjetas KPI de Cotizaciones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Total Cotizado */}
                <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                    Volumen Cotizado Total
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      {formatClp(kpis.montoCotizadoTotalClp)}
                    </span>
                    <span className="text-xs font-semibold text-blue-700 tabular-nums">
                      {kpis.montoCotizadoTotalUf} UF
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-blue-200/50 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, kpis.cumplimientoCotizacionPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Meta: {formatClp(kpis.metaCotizacionClp)}</span>
                    <span className="font-semibold text-slate-700">{kpis.totalOportunidades} cotizaciones</span>
                  </div>
                </div>

                {/* Pipeline en Curso */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
                    Pipeline Activo en Curso
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-slate-900 tabular-nums">
                      {formatClp(kpis.montoEnCursoClp)}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">
                      {kpis.montoEnCursoUf} UF
                    </span>
                  </div>
                  <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Propuestas vivas:</span>
                    <strong className="text-blue-700">{kpis.conteoEnCurso} en negociación</strong>
                  </div>
                </div>
              </div>

              {/* Gráfico de Evolución Mensual de Cotizaciones (Real vs Meta) */}
              <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Evolución Mensual: Volumen Cotizado vs Meta Presupuestada ({selectedAnio})
                  </span>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-blue-600 inline-block" /> Cotizado
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded bg-slate-300 inline-block" /> Meta
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-1 items-end h-32 pt-2 border-b border-slate-200/80 pb-1">
                  {kpis.evolucionMeses.map((m) => {
                    const maxVal = Math.max(
                      ...kpis.evolucionMeses.map((x) => Math.max(x.cotizadoTotalClp, x.metaCotizacionClp)),
                      1
                    );
                    const hReal = Math.min(100, Math.round((m.cotizadoTotalClp / maxVal) * 100));
                    const hMeta = Math.min(100, Math.round((m.metaCotizacionClp / maxVal) * 100));
                    const isCurrent = m.mes === selectedMes;

                    return (
                      <div
                        key={m.mes}
                        onClick={() => setSelectedMes(m.mes === selectedMes ? 0 : m.mes)}
                        className={`flex flex-col items-center justify-end h-full cursor-pointer p-0.5 rounded transition-colors ${
                          isCurrent ? 'bg-blue-100 ring-1 ring-blue-500' : 'hover:bg-slate-200/50'
                        }`}
                        title={`${m.nombreMes}: Cotizado ${formatClp(m.cotizadoTotalClp)} | Meta ${formatClp(
                          m.metaCotizacionClp
                        )} (${m.cumplimientoCotizacionPct}%)`}
                      >
                        <div className="w-full flex items-end justify-center gap-0.5 h-24">
                          <div
                            className="w-2 sm:w-2.5 bg-blue-600 rounded-t transition-all"
                            style={{ height: `${Math.max(4, hReal)}%` }}
                          />
                          <div
                            className="w-1.5 sm:w-2 bg-slate-300 rounded-t"
                            style={{ height: `${Math.max(4, hMeta)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-semibold text-slate-600 mt-1">{m.nombreMes}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aporte por Asesor en Cotizaciones */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 block">
                  Ranking de Comerciales en Volumen Cotizado
                </span>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {kpis.porComercial.length === 0 ? (
                    <div className="p-3 text-center text-[11px] text-slate-500">Sin datos de cotizaciones</div>
                  ) : (
                    [...kpis.porComercial]
                      .sort((a, b) => b.cotizadoTotalClp - a.cotizadoTotalClp)
                      .map((c, idx) => (
                        <div key={c.comercial} className="p-2 flex items-center justify-between text-xs hover:bg-slate-50">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800">
                              #{idx + 1} {c.comercial}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-2">({c.totalOpps} cotizaciones)</span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-bold text-slate-900 tabular-nums">{formatClp(c.cotizadoTotalClp)}</span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bloque 2: Tabla Exploradora de Oportunidades y Cotizaciones */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Barra de Filtros de la Tabla */}
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
              {/* Filtro Origen: Todos | Portal DGL | Salesforce */}
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

              {/* Buscador */}
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
                  <th className="py-2.5 px-3">Condición de Pago</th>
                  <th className="py-2.5 px-3">Comercial / Cierre</th>
                  <th className="py-2.5 px-3">Etapa</th>
                  <th className="py-2.5 px-3 text-right">Monto CLP / UF</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 text-xs">
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
                                Portal DGL
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

                        {/* Col 4: Condición de Pago */}
                        <td className="py-3 px-3">
                          {o.condicionPago ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-900 border border-amber-200">
                              <CreditCard className="w-3 h-3 text-amber-600 shrink-0" />
                              <span className="truncate max-w-[140px]" title={o.condicionPago}>
                                {o.condicionPago}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">30 días contra factura</span>
                          )}
                        </td>

                        {/* Col 5: Comercial / Fecha Cierre */}
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
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {o.estado === 'ganada' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : o.estado === 'perdida' ? (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            ) : (
                              <Clock className="w-3 h-3 text-blue-600" />
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

      {/* Modal de Presupuestos & Metas Comerciales (con soporte para crear nuevos años) */}
      {showMetasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header del Modal */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Presupuestos & Metas Comerciales DGL
                  </h3>
                  <p className="text-xs text-slate-500">
                    Asigna metas mensuales para Ventas Facturadas y Cotizaciones Emitidas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMetasModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Selección y Creación de Año */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">Año del Presupuesto:</span>
                <select
                  value={editingAnio}
                  onChange={(e) => {
                    const yr = Number(e.target.value);
                    setEditingAnio(yr);
                    const yrMetas = metas.filter((m) => m.anio === yr);
                    if (yrMetas.length === 12) setEditingMetas(JSON.parse(JSON.stringify(yrMetas)));
                    else generateInitialYearMetas(yr);
                  }}
                  className="px-2.5 py-1 font-bold rounded-lg border border-slate-200 bg-white text-slate-900"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      Año {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Crear Año Futuro */}
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  placeholder="Ej. 2027"
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(e.target.value)}
                  className="w-24 px-2 py-1 rounded border border-slate-200 bg-white text-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={handleCreateNewYear}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Crear Año
                </button>
              </div>
            </div>

            {/* Tabla de 12 Meses */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                <div className="grid grid-cols-12 gap-2 p-2.5 bg-slate-50 font-bold uppercase tracking-wider text-[10px] text-slate-500">
                  <div className="col-span-3">Mes ({editingAnio})</div>
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

            {/* Footer Modal */}
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
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                {savingMetas ? 'Guardando...' : `Guardar Presupuesto ${editingAnio}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
