'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import { Cotizacion, SessionUser, CENTROS_DE_COSTO } from '@/lib/types';
import { hasPermission } from '@/lib/permissions';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Trash2,
  Plus,
  Edit3,
  Eye,
  X,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Clock,
  Send,
  Lock,
  ChevronDown,
  Filter,
  Building2,
  TableProperties,
  ExternalLink,
  FileText,
} from 'lucide-react';

function CotizacionesContent() {
  const searchParams = useSearchParams();
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCc, setSelectedCc] = useState<string>('todos');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const [previewCotizacion, setPreviewCotizacion] = useState<Cotizacion | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);

  // Leer parámetros de búsqueda de la URL al montar el componente
  useEffect(() => {
    const proj = searchParams.get('project');
    const q = searchParams.get('search');
    if (proj) {
      setSelectedProject(proj);
    } else if (q) {
      if (q.startsWith('PRY-')) {
        setSelectedProject(q);
      } else {
        setSearch(q);
      }
    }
  }, [searchParams]);

  // Cerrar modal al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewCotizacion(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadData = () => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      });

    fetch('/api/cotizaciones')
      .then((res) => res.json())
      .then((d) => {
        if (d.cotizaciones) setCotizaciones(d.cotizaciones);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Conjunto de datos filtrados
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    return cotizaciones.filter((c) => {
      // Filtro por Centro de Costo (CC)
      if (selectedCc !== 'todos') {
        const quoteCcNum = c.centroCosto ? c.centroCosto.slice(0, 4) : c.code.split('.')[2] || '';
        const targetCcNum = selectedCc.slice(0, 4);
        if (quoteCcNum !== targetCcNum) return false;
      }

      // Filtro por Estado Comercial
      if (statusFilter !== 'todos') {
        if ((c.status || 'Borrador') !== statusFilter) return false;
      }

      // Filtro por Proyecto (vía clic en etiqueta o ID)
      if (selectedProject) {
        const matchesProjId = c.projectId && c.projectId.toLowerCase() === selectedProject.toLowerCase();
        const matchesProjName = c.projectName && c.projectName.toLowerCase() === selectedProject.toLowerCase();
        if (!matchesProjId && !matchesProjName) return false;
      }

      // Búsqueda por texto libre
      if (q) {
        const matches =
          c.code.toLowerCase().includes(q) ||
          c.clientName.toLowerCase().includes(q) ||
          (c.projectName && c.projectName.toLowerCase().includes(q)) ||
          (c.projectId && c.projectId.toLowerCase().includes(q)) ||
          (c.createdBy && c.createdBy.toLowerCase().includes(q)) ||
          (c.commercialName && c.commercialName.toLowerCase().includes(q)) ||
          (c.clientRut && c.clientRut.toLowerCase().includes(q));
        if (!matches) return false;
      }

      return true;
    });
  }, [cotizaciones, search, selectedCc, statusFilter, selectedProject]);

  // Métricas ejecutivas y comerciales
  const metrics = useMemo(() => {
    // Calcular métricas según el CC seleccionado (o todos)
    const baseList = selectedCc === 'todos'
      ? cotizaciones
      : cotizaciones.filter((c) => {
          const quoteCcNum = c.centroCosto ? c.centroCosto.slice(0, 4) : c.code.split('.')[2] || '';
          return quoteCcNum === selectedCc.slice(0, 4);
        });

    let totalUf = 0;
    let totalClp = 0;
    let aprobadasCount = 0;
    let aprobadasUf = 0;
    let enviadasCount = 0;
    let enviadasUf = 0;
    let finalizadasCount = 0;
    let borradoresCount = 0;
    let rechazadasCount = 0;

    baseList.forEach((c) => {
      totalUf += c.totalUf || 0;
      totalClp += c.totalClp || 0;

      const st = c.status || 'Borrador';
      if (st === 'Aprobada') {
        aprobadasCount++;
        aprobadasUf += c.totalUf || 0;
      } else if (st === 'Enviada') {
        enviadasCount++;
        enviadasUf += c.totalUf || 0;
      } else if (st === 'Finalizada') {
        finalizadasCount++;
        enviadasUf += c.totalUf || 0;
      } else if (st === 'Borrador') {
        borradoresCount++;
      } else if (st === 'Rechazada') {
        rechazadasCount++;
      }
    });

    return {
      totalCount: baseList.length,
      totalUf: Math.round(totalUf * 100) / 100,
      totalClp: Math.round(totalClp),
      aprobadasCount,
      aprobadasUf: Math.round(aprobadasUf * 100) / 100,
      enviadasCount,
      enviadasUf: Math.round(enviadasUf * 100) / 100,
      finalizadasCount,
      borradoresCount,
      rechazadasCount,
    };
  }, [cotizaciones, selectedCc]);

  // Manejador de cambio de estado comercial
  const handleStatusChange = async (id: string, newStatus: Cotizacion['status']) => {
    setUpdatingStatusId(id);
    try {
      const res = await fetch(`/api/cotizaciones/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCotizaciones((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
        );
      } else {
        const d = await res.json();
        alert(d.error || 'Error al actualizar el estado de la cotización.');
      }
    } catch {
      alert('Error de conexión con el servidor.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`¿Estás seguro de eliminar la cotización ${code}?`)) return;

    try {
      const res = await fetch(`/api/cotizaciones/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setCotizaciones((prev) => prev.filter((c) => c.id !== id));
      } else {
        alert(data?.error || 'Error al eliminar la cotización.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {/* Header Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Historial de Cotizaciones
              </h1>
              <span className="bg-red-50 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200">
                {cotizaciones.length} registradas
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Registro y seguimiento comercial centralizado de propuestas emitidas por el equipo DGL.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/clientes"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-xs"
              title="Directorio unificado de Empresas, Contactos y Proyectos"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Clientes & CRM</span>
            </Link>

            <Link
              href="/tarifario"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 transition-colors shadow-xs"
              title="Consultar Catálogo de Ensayos Acreditados"
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Tarifario</span>
            </Link>

            <Link
              href="/cotizador"
              className="flex items-center gap-2 bg-[#E20000] hover:bg-[#C20000] text-white px-4 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cotización</span>
            </Link>
          </div>
        </div>

        {/* Dashboard de Métricas y KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Cotizado */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cotizado</span>
              <span className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-slate-900 font-mono">
                {metrics.totalUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                ~${metrics.totalClp.toLocaleString('es-CL')} CLP ({metrics.totalCount} propuestas)
              </div>
            </div>
          </div>

          {/* Card 2: Aprobadas */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Aprobada' ? 'todos' : 'Aprobada')}
            className={`bg-white rounded-xl p-4 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-emerald-300 ${
              statusFilter === 'Aprobada' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20' : 'border-slate-200'
            }`}
            title="Clic para filtrar solo aprobadas"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Aprobadas / Éxito</span>
              <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-emerald-800 font-mono">
                {metrics.aprobadasUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF
              </div>
              <div className="text-xs text-emerald-700/90 mt-0.5 flex items-center justify-between">
                <span>{metrics.aprobadasCount} aprobadas</span>
                <span className="font-semibold">
                  {metrics.totalCount > 0 ? `${Math.round((metrics.aprobadasCount / metrics.totalCount) * 100)}% tasa` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: En Seguimiento */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Enviada' ? 'todos' : 'Enviada')}
            className={`bg-white rounded-xl p-4 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-purple-300 ${
              statusFilter === 'Enviada' ? 'ring-2 ring-purple-500 border-purple-500 bg-purple-50/20' : 'border-slate-200'
            }`}
            title="Clic para filtrar cotizaciones enviadas"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">En Seguimiento</span>
              <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
                <Send className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-purple-900 font-mono">
                {metrics.enviadasUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF
              </div>
              <div className="text-xs text-purple-700/80 mt-0.5">
                {metrics.enviadasCount} enviadas / {metrics.finalizadasCount} finalizadas
              </div>
            </div>
          </div>

          {/* Card 4: Borradores y Rechazadas */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Borrador' ? 'todos' : 'Borrador')}
            className={`bg-white rounded-xl p-4 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-amber-300 ${
              statusFilter === 'Borrador' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20' : 'border-slate-200'
            }`}
            title="Clic para filtrar borradores"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Borradores</span>
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-amber-900 font-mono">
                {metrics.borradoresCount} pendientes
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {metrics.rechazadasCount > 0 ? `${metrics.rechazadasCount} descartadas / rechazadas` : 'Sin cotizaciones descartadas'}
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm mb-6 space-y-3">
          <div className="flex flex-col md:flex-row items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código, cliente, proyecto, PRY-XXXX o comercial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Centro de Costo Filter */}
            <div className="w-full md:w-64">
              <select
                value={selectedCc}
                onChange={(e) => setSelectedCc(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="todos">Todos los Centros de Costo</option>
                {CENTROS_DE_COSTO.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2 px-3 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="todos">Todos los Estados</option>
                <option value="Borrador">🟡 Borrador</option>
                <option value="Finalizada">🔵 Finalizada</option>
                <option value="Enviada">📨 Enviada</option>
                <option value="Aprobada">🟢 Aprobada</option>
                <option value="Rechazada">🔴 Rechazada</option>
              </select>
            </div>
          </div>

          {/* Active Project Filter Tag */}
          {selectedProject && (
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Filtrando por obra/proyecto:
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-blue-100 text-blue-900 px-2.5 py-0.5 rounded-full border border-blue-200">
                <Lock className="w-3 h-3 text-blue-700" />
                {selectedProject}
                <button
                  type="button"
                  onClick={() => setSelectedProject('')}
                  className="hover:text-red-600 cursor-pointer ml-1"
                  title="Quitar filtro de proyecto"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 w-44">Código</th>
                  <th className="py-3.5 px-4">Cliente / Razón Social</th>
                  <th className="py-3.5 px-4">Proyecto / Obra</th>
                  <th className="py-3.5 px-3 w-24 text-center">Fecha</th>
                  <th className="py-3.5 px-4 w-28 text-right">Total UF</th>
                  <th className="py-3.5 px-4 w-32 text-right">Total CLP</th>
                  <th className="py-3.5 px-4 w-36 text-center">Estado Comercial</th>
                  <th className="py-3.5 px-4 w-32">Comercial</th>
                  <th className="py-3.5 px-4 w-32 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Cargando cotizaciones...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-500">
                      No se encontraron cotizaciones con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Código */}
                      <td className="py-3.5 px-4 font-mono text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Link
                            href={`/cotizador?edit=${c.id}`}
                            className="font-bold text-blue-950 hover:text-blue-700 hover:underline cursor-pointer"
                            title="Editar cotización / Crear nueva versión"
                          >
                            {c.code}
                          </Link>
                          {c.code.match(/[-_.\s]V\d+$/i) && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] tracking-tight">
                              {c.code.match(/V\d+$/i)?.[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">{c.clientName}</div>
                        {c.clientRut && (
                          <div className="text-xs text-slate-400 font-mono">RUT: {c.clientRut}</div>
                        )}
                      </td>

                      {/* Proyecto con Badge PRY-XXXX */}
                      <td className="py-3.5 px-4 text-xs">
                        <div className="font-medium text-slate-800">
                          {c.projectName || <span className="text-slate-400 italic">No indicado</span>}
                        </div>
                        {c.projectId && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              type="button"
                              onClick={() => setSelectedProject(c.projectId === selectedProject ? '' : c.projectId!)}
                              title="Filtrar todas las cotizaciones de este proyecto"
                              className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                            >
                              <Lock className="w-2.5 h-2.5 text-blue-600" />
                              <span>{c.projectId}</span>
                            </button>

                            <Link
                              href={`/clientes?tab=proyectos`}
                              title="Ver directorio de proyectos en el CRM"
                              className="p-0.5 text-slate-400 hover:text-blue-700 transition-colors inline-flex items-center"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </Link>
                          </div>
                        )}
                      </td>

                      {/* Fecha */}
                      <td className="py-3.5 px-3 text-center text-xs text-slate-500">
                        {c.date ? new Date(c.date).toLocaleDateString('es-CL') : '-'}
                      </td>

                      {/* Total UF */}
                      <td className="py-3.5 px-4 text-right font-bold font-mono text-slate-900">
                        {c.currency === 'USD'
                          ? `${(c.totalUsd || 0).toFixed(2)} USD`
                          : `${c.totalUf.toFixed(2)} UF`}
                      </td>

                      {/* Total CLP */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-xs">
                        ${c.totalClp.toLocaleString('es-CL')}
                      </td>

                      {/* Estado Comercial Interactivo */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="relative inline-block">
                          <select
                            value={c.status || 'Borrador'}
                            disabled={updatingStatusId === c.id}
                            onChange={(e) => handleStatusChange(c.id, e.target.value as Cotizacion['status'])}
                            className={`appearance-none pl-2 pr-6 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors ${
                              c.status === 'Aprobada'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : c.status === 'Finalizada'
                                ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                                : c.status === 'Enviada'
                                ? 'bg-purple-50 text-purple-800 border-purple-300 hover:bg-purple-100'
                                : c.status === 'Rechazada'
                                ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            <option value="Borrador">🟡 Borrador</option>
                            <option value="Finalizada">🔵 Finalizada</option>
                            <option value="Enviada">📨 Enviada</option>
                            <option value="Aprobada">🟢 Aprobada</option>
                            <option value="Rechazada">🔴 Rechazada</option>
                          </select>
                          {updatingStatusId === c.id ? (
                            <Loader2 className="w-2.5 h-2.5 text-slate-500 animate-spin absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5 text-slate-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          )}
                        </div>
                      </td>

                      {/* Comercial */}
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{c.createdBy}</span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Editar */}
                          <Link
                            href={`/cotizador?edit=${c.id}`}
                            title="Editar cotización (crear versión V2/V3)"
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Link>

                          {/* Visualizar */}
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewLoading(true);
                              setPreviewCotizacion(c);
                            }}
                            title="Visualizar PDF (Vista previa)"
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Eliminar (protegido por permiso) */}
                          {hasPermission(user, 'cotizaciones.eliminar') && (
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id, c.code)}
                              title="Eliminar cotización"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

        {/* Modal Vista Previa PDF Embebido */}
        {previewCotizacion && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-blue-400">
                    {previewCotizacion.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      previewCotizacion.status === 'Finalizada' || previewCotizacion.status === 'Aprobada'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : previewCotizacion.status === 'Borrador'
                        ? 'bg-amber-950 text-amber-300 border border-amber-700'
                        : 'bg-blue-950 text-blue-300 border border-blue-700'
                    }`}
                  >
                    {previewCotizacion.status || 'Borrador'}
                  </span>
                  <span className="text-slate-400 text-xs hidden sm:inline">|</span>
                  <span className="text-xs text-slate-300 font-medium truncate max-w-xs sm:max-w-md">
                    {previewCotizacion.clientName}
                  </span>
                  {previewCotizacion.projectId && (
                    <span className="font-mono text-[10px] bg-blue-900/80 text-blue-200 px-2 py-0.5 rounded border border-blue-700 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" />
                      {previewCotizacion.projectId}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Descarga según estado: Borrador vs Oficial */}
                  {previewCotizacion.status === 'Borrador' ? (
                    <>
                      <a
                        href={`/api/cotizaciones/${previewCotizacion.id}/pdf?draft=true`}
                        download={`Borrador_${previewCotizacion.code}.pdf`}
                        className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        title="Descargar documento preliminar con marca de agua BORRADOR (estado permanece Borrador)"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Descargar Borrador (PDF)</span>
                      </a>

                      {hasPermission(user, 'cotizador.descargar_definitivo') && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`¿Desea cambiar el estado de ${previewCotizacion.code} a Finalizada y descargar el PDF oficial definitivo?`)) return;
                            await handleStatusChange(previewCotizacion.id, 'Finalizada');
                            setPreviewCotizacion((prev) => (prev ? { ...prev, status: 'Finalizada' } : null));
                            window.open(`/api/cotizaciones/${previewCotizacion.id}/pdf?draft=false`, '_blank');
                          }}
                          disabled={updatingStatusId === previewCotizacion.id}
                          className="flex items-center gap-1.5 bg-[#E20000] hover:bg-[#C20000] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          title="Cambia el estado a Finalizada y emite el documento oficial definitivo"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Finalizar y Descargar Oficial</span>
                        </button>
                      )}
                    </>
                  ) : (
                    <a
                      href={`/api/cotizaciones/${previewCotizacion.id}/pdf?draft=false`}
                      download={`Cotizacion_${previewCotizacion.code}.pdf`}
                      className="flex items-center gap-1.5 bg-[#E20000] hover:bg-[#C20000] text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      title="Descargar documento PDF oficial definitivo"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Descargar PDF Oficial</span>
                    </a>
                  )}

                  <Link
                    href={`/cotizador?edit=${previewCotizacion.id}`}
                    className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Versión</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => setPreviewCotizacion(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Cerrar (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Iframe de Vista Previa de PDF */}
              <div className="flex-1 bg-slate-100 relative">
                {previewLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
                    <Loader2 className="w-8 h-8 text-[#E20000] animate-spin mb-2" />
                    <span className="text-xs text-slate-500 font-medium">Generando vista previa del documento...</span>
                  </div>
                )}
                <iframe
                  src={`/api/cotizaciones/${previewCotizacion.id}/pdf?inline=true${
                    previewCotizacion.status === 'Borrador' ? '&draft=true' : '&draft=false'
                  }`}
                  className="w-full h-full border-0"
                  title={`Vista Previa ${previewCotizacion.code}`}
                  onLoad={() => setPreviewLoading(false)}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function CotizacionesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-[#E20000] animate-spin" />
        </div>
      }
    >
      <CotizacionesContent />
    </Suspense>
  );
}
