'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import { Cotizacion, CENTROS_DE_COSTO } from '@/lib/types';
import CierreOportunidadModal from '@/components/salesforce/CierreOportunidadModal';
import Link from 'next/link';
import {
  Trophy,
  XCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  Search,
  Building2,
  Calendar,
  ExternalLink,
  Eye,
  Loader2,
  ArrowRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  FileSpreadsheet,
  Clock,
} from 'lucide-react';

function VentasContent() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCc, setSelectedCc] = useState<string>('todos');
  const [activeTab, setActiveTab] = useState<'por_cerrar' | 'ganadas' | 'perdidas'>('por_cerrar');

  // Modal de Cierre
  const [cierreModalQuote, setCierreModalQuote] = useState<Cotizacion | null>(null);
  const [showGlobalCierreModal, setShowGlobalCierreModal] = useState(false);

  const loadData = () => {
    setLoading(true);
    fetch('/api/cotizaciones')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.cotizaciones && Array.isArray(d.cotizaciones)) {
          const sorted = [...d.cotizaciones].sort((a, b) => {
            const timeA = new Date(a.createdAt || a.date).getTime();
            const timeB = new Date(b.createdAt || b.date).getTime();
            return timeB - timeA;
          });
          setCotizaciones(sorted);
        }
      })
      .catch((err) => console.error('Error cargando cotizaciones para ventas:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Métricas de ventas
  const metrics = useMemo(() => {
    let porCerrarCount = 0;
    let porCerrarUf = 0;
    let porCerrarClp = 0;

    let ganadasCount = 0;
    let ganadasUf = 0;
    let ganadasClp = 0;

    let perdidasCount = 0;
    let totalCuotasCount = 0;

    cotizaciones.forEach((c) => {
      const st = c.status || 'Borrador';
      if (st === 'Ganada') {
        ganadasCount++;
        const closeUf = c.cierreNegocio?.montoCierreUf ?? c.totalUf ?? 0;
        const closeClp = c.cierreNegocio?.montoCierreClp ?? c.totalClp ?? 0;
        ganadasUf += closeUf;
        ganadasClp += closeClp;
        totalCuotasCount += c.cierreNegocio?.cuotasFacturacion || 1;
      } else if (st === 'Perdida') {
        perdidasCount++;
      } else if (st === 'Enviada' || st === 'Finalizada' || st === 'Aprobada') {
        porCerrarCount++;
        porCerrarUf += c.totalUf || 0;
        porCerrarClp += c.totalClp || 0;
      }
    });

    const totalCerradas = ganadasCount + perdidasCount;
    const tasaCierre = totalCerradas > 0 ? Math.round((ganadasCount / totalCerradas) * 100) : 0;

    return {
      porCerrarCount,
      porCerrarUf: Math.round(porCerrarUf * 100) / 100,
      porCerrarClp: Math.round(porCerrarClp),
      ganadasCount,
      ganadasUf: Math.round(ganadasUf * 100) / 100,
      ganadasClp: Math.round(ganadasClp),
      perdidasCount,
      totalCuotasCount,
      tasaCierre,
    };
  }, [cotizaciones]);

  // Lista filtrada
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return cotizaciones.filter((c) => {
      const st = c.status || 'Borrador';

      // Filtro por Tab
      if (activeTab === 'por_cerrar') {
        if (st !== 'Enviada' && st !== 'Finalizada' && st !== 'Aprobada') return false;
      } else if (activeTab === 'ganadas') {
        if (st !== 'Ganada') return false;
      } else if (activeTab === 'perdidas') {
        if (st !== 'Perdida') return false;
      }

      // Filtro por Centro de Costo
      if (selectedCc !== 'todos') {
        const quoteCcNum = c.centroCosto ? c.centroCosto.slice(0, 4) : c.code.split('.')[2] || '';
        const targetCcNum = selectedCc.slice(0, 4);
        if (quoteCcNum !== targetCcNum) return false;
      }

      // Búsqueda de texto
      if (q) {
        return (
          c.code.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          (c.projectName && c.projectName.toLowerCase().includes(q)) ||
          (c.commercialName && c.commercialName.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [cotizaciones, activeTab, selectedCc, search]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Cabecera del Módulo */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/50">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Módulo de Ventas & Cierre de Oportunidades
                </h1>
                <p className="text-xs text-slate-500">
                  Cierre comercial de propuestas, proyección de cuotas de facturación y sincronización directa con Salesforce
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowGlobalCierreModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs hover:shadow-sm transition-all cursor-pointer"
            >
              <Trophy className="w-4 h-4" />
              <span>🏆 Cerrar Oportunidad (Buscar Propuesta)</span>
            </button>

            <Link
              href="/cotizaciones"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all shadow-xs"
              title="Ir al Historial Completo de Cotizaciones"
            >
              <span>Historial Completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Tarjetas KPIs Ejecutivos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: En Negociación / Por Cerrar */}
          <div
            onClick={() => setActiveTab('por_cerrar')}
            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-blue-300 ${
              activeTab === 'por_cerrar' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20' : 'border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Por Cerrar / Negociación</span>
              <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {metrics.porCerrarUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-sm font-semibold text-slate-500">UF</span>
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono">
                ~${metrics.porCerrarClp.toLocaleString('es-CL')} CLP{' '}
                <span className="text-blue-700 font-sans font-bold">({metrics.porCerrarCount} activas)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Ventas Ganadas */}
          <div
            onClick={() => setActiveTab('ganadas')}
            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-emerald-300 ${
              activeTab === 'ganadas' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20' : 'border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Ventas Ganadas (SF)</span>
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Trophy className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
                {metrics.ganadasUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <span className="text-sm font-semibold text-emerald-600">UF</span>
              </div>
              <div className="text-xs text-emerald-700 mt-1 font-mono">
                ~${metrics.ganadasClp.toLocaleString('es-CL')} CLP{' '}
                <span className="font-bold">({metrics.ganadasCount} adjudicadas)</span>
              </div>
            </div>
          </div>

          {/* Card 3: Cuotas Programadas */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Cuotas de Facturación</span>
              <span className="p-2 bg-purple-50 text-purple-700 rounded-xl">
                <Layers className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-purple-900 font-mono tracking-tight">
                {metrics.totalCuotasCount} <span className="text-sm font-semibold text-purple-600">cuotas</span>
              </div>
              <div className="text-xs text-purple-700 mt-1">
                Programadas en <span className="font-semibold text-purple-900">Salesforce</span>
              </div>
            </div>
          </div>

          {/* Card 4: Tasa de Éxito / Pérdidas */}
          <div
            onClick={() => setActiveTab('perdidas')}
            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-rose-300 ${
              activeTab === 'perdidas' ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/20' : 'border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Efectividad & Pérdidas</span>
              <span className="p-2 bg-rose-50 text-rose-700 rounded-xl">
                <XCircle className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {metrics.tasaCierre}% <span className="text-sm font-semibold text-slate-500">tasa éxito</span>
              </div>
              <div className="text-xs text-rose-600 mt-1 font-semibold">
                {metrics.perdidasCount} propuestas perdidas
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Tabs de Navegación */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs mb-6 space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('por_cerrar')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'por_cerrar'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Por Cerrar ({metrics.porCerrarCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ganadas')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ganadas'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>Ganadas ({metrics.ganadasCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('perdidas')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'perdidas'
                    ? 'bg-white text-rose-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Perdidas ({metrics.perdidasCount})</span>
              </button>
            </div>

            {/* Búsqueda y Filtro de CC */}
            <div className="flex items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por código, cliente o proyecto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <select
                value={selectedCc}
                onChange={(e) => setSelectedCc(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
              >
                <option value="todos">🏢 Todos los CC</option>
                {CENTROS_DE_COSTO.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc.split(' - ')[0]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de Propuestas de Negocio */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-500">Cargando propuestas de venta...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No hay propuestas en esta vista</p>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'por_cerrar'
                  ? 'No hay propuestas en negociación pendientes de cierre.'
                  : activeTab === 'ganadas'
                  ? 'No hay ventas cerradas ganadas aún.'
                  : 'No hay propuestas marcadas como perdidas.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3">Código</th>
                    <th className="py-3 px-3">Cliente / Razón Social</th>
                    <th className="py-3 px-3">Proyecto</th>
                    <th className="py-3 px-2 text-center">CC</th>
                    <th className="py-3 px-3 text-right">Monto Oferta</th>
                    {activeTab === 'ganadas' && <th className="py-3 px-3 text-right">Monto Cierre (SF)</th>}
                    {activeTab === 'ganadas' && <th className="py-3 px-3 text-center">Cuotas SF</th>}
                    {activeTab === 'perdidas' && <th className="py-3 px-3 text-left">Motivo de Rechazo</th>}
                    <th className="py-3 px-3 text-center">Estado</th>
                    <th className="py-3 px-3 text-center">Acciones de Cierre</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => {
                    const isGanada = c.status === 'Ganada';
                    const isPerdida = c.status === 'Perdida';
                    const cierre = c.cierreNegocio;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Código */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 text-[11px]">
                          <Link
                            href={`/cotizador?edit=${c.id}`}
                            className="hover:text-blue-600 hover:underline"
                            title="Ver / Editar propuesta"
                          >
                            {c.code}
                          </Link>
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900 max-w-[200px] truncate" title={c.clientName}>
                            {c.clientName}
                          </div>
                          {c.clientRut && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              RUT: {c.clientRut}
                            </div>
                          )}
                        </td>

                        {/* Proyecto */}
                        <td className="py-3 px-3 text-slate-700 max-w-[180px] truncate" title={c.projectName || ''}>
                          {c.projectName || <span className="text-slate-400 italic">No especificado</span>}
                        </td>

                        {/* CC */}
                        <td className="py-3 px-2 text-center font-mono font-bold text-[10px] text-slate-600">
                          {c.centroCosto ? c.centroCosto.split(' - ')[0] : '1817'}
                        </td>

                        {/* Monto Oferta */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          <div>{c.totalUf} UF</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            ${c.totalClp?.toLocaleString('es-CL')}
                          </div>
                        </td>

                        {/* Monto Cierre si es Ganada */}
                        {activeTab === 'ganadas' && (
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800">
                            <div>{cierre?.montoCierreUf ?? c.totalUf} UF</div>
                            <div className="text-[10px] text-emerald-600 font-medium">
                              ${(cierre?.montoCierreClp ?? c.totalClp)?.toLocaleString('es-CL')}
                            </div>
                          </td>
                        )}

                        {/* Cuotas si es Ganada */}
                        {activeTab === 'ganadas' && (
                          <td className="py-3 px-3 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                              <Layers className="w-3 h-3" />
                              <span>{cierre?.cuotasFacturacion || 1} cuota(s)</span>
                            </span>
                          </td>
                        )}

                        {/* Motivo si es Perdida */}
                        {activeTab === 'perdidas' && (
                          <td className="py-3 px-3">
                            <span className="font-semibold text-rose-700 text-[11px] block max-w-[220px] truncate" title={cierre?.motivoRechazo || 'Rechazada'}>
                              {cierre?.motivoRechazo || 'Sin especificar'}
                            </span>
                            {cierre?.fechaCierre && (
                              <span className="text-[10px] text-slate-400">
                                Fecha: {cierre.fechaCierre}
                              </span>
                            )}
                          </td>
                        )}

                        {/* Estado */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            isGanada
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : isPerdida
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {c.status || 'Borrador'}
                          </span>
                        </td>

                        {/* Acciones de Cierre */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Botón Cierre / Editar Cierre */}
                            <button
                              type="button"
                              onClick={() => setCierreModalQuote(c)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                                isGanada
                                  ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300'
                                  : isPerdida
                                  ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              }`}
                            >
                              <Trophy className="w-3 h-3" />
                              <span>{isGanada ? 'Ver Cuotas' : isPerdida ? 'Ver Pérdida' : 'Cerrar Venta'}</span>
                            </button>

                            {/* Enlace directo a Salesforce si está sincronizada */}
                            {c.salesforceOpportunityUrl && (
                              <a
                                href={c.salesforceOpportunityUrl}
                                target="_blank"
                                rel="noreferrer"
                                title="Ver Oportunidad en Salesforce"
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Cierre de Cotización Específica */}
        {cierreModalQuote && (
          <CierreOportunidadModal
            isOpen={Boolean(cierreModalQuote)}
            onClose={() => setCierreModalQuote(null)}
            cotizacion={cierreModalQuote}
            onSuccess={(updated) => {
              setCotizaciones((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item))
              );
              setCierreModalQuote(null);
            }}
          />
        )}

        {/* Modal de Cierre Global (con selector de cotización) */}
        {showGlobalCierreModal && (
          <CierreOportunidadModal
            isOpen={showGlobalCierreModal}
            onClose={() => setShowGlobalCierreModal(false)}
            onSuccess={(updated) => {
              setCotizaciones((prev) =>
                prev.map((item) => (item.id === updated.id ? updated : item))
              );
              setShowGlobalCierreModal(false);
            }}
          />
        )}
      </main>
    </div>
  );
}

export default function VentasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#E20000] animate-spin" />
        </div>
      }
    >
      <VentasContent />
    </Suspense>
  );
}

