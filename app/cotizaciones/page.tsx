'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import { Cotizacion, SessionUser, CENTROS_DE_COSTO } from '@/lib/types';
import { hasPermission } from '@/lib/permissions';
import SalesforceStatusBadge from '@/components/salesforce/SalesforceStatusBadge';
import SalesforceSyncButton from '@/components/salesforce/SalesforceSyncButton';
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
  FileSpreadsheet,
  Database,
  CheckSquare,
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

  // Selección múltiple para eliminación en bloque
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

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
    setLoading(true);
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      });

    fetch('/api/cotizaciones')
      .then((res) => res.json())
      .then((d) => {
        if (d.cotizaciones && Array.isArray(d.cotizaciones)) {
          // Ordenar explícitamente de la más reciente a la más antigua
          const sorted = [...d.cotizaciones].sort((a, b) => {
            const timeA = new Date(a.createdAt || a.date).getTime();
            const timeB = new Date(b.createdAt || b.date).getTime();
            return timeB - timeA;
          });
          setCotizaciones(sorted);
        }
      })
      .catch((err) => console.error('Error cargando cotizaciones:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Conjunto de datos filtrados y rigurosamente ordenados por fecha descendente
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    const result = cotizaciones.filter((c) => {
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

    // Ordenar explícitamente: más reciente primero (createdAt descendente)
    return result.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date).getTime();
      const timeB = new Date(b.createdAt || b.date).getTime();
      return timeB - timeA;
    });
  }, [cotizaciones, search, selectedCc, statusFilter, selectedProject]);

  // Limpiar seleccionados que ya no existan en el filtro
  useEffect(() => {
    if (selectedIds.length > 0) {
      const validIds = new Set(cotizaciones.map((c) => c.id));
      setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    }
  }, [cotizaciones]);

  // Métricas ejecutivas y comerciales globales
  const metrics = useMemo(() => {
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

  // Métricas de las cotizaciones actualmente seleccionadas con checkbox
  const selectedMetrics = useMemo(() => {
    if (selectedIds.length === 0) return { count: 0, uf: 0, clp: 0 };
    const selectedCots = cotizaciones.filter((c) => selectedIds.includes(c.id));
    let uf = 0;
    let clp = 0;
    selectedCots.forEach((c) => {
      uf += c.totalUf || 0;
      clp += c.totalClp || 0;
    });
    return {
      count: selectedCots.length,
      uf: Math.round(uf * 100) / 100,
      clp: Math.round(clp),
    };
  }, [selectedIds, cotizaciones]);

  // Manejador de cambio individual de selección
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Manejador de selección total de la vista filtrada
  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length && filtered.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((c) => c.id));
    }
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

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

  // Eliminación individual
  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`¿Estás seguro de eliminar la cotización ${code}? Esta acción es permanente.`)) return;

    try {
      const res = await fetch(`/api/cotizaciones/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setCotizaciones((prev) => prev.filter((c) => c.id !== id));
        setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
      } else {
        alert(data?.error || 'Error al eliminar la cotización.');
      }
    } catch {
      alert('Error de conexión.');
    }
  };

  // Eliminación múltiple en bloque (Batch Delete)
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;

    const count = selectedIds.length;
    const msg =
      count === 1
        ? '¿Estás seguro de eliminar la cotización seleccionada? Esta acción es permanente.'
        : `¿Estás seguro de eliminar las ${count} cotizaciones seleccionadas? Esta acción es permanente e irreversible.`;

    if (!confirm(msg)) return;

    setIsDeletingBatch(true);
    try {
      const res = await fetch('/api/cotizaciones', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        const deletedIds: string[] = data.deletedIds || [];
        setCotizaciones((prev) => prev.filter((c) => !deletedIds.includes(c.id)));
        setSelectedIds([]);

        if (data.failed && data.failed.length > 0) {
          const failureReasons = data.failed.map((f: any) => `• ${f.reason}`).join('\n');
          alert(
            `Se eliminaron ${deletedIds.length} cotizaciones exitosamente.\n\nNo se pudieron eliminar ${data.failed.length}:\n${failureReasons}`
          );
        }
      } else {
        alert(data?.error || 'Error al eliminar las cotizaciones seleccionadas.');
      }
    } catch {
      alert('Error de conexión con el servidor.');
    } finally {
      setIsDeletingBatch(false);
    }
  };

  const hasActiveFilters = search || selectedCc !== 'todos' || statusFilter !== 'todos' || selectedProject;

  const clearAllFilters = () => {
    setSearch('');
    setSelectedCc('todos');
    setStatusFilter('todos');
    setSelectedProject('');
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col font-sans pb-16">
      <Navbar />

      <main className="w-full max-w-[98vw] 2xl:max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col">
        {/* Zona Superior: Encabezado Minimalista Ampliado */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                  Historial de Cotizaciones
                </h1>
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-slate-200">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>{cotizaciones.length} propuestas registradas</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Persistencia Supabase Activa
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1.5">
                Gestión, emisión oficial y seguimiento comercial de propuestas IDIEM DGL. Selecciona una o varias cotizaciones para administrarlas o eliminarlas.
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <SalesforceStatusBadge />

              <Link
                href="/clientes"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all shadow-xs"
                title="Directorio unificado de Empresas, Contactos y Proyectos"
              >
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Clientes CRM</span>
              </Link>

              <Link
                href="/tarifario"
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200 transition-all shadow-xs"
                title="Consultar Catálogo de Ensayos Acreditados"
              >
                <TableProperties className="w-4 h-4 text-slate-600" />
                <span>Tarifario Ensayos</span>
              </Link>

              <Link
                href="/cotizador"
                className="flex items-center gap-2 bg-[#E20000] hover:bg-[#C20000] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs hover:shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Cotización</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Zona de Métricas y KPIs Ejecutivos Minimalistas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Card 1: Total Cotizado */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cotizado</span>
              <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {metrics.totalUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-semibold text-slate-500">UF</span>
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono font-medium">
                ~${metrics.totalClp.toLocaleString('es-CL')} CLP <span className="text-slate-400 font-sans">({metrics.totalCount} propuestas)</span>
              </div>
            </div>
          </div>

          {/* Card 2: Aprobadas */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Aprobada' ? 'todos' : 'Aprobada')}
            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-emerald-300 ${
              statusFilter === 'Aprobada' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/20' : 'border-slate-200/90'
            }`}
            title="Filtrar solo cotizaciones aprobadas"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Aprobadas / Éxito</span>
              <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-800 font-mono tracking-tight">
                {metrics.aprobadasUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-semibold text-emerald-600">UF</span>
              </div>
              <div className="text-xs text-emerald-700 mt-1 flex items-center justify-between">
                <span>{metrics.aprobadasCount} aprobadas</span>
                <span className="font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
                  {metrics.totalCount > 0 ? `${Math.round((metrics.aprobadasCount / metrics.totalCount) * 100)}% tasa` : '0%'}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: En Seguimiento (Enviadas y Finalizadas) */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Enviada' ? 'todos' : 'Enviada')}
            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-blue-300 ${
              statusFilter === 'Enviada' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50/20' : 'border-slate-200/90'
            }`}
            title="Filtrar cotizaciones en seguimiento enviadas"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">En Seguimiento</span>
              <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                <Send className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-blue-900 font-mono tracking-tight">
                {metrics.enviadasUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-sm font-semibold text-blue-600">UF</span>
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {metrics.enviadasCount} enviadas / {metrics.finalizadasCount} emitidas
              </div>
            </div>
          </div>

          {/* Card 4: Borradores */}
          <div
            onClick={() => setStatusFilter(statusFilter === 'Borrador' ? 'todos' : 'Borrador')}
            className={`bg-white rounded-2xl p-5 border shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:border-amber-300 ${
              statusFilter === 'Borrador' ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20' : 'border-slate-200/90'
            }`}
            title="Filtrar borradores de cotización"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Borradores</span>
              <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-900 font-mono tracking-tight">
                {metrics.borradoresCount} <span className="text-sm font-semibold text-amber-700">en edición</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {metrics.rechazadasCount > 0 ? `${metrics.rechazadasCount} descartadas / rechazadas` : 'Propuestas en preparación'}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda y Filtros Minimalista */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs mb-5">
          <div className="flex flex-col lg:flex-row items-center gap-3">
            {/* Input de Búsqueda Principal */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por código (ej: 0587), cliente (BHP, WSP...), obra, RUT o asesor comercial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  title="Limpiar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selector de Centro de Costo */}
            <div className="w-full lg:w-72">
              <select
                value={selectedCc}
                onChange={(e) => setSelectedCc(e.target.value)}
                className="w-full py-2.5 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all cursor-pointer"
              >
                <option value="todos">🏢 Todos los Centros de Costo</option>
                {CENTROS_DE_COSTO.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Estado Comercial */}
            <div className="w-full lg:w-56">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full py-2.5 px-3 text-xs rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all cursor-pointer"
              >
                <option value="todos">📌 Todos los Estados</option>
                <option value="Borrador">🟡 Borrador</option>
                <option value="Finalizada">🔵 Finalizada</option>
                <option value="Enviada">📨 Enviada</option>
                <option value="Aprobada">🟢 Aprobada</option>
                <option value="Rechazada">🔴 Rechazada</option>
              </select>
            </div>

            {/* Botón de Limpiar Filtros */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="w-full lg:w-auto px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                title="Limpiar todos los filtros aplicados"
              >
                <X className="w-3.5 h-3.5" />
                <span>Restablecer</span>
              </button>
            )}
          </div>

          {/* Tag de Filtro de Proyecto Activo */}
          {selectedProject && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500 flex items-center gap-1 font-medium">
                <Filter className="w-3.5 h-3.5 text-blue-600" />
                Filtrando exclusivamente por proyecto:
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs font-bold bg-blue-50 text-blue-900 px-3 py-1 rounded-full border border-blue-200">
                <Lock className="w-3 h-3 text-blue-600" />
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

        {/* Tabla Minimalista Ampliada */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex-1 flex flex-col">
          {/* Barra informativa superior si hay cotizaciones seleccionadas con checkbox */}
          {selectedIds.length > 0 && (
            <div className="bg-red-50/90 border-b border-red-200 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-red-950 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckSquare className="w-4 h-4 text-[#E20000]" />
                <span className="font-bold">
                  {selectedIds.length} {selectedIds.length === 1 ? 'cotización seleccionada' : 'cotizaciones seleccionadas'}
                </span>
                <span className="text-red-800 font-mono text-[11px]">
                  ({selectedMetrics.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 })} UF · ~${selectedMetrics.clp.toLocaleString('es-CL')} CLP)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-lg hover:bg-white/80 font-medium transition-colors cursor-pointer"
                >
                  Deseleccionar todas
                </button>
                {hasPermission(user, 'cotizaciones.eliminar') && (
                  <button
                    type="button"
                    disabled={isDeletingBatch}
                    onClick={handleBatchDelete}
                    className="flex items-center gap-1.5 bg-[#E20000] hover:bg-[#C20000] text-white px-3 py-1 rounded-lg font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isDeletingBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>Eliminar seleccionadas ({selectedIds.length})</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200 text-[11px] uppercase tracking-wider select-none">
                <tr>
                  {/* Casilla Checkbox Maestro */}
                  <th className="py-3.5 px-3 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las cotizaciones"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      ref={(el) => {
                        if (el) {
                          el.indeterminate = selectedIds.length > 0 && selectedIds.length < filtered.length;
                        }
                      }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded text-[#E20000] focus:ring-[#E20000] border-slate-300 cursor-pointer accent-[#E20000]"
                      title={
                        selectedIds.length === filtered.length && filtered.length > 0
                          ? 'Deseleccionar todas'
                          : 'Seleccionar todas las cotizaciones visibles'
                      }
                    />
                  </th>
                  <th className="py-3.5 px-4 w-48 font-semibold">Código / Versión</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Cliente / Razón Social</th>
                  <th className="py-3.5 px-4 min-w-[200px]">Proyecto / Obra</th>
                  <th className="py-3.5 px-3 min-w-[130px]">Centro de Costo</th>
                  <th className="py-3.5 px-3 w-28 text-center">Fecha</th>
                  <th className="py-3.5 px-4 w-32 text-right">Monto Oferta</th>
                  <th className="py-3.5 px-4 w-36 text-right">Total Ref.</th>
                  <th className="py-3.5 px-4 w-36 text-center">Estado Comercial</th>
                  <th className="py-3.5 px-4 w-36">Asesor DGL</th>
                  <th className="py-3.5 px-4 w-36 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/90">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-7 h-7 text-[#E20000] animate-spin" />
                        <span className="text-xs font-medium text-slate-500">Cargando cotizaciones desde Supabase...</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="text-sm font-medium text-slate-600">No se encontraron cotizaciones</span>
                        <span className="text-xs text-slate-400">Prueba ajustando los términos de búsqueda o filtros.</span>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearAllFilters}
                            className="mt-2 text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                          >
                            Limpiar todos los filtros
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => {
                    const isV2 = c.code.match(/[-_.\s]V(\d+)$/i);
                    const vNum = isV2 ? isV2[1] : null;
                    const dateObj = c.date ? new Date(c.date) : (c.createdAt ? new Date(c.createdAt) : null);
                    const dateFormatted = dateObj && !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : '-';

                    const isSelected = selectedIds.includes(c.id);

                    return (
                      <tr
                        key={c.id}
                        className={`transition-colors group ${
                          isSelected
                            ? 'bg-red-50/60 hover:bg-red-50/80 border-l-2 border-l-[#E20000]'
                            : 'hover:bg-slate-50/70'
                        }`}
                      >
                        {/* Checkbox de fila */}
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar cotización ${c.code}`}
                            checked={isSelected}
                            onChange={() => toggleSelectOne(c.id)}
                            className="w-4 h-4 rounded text-[#E20000] focus:ring-[#E20000] border-slate-300 cursor-pointer accent-[#E20000]"
                          />
                        </td>

                        {/* Código con Pill de Versión */}
                        <td className="py-3.5 px-4 font-mono text-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              href={`/cotizador?edit=${c.id}`}
                              className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors hover:underline cursor-pointer"
                              title="Editar cotización / Generar nueva versión"
                            >
                              {c.code}
                            </Link>
                            {vNum && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px] tracking-tight">
                                V{vNum}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Cliente / Razón Social */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 truncate max-w-xs xl:max-w-sm" title={c.clientName}>
                            {c.clientName}
                          </div>
                          {c.clientRut && (
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              RUT: {c.clientRut}
                            </div>
                          )}
                        </td>

                        {/* Proyecto / Obra */}
                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-medium text-slate-800 truncate max-w-xs xl:max-w-sm" title={c.projectName || ''}>
                            {c.projectName || <span className="text-slate-400 italic">No especificado</span>}
                          </div>
                          {c.projectId && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => setSelectedProject(c.projectId === selectedProject ? '' : c.projectId!)}
                                title="Filtrar todas las cotizaciones asociadas a este proyecto"
                                className="inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 hover:bg-blue-100 transition-colors cursor-pointer"
                              >
                                <Lock className="w-2.5 h-2.5 text-blue-600" />
                                <span>{c.projectId}</span>
                              </button>

                              <Link
                                href={`/clientes?tab=proyectos`}
                                title="Ver ficha en el Directorio de Proyectos"
                                className="text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          )}
                        </td>

                        {/* Centro de Costo */}
                        <td className="py-3.5 px-3 text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-medium text-[11px] bg-slate-100 text-slate-700 border border-slate-200">
                            {c.centroCosto ? c.centroCosto.split(' - ')[0] : '1817'}
                          </span>
                        </td>

                        {/* Fecha */}
                        <td className="py-3.5 px-3 text-center text-xs text-slate-600 font-mono">
                          {dateFormatted}
                        </td>

                        {/* Total Presentado en Oferta */}
                        <td className="py-3.5 px-4 text-right font-black font-mono text-slate-900 text-xs">
                          {c.currency === 'USD'
                            ? `${(c.totalUsd || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
                            : c.currency === 'CLP'
                            ? `$${(c.totalClp || 0).toLocaleString('es-CL')} CLP`
                            : `${c.totalUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`}
                        </td>

                        {/* Total Referencial */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-600 text-xs font-semibold">
                          {c.currency === 'CLP'
                            ? `${c.totalUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF`
                            : `$${c.totalClp.toLocaleString('es-CL')}`}
                        </td>

                        {/* Estado Comercial Interactivo */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="relative inline-block">
                            <select
                              value={c.status || 'Borrador'}
                              disabled={updatingStatusId === c.id}
                              onChange={(e) => handleStatusChange(c.id, e.target.value as Cotizacion['status'])}
                              className={`appearance-none pl-2.5 pr-6 py-1 rounded-lg text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/20 transition-all ${
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

                        {/* Comercial / Asesor DGL */}
                        <td className="py-3.5 px-4 text-xs text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[9px] flex items-center justify-center border border-slate-200">
                              {c.commercialInitials || 'DGL'}
                            </span>
                            <span className="font-medium truncate max-w-[100px]" title={c.commercialName || c.createdBy}>
                              {c.commercialName || c.createdBy}
                            </span>
                          </div>
                        </td>

                        {/* Acciones Rápidas */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Visualizar PDF */}
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewLoading(true);
                                setPreviewCotizacion(c);
                              }}
                              title="Visualizar documento PDF (Vista previa)"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <Link
                              href={`/cotizador?edit=${c.id}`}
                              title="Editar o generar nueva versión"
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                            >
                              <Edit3 className="w-4 h-4" />
                            </Link>

                            {/* Descargar Excel Oficial */}
                            <a
                              href={`/api/cotizaciones/${c.id}/excel`}
                              download={`Cotizacion_${c.code}.xlsx`}
                              title="Exportar hoja de cálculo Excel"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </a>

                            {/* Cargar o Abrir en Salesforce */}
                            <SalesforceSyncButton
                              cotizacion={c}
                              onSynced={(updated) => {
                                setCotizaciones((prev) =>
                                  prev.map((item) => (item.id === updated.id ? updated : item))
                                );
                              }}
                            />

                            {/* Eliminar (Protegido por permisos) */}
                            {hasPermission(user, 'cotizaciones.eliminar') && (
                              <button
                                type="button"
                                onClick={() => handleDelete(c.id, c.code)}
                                title="Eliminar cotización"
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Barra flotante de acciones por selección múltiple */}
        {selectedIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200 max-w-[95vw]">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#E20000] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                {selectedIds.length}
              </span>
              <span className="text-xs font-semibold text-slate-100">
                {selectedIds.length === 1 ? '1 cotización seleccionada' : `${selectedIds.length} cotizaciones seleccionadas`}
              </span>
              <span className="text-xs text-slate-400 font-mono hidden md:inline">
                ({selectedMetrics.uf.toLocaleString('es-CL', { minimumFractionDigits: 2 })} UF · ~${selectedMetrics.clp.toLocaleString('es-CL')} CLP)
              </span>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {hasPermission(user, 'cotizaciones.eliminar') && (
                <button
                  type="button"
                  disabled={isDeletingBatch}
                  onClick={handleBatchDelete}
                  className="flex items-center gap-1.5 bg-[#E20000] hover:bg-[#C20000] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isDeletingBatch ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Eliminar {selectedIds.length === 1 ? 'cotización' : `(${selectedIds.length})`}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal de Vista Previa de PDF Embebido Ampliado */}
        {previewCotizacion && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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
                        title="Descargar documento preliminar con marca de agua BORRADOR"
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

                  {/* Descargar Excel */}
                  <a
                    href={`/api/cotizaciones/${previewCotizacion.id}/excel`}
                    download={`Cotizacion_${previewCotizacion.code}.xlsx`}
                    className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    title="Descargar Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>Excel</span>
                  </a>

                  {/* Sincronización con Salesforce */}
                  <SalesforceSyncButton
                    cotizacion={previewCotizacion}
                    variant="button"
                    onSynced={(updated) => {
                      setPreviewCotizacion(updated);
                      setCotizaciones((prev) =>
                        prev.map((item) => (item.id === updated.id ? updated : item))
                      );
                    }}
                  />

                  <Link
                    href={`/cotizador?edit=${previewCotizacion.id}`}
                    className="hidden sm:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
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
