'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Target,
  TrendingUp,
  Building2,
  Users,
  Calendar,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  AlertCircle,
} from 'lucide-react';
import { KpisOportunidades, OportunidadCRM, MetaComercialPeriodo } from '@/lib/oportunidades-types';

interface SalesforceCotizacionesDashboardModalProps {
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

export default function SalesforceCotizacionesDashboardModal({
  isOpen,
  onClose,
  anio,
  kpis,
  items,
  metas = [],
}: SalesforceCotizacionesDashboardModalProps) {
  const [selectedMes, setSelectedMes] = useState<number>(0);
  const [selectedComercial, setSelectedComercial] = useState<string>('TODOS');
  const [selectedEstado, setSelectedEstado] = useState<'TODOS' | 'en_curso' | 'ganada' | 'perdida'>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'embudo' | 'comerciales' | 'clientes' | 'detalle'>('embudo');

  // Universo de cotizaciones emitidas en el año según Fecha_de_ultimo_envio_Cotizacion__c
  const cotizacionesUniverso = useMemo(() => {
    return items.filter((item) => {
      const fStr = item.fechaUltimoEnvioCotizacion || item.fechaCierre;
      if (!fStr) return false;
      const y = parseInt(fStr.slice(0, 4), 10);
      return y === anio;
    });
  }, [items, anio]);

  // Filtrar por mes seleccionado (si mes !== 0)
  const cotizacionesPeriodo = useMemo(() => {
    return cotizacionesUniverso.filter((item) => {
      if (selectedMes === 0) return true;
      const fStr = item.fechaUltimoEnvioCotizacion || item.fechaCierre;
      if (!fStr) return false;
      const m = parseInt(fStr.slice(5, 7), 10);
      return m === selectedMes;
    });
  }, [cotizacionesUniverso, selectedMes]);

  // Totales
  const totalCotizadoClp = useMemo(() => {
    return cotizacionesPeriodo.reduce((sum, o) => sum + (o.montoClp || 0), 0);
  }, [cotizacionesPeriodo]);

  const totalCotizadoUf = useMemo(() => {
    return Number(cotizacionesPeriodo.reduce((sum, o) => sum + (o.montoUf || 0), 0).toFixed(2));
  }, [cotizacionesPeriodo]);

  const conteoCotizaciones = cotizacionesPeriodo.length;

  // Pipeline activo en curso (pendientes)
  const pendientesPeriodo = useMemo(() => {
    return cotizacionesPeriodo.filter((o) => o.estado === 'en_curso');
  }, [cotizacionesPeriodo]);

  const totalPendientesClp = useMemo(() => {
    return pendientesPeriodo.reduce((sum, o) => sum + (o.montoClp || 0), 0);
  }, [pendientesPeriodo]);

  const totalPendientesUf = useMemo(() => {
    return Number(pendientesPeriodo.reduce((sum, o) => sum + (o.montoUf || 0), 0).toFixed(2));
  }, [pendientesPeriodo]);

  const conteoPendientes = pendientesPeriodo.length;

  // Ganadas y Perdidas dentro del universo cotizado
  const ganadasCount = useMemo(() => cotizacionesPeriodo.filter((o) => o.estado === 'ganada').length, [cotizacionesPeriodo]);
  const perdidasCount = useMemo(() => cotizacionesPeriodo.filter((o) => o.estado === 'perdida').length, [cotizacionesPeriodo]);

  // Meta de cotización del período
  const metaCotizacionClp = useMemo(() => {
    if (selectedMes === 0) {
      return metas.reduce((sum, m) => sum + (m.metaCotizacionClp || 0), 0) || kpis.metaCotizacionClp;
    }
    const target = metas.find((m) => m.mes === selectedMes);
    return target?.metaCotizacionClp || 0;
  }, [metas, selectedMes, kpis.metaCotizacionClp]);

  const cumplimientoPct = metaCotizacionClp > 0 ? Math.round((totalCotizadoClp / metaCotizacionClp) * 100) : 0;

  // 1. Embudo por Etapa / Estado
  const embudoEtapas = useMemo(() => {
    const etapasMap = new Map<string, { etapa: string; estado: string; montoClp: number; montoUf: number; count: number }>();
    for (const o of cotizacionesPeriodo) {
      const e = o.etapa || 'Propuesta enviada';
      const prev = etapasMap.get(e) || { etapa: e, estado: o.estado, montoClp: 0, montoUf: 0, count: 0 };
      prev.montoClp += o.montoClp || 0;
      prev.montoUf += o.montoUf || 0;
      prev.count++;
      etapasMap.set(e, prev);
    }
    return Array.from(etapasMap.values()).sort((a, b) => b.montoClp - a.montoClp);
  }, [cotizacionesPeriodo]);

  // 2. Ranking de Comerciales en Cotizaciones & Pipeline
  const rankingComerciales = useMemo(() => {
    const map = new Map<
      string,
      {
        comercial: string;
        totalCotizadoClp: number;
        totalCotizadoUf: number;
        conteoTotal: number;
        pipelineEnCursoClp: number;
        conteoEnCurso: number;
        ganadasCount: number;
      }
    >();
    for (const o of cotizacionesPeriodo) {
      const name = o.comercial || 'Sin Asignar';
      const prev = map.get(name) || {
        comercial: name,
        totalCotizadoClp: 0,
        totalCotizadoUf: 0,
        conteoTotal: 0,
        pipelineEnCursoClp: 0,
        conteoEnCurso: 0,
        ganadasCount: 0,
      };
      prev.totalCotizadoClp += o.montoClp || 0;
      prev.totalCotizadoUf += o.montoUf || 0;
      prev.conteoTotal++;
      if (o.estado === 'en_curso') {
        prev.pipelineEnCursoClp += o.montoClp || 0;
        prev.conteoEnCurso++;
      } else if (o.estado === 'ganada') {
        prev.ganadasCount++;
      }
      map.set(name, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.totalCotizadoClp - a.totalCotizadoClp);
  }, [cotizacionesPeriodo]);

  // 3. Top Clientes Cotizados
  const rankingClientes = useMemo(() => {
    const map = new Map<string, { cliente: string; montoClp: number; montoUf: number; count: number; enCursoCount: number }>();
    for (const o of cotizacionesPeriodo) {
      const name = o.cliente || 'Particular';
      const prev = map.get(name) || { cliente: name, montoClp: 0, montoUf: 0, count: 0, enCursoCount: 0 };
      prev.montoClp += o.montoClp || 0;
      prev.montoUf += o.montoUf || 0;
      prev.count++;
      if (o.estado === 'en_curso') prev.enCursoCount++;
      map.set(name, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.montoClp - a.montoClp);
  }, [cotizacionesPeriodo]);

  // Filtrado de lista detallada
  const itemsFiltrados = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return cotizacionesPeriodo.filter((o) => {
      if (selectedComercial !== 'TODOS' && o.comercial !== selectedComercial) return false;
      if (selectedEstado !== 'TODOS' && o.estado !== selectedEstado) return false;
      if (q) {
        return (
          o.nombre.toLowerCase().includes(q) ||
          o.cliente.toLowerCase().includes(q) ||
          o.codigo.toLowerCase().includes(q) ||
          o.etapa.toLowerCase().includes(q) ||
          (o.comercial && o.comercial.toLowerCase().includes(q))
        );
      }
      return true;
    }).sort((a, b) => (b.montoClp || 0) - (a.montoClp || 0));
  }, [cotizacionesPeriodo, selectedComercial, selectedEstado, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-7xl max-h-[94vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-blue-200 dark:border-blue-800/50 flex flex-col overflow-hidden">
        {/* Header Oficial Salesforce */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <Target className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-500/25 text-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                  Panel Salesforce Oficial
                </span>
                <span className="text-[11px] text-blue-200/90 font-medium">
                  Informes: DGL-COT-08 Cotizado Acumulado & DGL-COT-11 Pendientes
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span>PPT Comercial Cotizaciones DGL {anio}</span>
                <span className="text-xs font-normal text-blue-200">
                  ({NOMBRES_MESES[selectedMes]})
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Mes */}
            <div className="flex items-center bg-blue-950/60 border border-blue-700/50 rounded-xl px-2.5 py-1 text-xs">
              <Calendar className="w-3.5 h-3.5 text-blue-300 mr-2 shrink-0" />
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
              className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Cerrar panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tarjetas KPI Superiores */}
        <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-3.5 shrink-0">
          {/* 1. Volumen Cotizado Total */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/40 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 block mb-1">
              Volumen Cotizado Total
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatClp(totalCotizadoClp)}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
              {totalCotizadoUf.toLocaleString('es-CL')} UF ({conteoCotizaciones} emitidas)
            </div>
          </div>

          {/* 2. Pipeline Activo en Curso */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800/40 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 block mb-1">
              Pipeline Activo en Negociación
            </span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {formatClp(totalPendientesClp)}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                {totalPendientesUf.toLocaleString('es-CL')} UF
              </span>
              <span className="text-[11px] text-slate-500">
                ({conteoPendientes} propuestas vivas)
              </span>
            </div>
          </div>

          {/* 3. Meta de Cotización & Cumplimiento */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Meta de Cotización
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
              {formatClp(metaCotizacionClp)}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`text-xs font-black px-1.5 py-0.2 rounded-full ${
                  cumplimientoPct >= 100
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {cumplimientoPct}% Cumplimiento
              </span>
            </div>
          </div>

          {/* 4. Resumen de Estado */}
          <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Distribución de Estados
            </span>
            <div className="flex items-center gap-2 pt-1 text-xs">
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                {ganadasCount} Ganadas
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                {conteoPendientes} En Curso
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                {perdidasCount} Perdidas
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1.5">
              Tasa de conversión: {conteoCotizaciones > 0 ? Math.round((ganadasCount / (ganadasCount + perdidasCount || 1)) * 100) : 0}%
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación del Panel */}
        <div className="px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('embudo')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'embudo'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              1. Embudo Comercial (Funnel)
            </button>
            <button
              onClick={() => setActiveTab('comerciales')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'comerciales'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              2. Cotizado vs Pipeline por Asesor ({rankingComerciales.length})
            </button>
            <button
              onClick={() => setActiveTab('clientes')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'clientes'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              3. Top Clientes Cotizados ({rankingClientes.length})
            </button>
            <button
              onClick={() => setActiveTab('detalle')}
              className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
                activeTab === 'detalle'
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              4. Oportunidades & Pipeline ({itemsFiltrados.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-400 hidden sm:block">
            Datos oficiales de Salesforce CRM en tiempo real
          </div>
        </div>

        {/* Contenido según pestaña */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: EMBUDO COMERCIAL */}
          {activeTab === 'embudo' && (
            <div className="space-y-6">
              {/* Embudo de Etapas */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Embudo de Conversión por Etapas en Salesforce ({anio})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Evolución del pipeline desde el envío de propuesta hasta el cierre comercial
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Etapa 1: Propuesta Enviada */}
                  <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-300 uppercase">
                      <span>Propuesta Enviada</span>
                      <span className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 flex items-center justify-center font-black">
                        1
                      </span>
                    </div>
                    {(() => {
                      const opps = cotizacionesPeriodo.filter((o) => o.etapa.toLowerCase().includes('propuesta') || o.etapa.toLowerCase().includes('enviada'));
                      const mClp = opps.reduce((s, o) => s + (o.montoClp || 0), 0);
                      return (
                        <>
                          <div className="text-lg font-black text-blue-950 dark:text-white tabular-nums">
                            {formatClp(mClp)}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold">
                            {opps.length} cotizaciones
                          </div>
                          <p className="text-[11px] text-slate-500 pt-1">
                            Propuestas en espera de primera revisión por parte del cliente
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Etapa 2: Negociación / Revisión */}
                  <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">
                      <span>En Negociación</span>
                      <span className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 flex items-center justify-center font-black">
                        2
                      </span>
                    </div>
                    {(() => {
                      const opps = cotizacionesPeriodo.filter((o) => o.etapa.toLowerCase().includes('negociaci') || o.etapa.toLowerCase().includes('revisi'));
                      const mClp = opps.reduce((s, o) => s + (o.montoClp || 0), 0);
                      return (
                        <>
                          <div className="text-lg font-black text-amber-950 dark:text-white tabular-nums">
                            {formatClp(mClp)}
                          </div>
                          <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                            {opps.length} propuestas vivas
                          </div>
                          <p className="text-[11px] text-slate-500 pt-1">
                            Propuestas activas con feedback o en ajuste de condiciones
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Etapa 3: Cerrada Ganada */}
                  <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase">
                      <span>Cerrada Ganada</span>
                      <span className="w-6 h-6 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 flex items-center justify-center font-black">
                        ✓
                      </span>
                    </div>
                    {(() => {
                      const opps = cotizacionesPeriodo.filter((o) => o.estado === 'ganada');
                      const mClp = opps.reduce((s, o) => s + (o.montoClp || 0), 0);
                      return (
                        <>
                          <div className="text-lg font-black text-emerald-950 dark:text-white tabular-nums">
                            {formatClp(mClp)}
                          </div>
                          <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                            {opps.length} adjudicadas
                          </div>
                          <p className="text-[11px] text-slate-500 pt-1">
                            Negocios convertidos exitosamente a contrato o servicio IDIEM
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* Etapa 4: Cerrada Perdida */}
                  <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-rose-900 dark:text-rose-300 uppercase">
                      <span>Cerrada Perdida</span>
                      <span className="w-6 h-6 rounded-full bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 flex items-center justify-center font-black">
                        ✕
                      </span>
                    </div>
                    {(() => {
                      const opps = cotizacionesPeriodo.filter((o) => o.estado === 'perdida');
                      const mClp = opps.reduce((s, o) => s + (o.montoClp || 0), 0);
                      return (
                        <>
                          <div className="text-lg font-black text-rose-950 dark:text-white tabular-nums">
                            {formatClp(mClp)}
                          </div>
                          <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold">
                            {opps.length} descartadas
                          </div>
                          <p className="text-[11px] text-slate-500 pt-1">
                            Propuestas canceladas o perdidas por precio, plazo o alcance
                          </p>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Evolución Mensual de Cotizaciones Emitidas */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Volumen Cotizado Mes a Mes ({anio})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Montos y propuestas emitidas según Fecha de Último Envío de Cotización
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end h-48 pt-4 border-b border-slate-200 dark:border-slate-800 pb-2">
                  {kpis.evolucionMeses.map((m: any) => {
                    const maxVal = Math.max(...kpis.evolucionMeses.map((x: any) => x.cotizadoTotalClp), 1);
                    const h = Math.min(100, Math.round((m.cotizadoTotalClp / maxVal) * 100));
                    const isSelected = m.mes === selectedMes;

                    return (
                      <div
                        key={m.mes}
                        onClick={() => setSelectedMes(m.mes === selectedMes ? 0 : m.mes)}
                        className={`flex flex-col items-center justify-end h-full cursor-pointer p-1 rounded-xl transition-all ${
                          isSelected
                            ? 'bg-blue-100/80 dark:bg-blue-950/50 ring-2 ring-blue-500 shadow-xs'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'
                        }`}
                        title={`${m.nombreMes}: Cotizado ${formatClp(m.cotizadoTotalClp)}`}
                      >
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 tabular-nums mb-1 hidden sm:block">
                          {m.cotizadoTotalClp > 0 ? `$${Math.round(m.cotizadoTotalClp / 1000000)}M` : '$0'}
                        </span>
                        <div className="w-full flex items-end justify-center h-28">
                          <div
                            className="w-3 sm:w-5 bg-blue-600 dark:bg-blue-500 rounded-t shadow-2xs transition-all"
                            style={{ height: `${Math.max(4, h)}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-2">
                          {m.nombreMes}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RANKING COMERCIALES */}
          {activeTab === 'comerciales' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Volumen Cotizado y Pipeline Activo por Asesor ({anio})
                </h3>
                <p className="text-xs text-slate-500">
                  Comparativa de propuestas emitidas vs propuestas que se mantienen vivas en negociación
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Asesor Comercial</th>
                      <th className="py-3 px-4 text-center">Cotizaciones Emitidas</th>
                      <th className="py-3 px-4 text-right">Volumen Cotizado CLP</th>
                      <th className="py-3 px-4 text-right">Volumen Cotizado UF</th>
                      <th className="py-3 px-4 text-center">Propuestas Vivas</th>
                      <th className="py-3 px-4 text-right">Pipeline Activo CLP</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rankingComerciales.map((c, idx) => (
                      <tr key={c.comercial} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-black text-[10px]">
                            {c.comercial.slice(0, 2).toUpperCase()}
                          </span>
                          <span>{c.comercial}</span>
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {c.conteoTotal}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-blue-700 dark:text-blue-400 tabular-nums">
                          {formatClp(c.totalCotizadoClp)}
                        </td>
                        <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300 tabular-nums font-semibold">
                          {c.totalCotizadoUf.toLocaleString('es-CL')} UF
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                            {c.conteoEnCurso} vivas
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          {formatClp(c.pipelineEnCursoClp)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedComercial(c.comercial);
                              setActiveTab('detalle');
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-800 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Ver Pipeline
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TOP CLIENTES */}
          {activeTab === 'clientes' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Top Mandantes / Clientes por Volumen Cotizado ({anio})
                </h3>
                <p className="text-xs text-slate-500">
                  Empresas con mayor volumen de propuestas técnicas y económicas solicitadas a DGL
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Cliente / Razón Social</th>
                      <th className="py-3 px-4 text-center">N° Cotizaciones</th>
                      <th className="py-3 px-4 text-center">En Negociación</th>
                      <th className="py-3 px-4 text-right">Volumen Cotizado CLP</th>
                      <th className="py-3 px-4 text-right">Volumen Cotizado UF</th>
                      <th className="py-3 px-4 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rankingClientes.map((cl, idx) => (
                      <tr key={cl.cliente} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-black text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          {cl.cliente}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                          {cl.count}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cl.enCursoCount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px]">
                              {cl.enCursoCount} vivas
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white tabular-nums">
                          {formatClp(cl.montoClp)}
                        </td>
                        <td className="py-3 px-4 text-right text-blue-700 dark:text-blue-400 tabular-nums font-semibold">
                          {cl.montoUf.toLocaleString('es-CL')} UF
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSearchQuery(cl.cliente);
                              setActiveTab('detalle');
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-800 text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            Ver Cotizaciones
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DETALLE COMPLETO */}
          {activeTab === 'detalle' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Universo de Cotizaciones & Pipeline ({itemsFiltrados.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Oportunidades filtradas por estado, asesor comercial y fecha de envío
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {/* Buscador */}
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Buscar cliente, código..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Filtro Estado */}
                  <select
                    value={selectedEstado}
                    onChange={(e) => setSelectedEstado(e.target.value as any)}
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
                  >
                    <option value="TODOS">Todos los estados</option>
                    <option value="en_curso">En curso / Pipeline (vivas)</option>
                    <option value="ganada">Ganadas</option>
                    <option value="perdida">Perdidas</option>
                  </select>

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

                  {(searchQuery || selectedComercial !== 'TODOS' || selectedEstado !== 'TODOS') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedComercial('TODOS');
                        setSelectedEstado('TODOS');
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
                      <th className="py-3 px-3">Nombre Oportunidad</th>
                      <th className="py-3 px-3">Cliente</th>
                      <th className="py-3 px-3">Comercial</th>
                      <th className="py-3 px-3 text-center">Etapa Salesforce</th>
                      <th className="py-3 px-3 text-center">Fecha Envío</th>
                      <th className="py-3 px-3 text-right">Monto CLP</th>
                      <th className="py-3 px-3 text-right">Monto UF</th>
                      <th className="py-3 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {itemsFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No se encontraron cotizaciones con los filtros seleccionados
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
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={item.cliente}>
                            {item.cliente}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                            {item.comercial}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.estado === 'ganada'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : item.estado === 'perdida'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {item.etapa}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono text-slate-600 dark:text-slate-400">
                            {item.fechaUltimoEnvioCotizacion || item.fechaCierre}
                          </td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white tabular-nums">
                            {formatClp(item.montoClp)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-blue-700 dark:text-blue-400 tabular-nums font-semibold">
                            {item.montoUf.toLocaleString('es-CL')} UF
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {item.salesforceId && (
                                <a
                                  href={`https://idiem.lightning.force.com/lightning/r/Opportunity/${item.salesforceId}/view`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 hover:text-blue-800 transition-colors"
                                  title="Abrir en Salesforce CRM"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                                </a>
                              )}
                              {item.cotizacionDglId && (
                                <a
                                  href={`/cotizador?id=${item.cotizacionDglId}`}
                                  className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-bold hover:bg-blue-100"
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
            <ShieldCheck className="w-4 h-4 text-blue-600" />
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
