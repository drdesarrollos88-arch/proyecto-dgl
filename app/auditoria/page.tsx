'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { AuditLog, SessionUser } from '@/lib/types';
import { isAdminRole } from '@/lib/permissions';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  User,
  Activity,
  Layers,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowUpDown,
  Download,
  Eye,
  Info,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

const MODULE_OPTIONS = [
  { value: 'TODOS', label: 'Todos los Módulos' },
  { value: 'Acceso', label: 'Acceso y Sesiones' },
  { value: 'Cotizaciones', label: 'Cotizaciones' },
  { value: 'Tarifario', label: 'Tarifado Oficial' },
  { value: 'Clientes', label: 'Clientes y CRM' },
  { value: 'Bibliografía', label: 'Bibliografía IA' },
  { value: 'Asistente IA', label: 'Asistente IA' },
  { value: 'Usuarios', label: 'Usuarios y Accesos' },
  { value: 'Configuración', label: 'Configuración' },
];

const ACTION_OPTIONS = [
  { value: 'TODOS', label: 'Todas las Acciones' },
  { value: 'LOGIN', label: 'Inicios de Sesión (Login)' },
  { value: 'LOGIN_FAILED', label: 'Intentos Fallidos' },
  { value: 'LOGOUT', label: 'Cierre de Sesión' },
  { value: 'COTIZACION_BORRADOR', label: 'Guardado Borrador Cotización' },
  { value: 'COTIZACION_FINALIZAR', label: 'Emisión Final Cotización' },
  { value: 'COTIZACION_EDITAR', label: 'Edición Cotización' },
  { value: 'COTIZACION_ELIMINAR', label: 'Eliminación Cotización' },
  { value: 'TARIFARIO_EDITAR', label: 'Edición de Ensayos' },
  { value: 'TARIFARIO_MOVER', label: 'Reubicación de Ensayos' },
  { value: 'TARIFARIO_NUEVO', label: 'Nuevo Ensayo Oficial' },
  { value: 'CLIENTE_CREAR', label: 'Creación de Cliente' },
  { value: 'BIBLIOGRAFIA_SUBIR', label: 'Carga de Documento Técnico' },
  { value: 'ASISTENTE_CHAT_ARCHIVADO', label: 'Interacción IA Archivada' },
];

function getActionBadge(action: string) {
  const act = action.toUpperCase();
  if (act.includes('LOGIN_FAILED')) {
    return {
      label: 'Acceso Fallido',
      bg: 'bg-red-50 text-red-700 border-red-200',
      dot: 'bg-red-500',
    };
  }
  if (act === 'LOGIN') {
    return {
      label: 'Inicio Sesión',
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dot: 'bg-indigo-500',
    };
  }
  if (act === 'LOGOUT') {
    return {
      label: 'Cierre Sesión',
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      dot: 'bg-slate-400',
    };
  }
  if (act.includes('FINALIZAR')) {
    return {
      label: 'Finalización Oficial',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dot: 'bg-emerald-500',
    };
  }
  if (act.includes('BORRADOR')) {
    return {
      label: 'Borrador Guardado',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      dot: 'bg-amber-500',
    };
  }
  if (act.includes('ELIMINAR')) {
    return {
      label: 'Eliminación',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      dot: 'bg-rose-500',
    };
  }
  if (act.includes('EDITAR') || act.includes('MOVER')) {
    return {
      label: 'Modificación',
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      dot: 'bg-blue-500',
    };
  }
  if (act.includes('CREAR') || act.includes('NUEVO') || act.includes('SUBIR')) {
    return {
      label: 'Creación / Carga',
      bg: 'bg-teal-50 text-teal-700 border-teal-200',
      dot: 'bg-teal-500',
    };
  }
  if (act.includes('ARCHIVADO')) {
    return {
      label: 'Histórico IA',
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      dot: 'bg-purple-500',
    };
  }
  return {
    label: action,
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  };
}

