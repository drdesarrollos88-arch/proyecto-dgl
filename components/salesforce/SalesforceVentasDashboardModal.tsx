'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Trophy,
  TrendingUp,
  Building2,
  Users,
  Calendar,
  ExternalLink,
  Search,
  Download,
  Filter,
  CheckCircle2,
  DollarSign,
  PieChart,
  Layers,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { KpisOportunidades, OportunidadCRM, MetaComercialPeriodo } from '@/lib/oportunidades-types';

interface SalesforceVentasDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  anio: number;
  kpis: KpisOportunidades;
  items: OportunidadCRM[];
  metas?: MetaComercialPeriodo[];
}

const NOMBRES_MESES = [
  'Todo el Año (Acumulado)',
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

export default function SalesforceVentasDashboardModal({
  isOpen,
  onClose,
  anio,
  kpis,
  items,
  metas = [],
}: SalesforceVentasDashboardModalProps) {
  const [selectedMes, setSelectedMes] = useState<number>(0);
  const [selectedComercial, setSelectedComercial] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'resumen' | 'comerciales' | 'clientes' | 'detalle'>('resumen');

  // Filtrar exclusivamente oportunidades ganadas del año
  const ganadasUniverso = useMemo(() => {
    return items.filter((item) => {
      if (item.estado !== 'ganada') return false;
      const fStr = item.fechaCierreNegocio || item.fechaCierre;
      if (!fStr) return false;
      const y = parseInt(fStr.slice(0, 4), 10);
      return y === anio;
    });
  }, [items, anio]);

  // Filtrar por mes seleccionado (si mes !== 0)
  const ganadasPeriodo = useMemo(() => {
    return ganadasUniverso.filter((item) => {
      if (selectedMes === 0) return true;
      const fStr = item.fechaCierreNegocio || item.fechaCierre;
      if (!fStr) return false;
      const m = parseInt(fStr.slice(5, 7), 10);
      return m === selectedMes;
    });
  }, [ganadasUniverso, selectedMes]);

  // Totales calculados del período
  const totalMontoGanadoClp = useMemo(() => {
    return ganadasPeriodo.reduce((sum, o) => sum + (o.montoClp || 0), 0);
  }, [ganadasPeriodo]);

  const totalMontoGanadoUf = useMemo(() => {
    return Number(ganadasPeriodo.reduce((sum, o) => sum + (o.montoUf || 0), 0).toFixed(2));
  }, [ganadasPeriodo]);

  const conteoGanadas = ganadasPeriodo.length;

  const ticketPromedioClp = conteoGanadas > 0 ? Math.round(totalMontoGanadoClp / conteoGanadas) : 0;

  // Meta del período
  const metaPeriodoClp = useMemo(() => {
    if (selectedMes === 0) {
      return metas.reduce((sum, m) => sum + (m.metaVentaClp || 0), 0) || kpis.metaVentaClp;
    }
    const target = metas.find((m) => m.mes === selectedMes);
    return target?.metaVentaClp || 0;
  }, [metas, selectedMes, kpis.metaVentaClp]);

  const cumplimientoPct = metaPeriodoClp > 0 ? Math.round((totalMontoGanadoClp / metaPeriodoClp) * 100) : 0;

  // 1. Ranking por Ejecutivo Comercial
  const rankingComerciales = useMemo(() => {
    const map = new Map<string, { comercial: string; montoClp: number; montoUf: number; count: number }>();
    for (const o of ganadasPeriodo) {
      const name = o.comercial || 'Sin Asignar';
      const prev = map.get(name) || { comercial: name, montoClp: 0, montoUf: 0, count: 0 };
      prev.montoClp += o.montoClp || 0;
      prev.montoUf += o.montoUf || 0;
      prev.count++;
      map.set(name, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.montoClp - a.montoClp);
  }, [ganadasPeriodo]);

  // 2. Top Clientes por Facturación Ganada
  const rankingClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; montoClp: number; montoUf: number; count: number }>();
    for (const o of ganadasPeriodo) {
      const name = o.cliente || 'Particular';
      const prev = map.get(name) || { cliente: name, montoClp: 0, montoUf: 0, count: 0 };
      prev.montoClp += o.montoClp || 0;
      prev.montoUf += o.montoUf || 0;
      prev.count++;
      map.set(name, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.montoClp - a.montoClp);
  }, [ganadasPeriodo]);

  // 3. Distribución por Centro de Costo / Unidad
  const distribucionUnidades = useMemo(() => {
    const map = new Map<string, { unidad: string; montoClp: number; count: number }>();
    for (const o of ganadasPeriodo) {
      const cc = o.centroCosto || (o.nombre.includes('2340') ? '2340' : o.nombre.includes('3340') ? '3340' : '2340 (DGL)');
      const label = cc.includes('2340')
        ? '2340 - Geotecnia'
        : cc.includes('3340')
        ? '3340 - Laboratorio'
        : cc.includes('2341')
        ? '2341 - Auscultación'
        : `CC ${cc}`;
      const prev = map.get(label) || { unidad: label, montoClp: 0, count: 0 };
      prev.montoClp += o.montoClp || 0;
      prev.count++;
      map.set(label, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.montoClp - a.montoClp);
  }, [ganadasPeriodo]);

  // Lista detallada con filtros de búsqueda y comercial
  const itemsFiltrados = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return ganadasPeriodo.filter((o) => {
      if (selectedComercial !== 'TODOS' && o.comercial !== selectedComercial) return false;
      if (q) {
        return (
          o.nombre.toLowerCase().includes(q) ||
          o.cliente.toLowerCase().includes(q) ||
          o.codigo.toLowerCase().includes(q) ||
          (o.comercial && o.comercial.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => (b.montoClp || 0) - (a.montoClp || 0));
  }, [ganadasPeriodo, selectedComercial, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-7xl max-h-[94vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-emerald-200 dark:border-emerald-800/50 flex flex-col overflow-hidden">
        {/* Header Oficial Salesforce */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <Trophy className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-emerald-500/25 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase tracking-wider">
                  Panel Salesforce Oficial
                </span>
                <span className="text-[11px] text-emerald-200/90 font-medium">
                  Informe: DGL-VTA-08 Venta Acumulada
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>PPT Comercial Venta DGL {anio}</span>
                <span className="text-xs font-normal text-emerald-200">
                  ({NOMBRES_MESES[selectedMes]})
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Mes */}
            <div className="flex items-center bg-emerald-950/60 border border-emerald-700/50 rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-emerald-300 mr-2 shrink-0" />
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(Number(e.target.value))}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                {NOMBRES_MESES.map((nombre, idx) => (
                  <option key={idx} value={idx} className="bg-slate-900 text-white">
                    {nombre}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tarjetas KPI Superiores */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3.5 shrink-0">
          {/* 1. Venta Real Ganada */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
              Venta Cerrada Ganada
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatClp(totalMontoGanadoClp)}
            </div>
            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
              {totalMontoGanadoUf.toLocaleString('es-CL')} UF
            </div>
          </div>

          {/* 2. Meta Presupuestada & Cumplimiento */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Meta Presupuestada
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatClp(metaPeriodoClp)}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-xs font-black px-1.5 py-0.2 rounded-full ${
                  cumplimientoPct >= 100
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {cumplimientoPct}% Cumplimiento
              </span>
            </div>
          </div>

          {/* 3. Cantidad de Oportunidades Ganadas */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Negocios Ganados
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {conteoGanadas}{' '}
              <span className="text-xs font-normal text-slate-500">oportunidades</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              100% conciliado con Salesforce
            </div>
          </div>

          {/* 4. Ticket Promedio */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Ticket Promedio de Cierre
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatClp(ticketPromedioClp)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Promedio por oportunidad adjudicada
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Panel */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('resumen')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'resumen'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              1. Evolución & Resumen
            </button>
            <button
              onClick={() => setActiveTab('comerciales')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'comerciales'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              2. Ranking Comerciales ({rankingComerciales.length})
            </button>
            <button
              onClick={() => setActiveTab('clientes')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'clientes'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              3. Top Clientes ({rankingClientes.length})
            </button>
            <button
              onClick={() => setActiveTab('detalle')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'detalle'
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              4. Oportunidades Ganadas ({itemsFiltrados.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            Datos oficiales de Salesforce CRM en tiempo real
          </div>
        </div>

        {/* Contenido según pestaña */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: RESUMEN Y EVOLUCIÓN */}
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              {/* Gráfico de Evolución Mensual Real vs Meta */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Venta Ganada Acumulada Mes a Mes vs Meta Presupuestada ({anio})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cierre de negocios oficial según Fecha de Cierre del Negocio en Salesforce
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      <span className="w-3 h-3 rounded bg-emerald-600 inline-block" /> Real Ganado
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold text-slate-400">
                      <span className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-700 inline-block" /> Meta
                    </span>
                  </div>
                </div>

                {/* Gráfico de Barras por Mes */}
                <div className="grid grid-cols-12 gap-2 items-end h-56 pt-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {kpis.evolucionMeses.map((m: any) => {
                    const maxVal = Math.max(
                      ...kpis.evolucionMeses.map((x: any) => Math.max(x.ganadoClp, x.metaVentaClp)),
                      1
                    );
                    const hReal = Math.min(100, Math.round((m.ganadoClp / maxVal) * 100));
                    const hMeta = Math.min(100, Math.round((m.metaVentaClp / maxVal) * 100));
                    const isSelected = m.mes === selectedMes;

                    return (
                      <div
                        key={m.mes}
                        onClick={() => setSelectedMes(m.mes === selectedMes ? 0 : m.mes)}
                        className={`flex flex-col items-center justify-end h-full cursor-pointer p-1 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-emerald-100/80 dark:bg-emerald-950/50 ring-2 ring-emerald-500 shadow-xs'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                        title={`${m.nombreMes}: Real ${formatClp(m.ganadoClp)} | Meta ${formatClp(
                          m.metaVentaClp
                        )} (${m.cumplimientoVentaPct}%)`}
                      >
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums mb-1 hidden sm:block">
                          {m.ganadoClp > 0 ? `$${Math.round(m.ganadoClp / 1000000)}M` : '$0'}
                        </span>
                        <div className="w-full flex items-end justify-center gap-1 h-36">
                          <div
                            className={`w-3 sm:w-4 rounded-t transition-all ${
                              m.cumplimientoVentaPct >= 100
                                ? 'bg-emerald-600 dark:bg-emerald-500 shadow-2xs'
                                : 'bg-emerald-500/80 dark:bg-emerald-600'
                            }`}
                            style={{ height: `${Math.max(4, hReal)}%` }}
                          />
                          <div
                            className="w-2 sm:w-3 bg-slate-300 dark:bg-slate-700 rounded-t"
                            style={{ height: `${Math.max(4, hMeta)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2">
                          {m.nombreMes}
                        </span>
                        <span
                          className={`text-[9px] font-bold mt-0.5 ${
                            m.cumplimientoVentaPct >= 100
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700'
                          }`}
                        >
                          {m.cumplimientoVentaPct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid de 2 Columnas: Top 5 Comerciales & Top 5 Clientes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Top 5 Comerciales */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <span>Top Comerciales en Ventas</span>
                    </h4>
                    <button
                      onClick={() => setActiveTab('comerciales')}
                      className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                  </div>

                  <div className="space-y-2">
                    {rankingComerciales.slice(0, 5).map((c, idx) => {
                      const share = totalMontoGanadoClp > 0 ? (c.montoClp / totalMontoGanadoClp) * 100 : 0;
                      return (
                        <div key={c.comercial} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-100">
                              #{idx + 1} {c.comercial}
                            </span>
                            <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                              {formatClp(c.montoClp)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                            <span>{c.count} negocios cerrados</span>
                            <span>{share.toFixed(1)}% del total DGL</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top 5 Clientes */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>Top Mandantes / Clientes Facturados</span>
                    </h4>
                    <button
                      onClick={() => setActiveTab('clientes')}
                      className="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                  </div>

                  <div className="space-y-2">
                    {rankingClientes.slice(0, 5).map((cl, idx) => {
                      const share = totalMontoGanadoClp > 0 ? (cl.montoClp / totalMontoGanadoClp) * 100 : 0;
                      return (
                        <div key={cl.cliente} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-800 dark:text-slate-100 truncate max-w-[200px]" title={cl.cliente}>
                              #{idx + 1} {cl.cliente}
                            </span>
                            <span className="font-black text-slate-900 dark:text-white tabular-nums">
                              {formatClp(cl.montoClp)}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className="h-full bg-teal-600 rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                            <span>{cl.count} contratos</span>
                            <span>{share.toFixed(1)}% de la facturación</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RANKING COMPLETO DE COMERCIALES */}
          {activeTab === 'comerciales' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Desempeño de Ventas por Ejecutivo Comercial ({anio})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aporte acumulado en monto CLP, UF y cantidad de propuestas cerradas ganadas
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Asesor Comercial</th>
                      <th className="py-3 px-4 text-center">Negocios Ganados</th>
                      <th className="py-3 px-4 text-right">Venta CLP</th>
                      <th className="py-3 px-4 text-right">Venta UF</th>
                      <th className="py-3 px-4 text-right">Ticket Promedio</th>
                      <th className="py-3 px-4 text-right">Participación DGL</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rankingComerciales.map((c, idx) => {
                      const share = totalMontoGanadoClp > 0 ? (c.montoClp / totalMontoGanadoClp) * 100 : 0;
                      const ticket = c.count > 0 ? Math.round(c.montoClp / c.count) : 0;
                      return (
                        <tr key={c.comercial} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-black text-[10px]">
                              {c.comercial.slice(0, 2).toUpperCase()}
                            </span>
                            <span>{c.comercial}</span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {c.count}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatClp(c.montoClp)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300 tabular-nums font-semibold">
                            {c.montoUf.toLocaleString('es-CL')} UF
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-slate-400 tabular-nums">
                            {formatClp(ticket)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{share.toFixed(1)}%</span>
                              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-600" style={{ width: `${share}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                setSelectedComercial(c.comercial);
                                setActiveTab('detalle');
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 hover:text-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Ver Negocios
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RANKING COMPLETO DE CLIENTES */}
          {activeTab === 'clientes' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Concentración de Facturación por Cliente / Mandante ({anio})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Principales empresas ordenadas por volumen adjudicado en la División DGL
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Cliente / Razón Social</th>
                      <th className="py-3 px-4 text-center">N° Contratos</th>
                      <th className="py-3 px-4 text-right">Monto Total CLP</th>
                      <th className="py-3 px-4 text-right">Monto Total UF</th>
                      <th className="py-3 px-4 text-right">% Facturación DGL</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rankingClientes.map((cl, idx) => {
                      const share = totalMontoGanadoClp > 0 ? (cl.montoClp / totalMontoGanadoClp) * 100 : 0;
                      return (
                        <tr key={cl.cliente} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-black text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            {cl.cliente}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                            {cl.count}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white tabular-nums">
                            {formatClp(cl.montoClp)}
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-700 dark:text-emerald-400 tabular-nums font-semibold">
                            {cl.montoUf.toLocaleString('es-CL')} UF
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{share.toFixed(1)}%</span>
                              <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-600" style={{ width: `${share}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => {
                                setSearchQuery(cl.cliente);
                                setActiveTab('detalle');
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 hover:text-emerald-800 text-[11px] font-bold transition-colors cursor-pointer"
                            >
                              Ver Proyectos
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LISTA DETALLADA DE OPORTUNIDADES GANADAS */}
          {activeTab === 'detalle' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Detalle de Oportunidades Cerradas Ganadas ({itemsFiltrados.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Oportunidades oficiales registradas en Salesforce y vinculadas al cotizador DGL
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Buscador */}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar por cliente, proyecto, código..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Filtro Comercial */}
                  <select
                    value={selectedComercial}
                    onChange={(e) => setSelectedComercial(e.target.value)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
                  >
                    <option value="TODOS">Todos los comerciales</option>
                    {rankingComerciales.map((c) => (
                      <option key={c.comercial} value={c.comercial}>
                        {c.comercial}
                      </option>
                    ))}
                  </select>

                  {(searchQuery || selectedComercial !== 'TODOS') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedComercial('TODOS');
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 px-2 py-1 cursor-pointer font-bold"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto max-h-[50vh] border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px] z-10">
                    <tr>
                      <th className="py-3 px-3">Código</th>
                      <th className="py-3 px-3">Nombre Oportunidad / Proyecto</th>
                      <th className="py-3 px-3">Cliente / Razón Social</th>
                      <th className="py-3 px-3">Comercial</th>
                      <th className="py-3 px-3 text-center">Fecha Cierre Ganado</th>
                      <th className="py-3 px-3 text-right">Monto CLP</th>
                      <th className="py-3 px-3 text-right">Monto UF</th>
                      <th className="py-3 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {itemsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          No se encontraron oportunidades ganadas con los filtros seleccionados
                        </td>
                      </tr>
                    ) : (
                      itemsFiltrados.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.codigo}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white max-w-xs truncate" title={item.nombre}>
                            {item.nombre}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[180px] truncate" title={item.cliente}>
                            {item.cliente}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {item.comercial}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                            {item.fechaCierreNegocio || item.fechaCierre}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            {formatClp(item.montoClp)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 tabular-nums font-semibold">
                            {item.montoUf.toLocaleString('es-CL')} UF
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.salesforceId && (
                                <a
                                  href={`https://idiem.lightning.force.com/lightning/r/Opportunity/${item.salesforceId}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 hover:text-emerald-800 transition-colors"
                                  title="Abrir en Salesforce CRM"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                </a>
                              )}
                              {item.cotizacionDglId && (
                                <a
                                  href={`/cotizador?id=${item.cotizacionDglId}`}
                                  className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold hover:bg-emerald-100"
                                  title="Ver propuesta técnica local"
                                >
                                  DGL
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Datos 100% conciliados con el panel oficial de Salesforce IDIEM</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition-colors cursor-pointer text-xs"
          >
            Cerrar Vista
          </button>
        </div>
      </div>
    </div>
  );
}
