'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import {
  Bug,
  Sparkles,
  Plus,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Image as ImageIcon,
  ChevronRight,
  ShieldCheck,
  Wrench,
  HelpCircle,
  Inbox,
  ArrowUpRight,
} from 'lucide-react';
import { TicketItem, TicketEstado, TicketTipo } from '@/lib/tickets-types';
import { SessionUser } from '@/lib/types';
import { isSuperAdminRole, isAdminRole } from '@/lib/permissions';
import CrearTicketModal from '@/components/tickets/CrearTicketModal';
import DetalleTicketModal from '@/components/tickets/DetalleTicketModal';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [estadoFilter, setEstadoFilter] = useState<'TODOS' | TicketEstado>('TODOS');
  const [tipoFilter, setTipoFilter] = useState<'TODOS' | TicketTipo>('TODOS');

  // Modales
  const [showCrearModal, setShowCrearModal] = useState<boolean>(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);

  // Cargar usuario actual
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, []);

  const isSuperadmin = isSuperAdminRole(currentUser?.role) || isAdminRole(currentUser?.role);

  // Cargar tickets
  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets');
      if (!res.ok) throw new Error('Error al cargar tickets');
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (err) {
      console.error('Error cargando tickets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Contadores para métricas
  const totalCount = tickets.length;
  const abiertosCount = tickets.filter((t) => t.estado === 'abierto' || t.estado === 'en_revision').length;
  const desarrolloCount = tickets.filter((t) => t.estado === 'en_desarrollo').length;
  const resueltosCount = tickets.filter((t) => t.estado === 'resuelto' || t.estado === 'cerrado').length;

  // Filtrado
  const filteredTickets = useMemo(() => {
    const q = search.toLowerCase().trim();
    return tickets.filter((t) => {
      if (estadoFilter !== 'TODOS') {
        if (estadoFilter === 'abierto') {
          if (t.estado !== 'abierto' && t.estado !== 'en_revision') return false;
        } else if (t.estado !== estadoFilter) {
          return false;
        }
      }

      if (tipoFilter !== 'TODOS' && t.tipo !== tipoFilter) return false;

      if (q) {
        return (
          t.id.toLowerCase().includes(q) ||
          t.titulo.toLowerCase().includes(q) ||
          t.descripcion.toLowerCase().includes(q) ||
          t.usuarioNombre.toLowerCase().includes(q) ||
          t.usuarioEmail.toLowerCase().includes(q) ||
          t.modulo.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tickets, estadoFilter, tipoFilter, search]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-rose-200 uppercase tracking-wider">
                Lanzamiento a Usuarios
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Atención directa por Superadmin
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <span>Mesa de Tickets & Parches</span>
              {isSuperadmin && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-900 to-indigo-900 text-white flex items-center gap-1 shadow-2xs">
                  <ShieldCheck className="w-3 h-3 text-purple-300" />
                  <span>Modo Superadmin</span>
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500 max-w-2xl mt-1">
              Canal de soporte para reportar errores detectados, pegar capturas de pantalla con Ctrl+V y solicitar mejoras durante el despliegue del sistema.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTickets}
              disabled={loading}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shadow-2xs cursor-pointer"
              title="Recargar tickets"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowCrearModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer transform hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Ticket / Error</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Tickets */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Total Tickets */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
              Total Reportes
            </span>
            <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
              {totalCount}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Tickets registrados en plataforma</div>
          </div>

          {/* Abiertos / En Revisión */}
          <div
            onClick={() => setEstadoFilter('abierto')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 shadow-xs cursor-pointer hover:border-rose-400 transition-colors"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 block mb-1">
              Pendientes de Atención
            </span>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 tabular-nums">
              {abiertosCount}
            </div>
            <div className="text-[11px] text-rose-600/80 font-medium mt-0.5">
              Por revisar por el Superadmin
            </div>
          </div>

          {/* En Desarrollo / Creando Parche */}
          <div
            onClick={() => setEstadoFilter('en_desarrollo')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-xs cursor-pointer hover:border-indigo-400 transition-colors"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block mb-1">
              En Desarrollo / Parche
            </span>
            <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 tabular-nums">
              {desarrolloCount}
            </div>
            <div className="text-[11px] text-indigo-600/80 font-medium mt-0.5">
              Solución en construcción
            </div>
          </div>

          {/* Resueltos */}
          <div
            onClick={() => setEstadoFilter('resuelto')}
            className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 shadow-xs cursor-pointer hover:border-emerald-400 transition-colors"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block mb-1">
              Resueltos / Parcheados
            </span>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {resueltosCount}
            </div>
            <div className="text-[11px] text-emerald-600/80 font-medium mt-0.5">
              Mejoras y fixes aplicados
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Pestañas de Estado */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setEstadoFilter('TODOS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                estadoFilter === 'TODOS'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              onClick={() => setEstadoFilter('abierto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                estadoFilter === 'abierto'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100'
              }`}
            >
              Pendientes ({abiertosCount})
            </button>
            <button
              onClick={() => setEstadoFilter('en_desarrollo')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                estadoFilter === 'en_desarrollo'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 hover:bg-indigo-100'
              }`}
            >
              En Desarrollo ({desarrolloCount})
            </button>
            <button
              onClick={() => setEstadoFilter('resuelto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                estadoFilter === 'resuelto'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
            >
              Resueltos ({resueltosCount})
            </button>
          </div>

          {/* Buscador y Filtro por Tipo */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar ticket, usuario, módulo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              />
            </div>

            <select
              value={tipoFilter}
              onChange={(e) => setTipoFilter(e.target.value as any)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold cursor-pointer"
            >
              <option value="TODOS">Todos los tipos</option>
              <option value="error">🐛 Errores / Bugs</option>
              <option value="mejora">✨ Mejoras</option>
              <option value="consulta">❓ Consultas</option>
              <option value="urgente">🚨 Urgentes</option>
            </select>
          </div>
        </div>

        {/* Lista de Tickets */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-slate-400" />
              <p className="text-xs">Cargando tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Inbox className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No hay tickets en este estado
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {search || estadoFilter !== 'TODOS'
                  ? 'Prueba cambiando o limpiando los filtros de búsqueda.'
                  : 'Aún no se han registrado tickets. ¡Puedes crear el primero con el botón "+ Nuevo Ticket"!'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredTickets.map((t) => {
                const isResolved = t.estado === 'resuelto' || t.estado === 'cerrado';
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicket(t)}
                    className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Icono de Tipo */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          t.tipo === 'error'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                            : t.tipo === 'mejora'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : t.tipo === 'urgente'
                            ? 'bg-red-600 text-white'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {t.tipo === 'error' ? (
                          <Bug className="w-4 h-4" />
                        ) : t.tipo === 'mejora' ? (
                          <Sparkles className="w-4 h-4" />
                        ) : t.tipo === 'urgente' ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : (
                          <HelpCircle className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        {/* Fila Superior: ID, Módulo, Prioridad */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-200">
                            {t.id}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {t.modulo}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              t.prioridad === 'critica'
                                ? 'bg-rose-600 text-white font-black'
                                : t.prioridad === 'alta'
                                ? 'bg-amber-100 text-amber-800'
                                : t.prioridad === 'media'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t.prioridad.toUpperCase()}
                          </span>

                          {t.capturaPantalla && (
                            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded flex items-center gap-1">
                              <ImageIcon className="w-3 h-3" />
                              <span>Con captura adjunta</span>
                            </span>
                          )}
                        </div>

                        {/* Título */}
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-red-600 transition-colors truncate max-w-xl">
                          {t.titulo}
                        </h4>

                        {/* Descripción breve */}
                        <p className="text-xs text-slate-500 line-clamp-1 max-w-2xl">
                          {t.descripcion}
                        </p>

                        {/* Solicitante y fecha */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400 font-medium">
                            <User className="w-3 h-3 text-slate-400" />
                            {t.usuarioNombre}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {t.fechaFormateada}
                          </span>
                          {t.notasAdmin && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Con nota de parche</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Estado y Flecha de Acción */}
                    <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                          t.estado === 'resuelto'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                            : t.estado === 'en_desarrollo'
                            ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300'
                            : t.estado === 'en_revision'
                            ? 'bg-amber-100 text-amber-800'
                            : t.estado === 'cerrado'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
                        }`}
                      >
                        {t.estado === 'abierto'
                          ? 'Abierto'
                          : t.estado === 'en_revision'
                          ? 'En Revisión'
                          : t.estado === 'en_desarrollo'
                          ? 'En Desarrollo'
                          : t.estado === 'resuelto'
                          ? 'Resuelto ✓'
                          : 'Cerrado'}
                      </span>

                      <div className="p-1.5 rounded-lg text-slate-400 group-hover:text-red-600 group-hover:bg-red-50 dark:group-hover:bg-red-950/50 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal Crear Ticket */}
      {showCrearModal && (
        <CrearTicketModal
          isOpen={showCrearModal}
          onClose={() => setShowCrearModal(false)}
          currentUser={currentUser}
          onTicketCreated={loadTickets}
        />
      )}

      {/* Modal Ver / Gestionar Ticket */}
      {selectedTicket && (
        <DetalleTicketModal
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicket(null)}
          ticket={selectedTicket}
          currentUser={currentUser}
          onTicketUpdated={loadTickets}
          onTicketDeleted={loadTickets}
        />
      )}
    </div>
  );
}