export default function AuditoriaPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('TODOS');
  const [selectedAction, setSelectedAction] = useState('TODOS');

  // Modal de detalle
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Cargar usuario en sesión
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  const fetchAuditLogs = async () => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (selectedModule !== 'TODOS') params.set('module', selectedModule);
      if (selectedAction !== 'TODOS') params.set('action', selectedAction);
      if (search.trim()) params.set('search', search.trim());
      params.set('stats', 'true');
      params.set('limit', '300');

      const res = await fetch(`/api/auditoria?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user && isAdminRole(user.role)) {
      fetchAuditLogs();
    }
  }, [user, selectedModule, selectedAction]);

  // Manejo de búsqueda por debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user && isAdminRole(user.role)) {
        fetchAuditLogs();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Métricas calculadas
  const metrics = useMemo(() => {
    const totalLogs = logs.length;
    const logins = logs.filter((l) => l.action === 'LOGIN').length;
    const changes = logs.filter((l) => l.module !== 'Acceso').length;
    const uniqueUsers = new Set(logs.map((l) => l.userEmail || l.userName).filter(Boolean)).size;

    return { totalLogs, logins, changes, uniqueUsers };
  }, [logs]);

  // Si está cargando usuario
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-medium">Verificando credenciales de seguridad...</span>
        </div>
      </div>
    );
  }

  // Protección de acceso estricta: Solo Admin y Soporte
  if (!user || !isAdminRole(user.role)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto text-red-600 mb-4 shadow-xs">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Módulo Restringido a Administrador / Soporte</h1>
          <p className="text-sm text-slate-600 mb-6">
            La bitácora de auditoría, trazabilidad de accesos y registro de cambios requiere privilegios administrativos
            superiores para garantizar la confidencialidad de la operación institucional DGL.
          </p>
          <Link
            href="/cotizaciones"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            Volver al Panel Principal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Encabezado del Módulo */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-800 text-white flex items-center justify-center shadow-sm shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Auditoría, Accesos y Trazabilidad DGL
                </h1>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                  Panel Administrador / Soporte
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Supervisión en tiempo real de accesos al sistema, sesiones de usuarios y registro histórico de cambios en
                cotizaciones, catálogo tarifario, clientes y base de conocimientos de IA.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={fetchAuditLogs}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              title="Actualizar bitácora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-700' : ''}`} />
              <span>Actualizar</span>
            </button>

            <Link
              href="/configuracion/bibliografia"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bibliografía IA</span>
            </Link>
          </div>
        </div>

        {/* Tarjetas de Métricas de Trazabilidad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Eventos Totales</span>
              <p className="text-lg font-bold text-slate-900 leading-tight">{metrics.totalLogs}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Inicios de Sesión</span>
              <p className="text-lg font-bold text-indigo-700 leading-tight">{metrics.logins}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Cambios Realizados</span>
              <p className="text-lg font-bold text-emerald-700 leading-tight">{metrics.changes}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-500">Usuarios Registrados</span>
              <p className="text-lg font-bold text-purple-700 leading-tight">{metrics.uniqueUsers}</p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por usuario, correo, correlativo o detalle del cambio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-slate-50/50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedModule}
                onChange={(e) => setSelectedModule(e.target.value)}
                className="text-xs bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                {MODULE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="text-xs bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabla de Registros de Auditoría */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50/80 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha y Hora</th>
                  <th className="px-4 py-3">Usuario Responsable</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Acción Registrada</th>
                  <th className="px-4 py-3">Descripción y Modificación</th>
                  <th className="px-4 py-3 text-center">IP</th>
                  <th className="px-4 py-3 text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
                        <span>Cargando bitácora de auditoría...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <Info className="w-6 h-6 text-slate-400" />
                        <span className="font-semibold text-slate-700">No se encontraron registros de auditoría</span>
                        <span className="text-[11px] text-slate-400">
                          Intenta ajustar los filtros de módulo, acción o término de búsqueda.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const badge = getActionBadge(log.action);
                    const dateObj = new Date(log.timestamp);
                    const formattedDate = dateObj.toLocaleDateString('es-CL', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    });
                    const formattedTime = dateObj.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{formattedDate}</span>
                            <span className="text-[11px] text-slate-400">{formattedTime}</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-300">
                              {(log.userName || 'U').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 leading-tight">
                                {log.userName || 'Usuario del Sistema'}
                              </span>
                              <span className="text-[11px] text-slate-400 leading-tight">
                                {log.userEmail || 'Sin correo'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            {log.module}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${badge.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="max-w-md line-clamp-2 text-slate-800 font-medium">
                            {log.description}
                          </div>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-center text-[11px] text-slate-400 font-mono">
                          {log.ip || '-'}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Ver detalles completos del cambio"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
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

      {/* Modal para Inspección de Detalles */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Detalle del Registro de Auditoría</h3>
                  <span className="text-[11px] text-slate-400 font-mono">ID: {selectedLog.id}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Usuario</span>
                  <p className="font-semibold text-slate-900">{selectedLog.userName}</p>
                  <p className="text-[11px] text-slate-500">{selectedLog.userEmail}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Rol & IP</span>
                  <p className="font-semibold text-slate-900">{selectedLog.userRole || 'comercial'}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedLog.ip || '127.0.0.1'}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Descripción del Evento</span>
                <p className="mt-1 text-slate-800 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.details && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">
                    Carga Técnica y Parámetros Modificados
                  </span>
                  <pre className="mt-1 bg-slate-900 text-slate-100 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

