'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { AuditLog, SessionUser } from '@/lib/types';
import { isAdminRole, hasPermission } from '@/lib/permissions';
import { HISTORIAL_VERSIONES, VersionRegistro, getVersionActual } from '@/lib/versiones';
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
  GitBranch,
  Tag,
  Calendar,
  Check,
  Package,
  History,
} from 'lucide-react';

const MODULE_OPTIONS = [
  { value: 'TODOS', label: 'Todos los Módulos' },
  { value: 'Acceso', label: 'Acceso y Sesiones' },
  { value: 'Cotizaciones', label: 'Cotizaciones' },
  { value: 'Tarifario', label: 'Tarifado Oficial' },
  { value: 'Clientes', label: 'Clientes y CRM' },
  { value: 'Salesforce', label: 'Salesforce' },
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
  { value: 'COTIZACION_ESTADO', label: 'Cambio de Estado Cotización' },
  { value: 'COTIZACION_DESCARGAR', label: 'Descarga de Cotización (PDF/Excel)' },
  { value: 'COTIZACION_ELIMINAR', label: 'Eliminación Cotización' },
  { value: 'TARIFARIO_EDITAR', label: 'Edición de Ensayos' },
  { value: 'TARIFARIO_EDITAR_MASIVO', label: 'Edición Masiva de Precios' },
  { value: 'TARIFARIO_MOVER', label: 'Reubicación de Ensayos' },
  { value: 'TARIFARIO_NUEVO', label: 'Nuevo Ensayo Oficial' },
  { value: 'TARIFARIO_IMPORTAR', label: 'Importación de Tarifario' },
  { value: 'TARIFARIO_ESTRUCTURA', label: 'Cambios de Categorías/Subcategorías' },
  { value: 'TARIFARIO_EXPORTAR', label: 'Descarga de Tarifario' },
  { value: 'CLIENTE_CREAR', label: 'Creación de Cliente' },
  { value: 'CLIENTE_EDITAR', label: 'Edición de Cliente' },
  { value: 'CLIENTE_ELIMINAR', label: 'Eliminación de Cliente' },
  { value: 'CLIENTE_IMPORTAR', label: 'Importación de Clientes' },
  { value: 'USUARIO_CREAR', label: 'Creación de Usuario' },
  { value: 'USUARIO_EDITAR', label: 'Edición de Usuario / Permisos' },
  { value: 'USUARIO_ELIMINAR', label: 'Eliminación de Usuario' },
  { value: 'USUARIO_CLAVE_CAMBIADA', label: 'Cambio de Contraseña' },
  { value: 'USUARIO_PERFIL_PROPIO', label: 'Edición de Perfil Propio' },
  { value: 'PERFIL_CREAR', label: 'Creación de Perfil de Acceso' },
  { value: 'PERFIL_EDITAR', label: 'Edición de Perfil de Acceso' },
  { value: 'PERFIL_ELIMINAR', label: 'Eliminación de Perfil de Acceso' },
  { value: 'CONFIG_CORRELATIVOS', label: 'Cambio de Correlativos' },
  { value: 'CONFIG_FORMATO', label: 'Cambio de Formato Oficial' },
  { value: 'SALESFORCE_CONECTADO', label: 'Salesforce Conectado' },
  { value: 'SALESFORCE_DISCONNECTED', label: 'Salesforce Desconectado' },
  { value: 'SALESFORCE_SYNC', label: 'Envío a Salesforce' },
  { value: 'SALESFORCE_CIERRE', label: 'Cierre de Oportunidad Salesforce' },
  { value: 'BIBLIOGRAFIA_SUBIR', label: 'Carga de Documento Técnico' },
  { value: 'BIBLIOGRAFIA_ESTADO', label: 'Cambio de Estado de Documento' },
  { value: 'BIBLIOGRAFIA_ELIMINAR', label: 'Eliminación de Documento Técnico' },
  { value: 'ASISTENTE_CHAT_ARCHIVADO', label: 'Interacción IA Archivada' },
];

const PAGE_SIZE = 100;
const EXPORT_MAX = 10000;

interface AuditStatsDto {
  totalLogs: number;
  totalAccesses: number;
  totalLogins: number;
  failedLogins: number;
  totalChanges: number;
  last24h: number;
  activeUsersCount: number;
}

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
  if (act.includes('DESCARGAR')) {
    return {
      label: 'Descarga PDF/Excel',
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      dot: 'bg-purple-500',
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

  // Pestaña Activa: 'bitacora' (eventos en tiempo real) | 'versiones' (despliegues y cambios de versión)
  const [activeTab, setActiveTab] = useState<'bitacora' | 'versiones'>('bitacora');

  // Bitácora de eventos
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Paginación, estadísticas globales y origen de los datos
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<AuditStatsDto | null>(null);
  const [source, setSource] = useState<'supabase' | 'memoria'>('supabase');

  // Filtros de bitácora
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('TODOS');
  const [selectedAction, setSelectedAction] = useState('TODOS');
  const [selectedUser, setSelectedUser] = useState('TODOS');
  const [registeredUsers, setRegisteredUsers] = useState<{ id: string; name: string; email: string; role?: string }[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filtros de versiones
  const [versionSearch, setVersionSearch] = useState('');
  const [versionModuleFilter, setVersionModuleFilter] = useState('TODOS');
  const versionActual = getVersionActual();

  // Modal de detalle
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Cargar usuario en sesión y usuarios registrados
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));

    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.users)) {
          setRegisteredUsers(data.users);
        }
      })
      .catch(() => {});
  }, []);

  // Lista unificada de opciones de usuarios para filtrado
  const userOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; role?: string }>();

    // 1. Usuarios registrados formalmente en la plataforma
    registeredUsers.forEach((u) => {
      const key = u.email || u.id;
      map.set(key, {
        id: key,
        name: u.name,
        email: u.email,
        role: u.role,
      });
    });

    // 2. Extraer de los logs si existen usuarios históricos no registrados actualmente
    logs.forEach((l) => {
      const key = l.userEmail || l.userName;
      if (key && !map.has(key)) {
        map.set(key, {
          id: key,
          name: l.userName || key,
          email: l.userEmail || '',
          role: l.userRole,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [registeredUsers, logs]);

  const buildParams = (offset: number, limit: number, withStats: boolean) => {
    const params = new URLSearchParams();
    if (selectedModule !== 'TODOS') params.set('module', selectedModule);
    if (selectedAction !== 'TODOS') params.set('action', selectedAction);
    if (selectedUser !== 'TODOS') params.set('userId', selectedUser);
    if (search.trim()) params.set('search', search.trim());
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (withStats) params.set('stats', 'true');
    params.set('limit', String(limit));
    params.set('offset', String(offset));
    return params;
  };

  /** reset=true recarga desde el inicio; reset=false agrega la siguiente página. */
  const fetchAuditLogs = async (reset: boolean = true) => {
    if (reset) setRefreshing(true);
    else setLoadingMore(true);

    try {
      const offset = reset ? 0 : logs.length;
      const res = await fetch(`/api/auditoria?${buildParams(offset, PAGE_SIZE, reset).toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.logs)) {
          setLogs((prev) => (reset ? data.logs : [...prev, ...data.logs]));
          setTotal(data.total ?? data.logs.length);
          setHasMore(Boolean(data.hasMore));
          if (data.source) setSource(data.source);
          if (reset && data.stats) setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Recarga inmediata al cambiar módulo, acción, usuario o fechas
  useEffect(() => {
    if (user && (isAdminRole(user.role) || hasPermission(user, 'auditoria.ver'))) {
      fetchAuditLogs(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedModule, selectedAction, selectedUser, dateFrom, dateTo]);

  // Manejo de búsqueda por debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (user && (isAdminRole(user.role) || hasPermission(user, 'auditoria.ver'))) {
        fetchAuditLogs(true);
      }
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  /** Exporta TODOS los eventos que cumplen los filtros (en bloques), no solo los visibles. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: AuditLog[] = [];
      const BLOCK = 1000;
      let offset = 0;
      let more = true;
      while (more && rows.length < EXPORT_MAX) {
        const res = await fetch(`/api/auditoria?${buildParams(offset, BLOCK, false).toString()}`);
        if (!res.ok) throw new Error('No se pudo obtener la bitácora');
        const data = await res.json();
        rows.push(...(data.logs || []));
        more = Boolean(data.hasMore) && (data.logs || []).length > 0;
        offset += BLOCK;
      }

      // Neutraliza fórmulas de Excel (=, +, -, @, tab, CR) y escapa comillas
      const cell = (v: unknown) => {
        let s = v === undefined || v === null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      };
      const header = ['Fecha', 'Usuario', 'Correo', 'Rol', 'Módulo', 'Acción', 'Descripción', 'IP', 'Detalle (JSON)'];
      const lines = rows.map((l) =>
        [
          new Date(l.timestamp).toLocaleString('es-CL'),
          l.userName,
          l.userEmail,
          l.userRole,
          l.module,
          l.action,
          l.description,
          l.ip,
          l.details ? JSON.stringify(l.details) : '',
        ]
          .map(cell)
          .join(',')
      );
      const csv = '\uFEFF' + [header.map(cell).join(','), ...lines].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_DGL_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exportando auditoría:', err);
      alert('No se pudo exportar la bitácora. Intenta nuevamente.');
    } finally {
      setExporting(false);
    }
  };

  // Métricas consolidadas
  const metrics = useMemo(() => {
    if (stats) {
      return {
        totalLogs: stats.totalLogs,
        logins: stats.totalLogins,
        changes: stats.totalChanges,
        uniqueUsers: stats.activeUsersCount,
      };
    }
    const logins = logs.filter((l) => l.action.includes('LOGIN')).length;
    const changes = logs.filter((l) => !l.action.includes('LOGIN') && l.module !== 'Acceso').length;
    const usersSet = new Set(logs.map((l) => l.userEmail || l.userName).filter(Boolean));
    return {
      totalLogs: total || logs.length,
      logins,
      changes,
      uniqueUsers: usersSet.size,
    };
  }, [stats, logs, total]);

  // Filtrado de versiones
  const filteredVersiones = useMemo(() => {
    return HISTORIAL_VERSIONES.filter((v) => {
      if (versionModuleFilter !== 'TODOS' && !v.modulos.includes(versionModuleFilter)) {
        return false;
      }
      if (versionSearch.trim()) {
        const q = versionSearch.toLowerCase().trim();
        const inVersion = v.version.toLowerCase().includes(q) || v.tag.toLowerCase().includes(q);
        const inTitle = v.titulo.toLowerCase().includes(q);
        const inDesc = v.descripcion.toLowerCase().includes(q);
        const inDetails = v.detalles.some((d) => d.toLowerCase().includes(q));
        const inModules = v.modulos.some((m) => m.toLowerCase().includes(q));
        return inVersion || inTitle || inDesc || inDetails || inModules;
      }
      return true;
    });
  }, [versionSearch, versionModuleFilter]);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-600">Verificando credenciales de acceso...</span>
        </div>
      </div>
    );
  }

  // Protección de acceso: Administrador, Soporte o usuarios con permiso explícito de auditoría
  if (!user || (!isAdminRole(user.role) && !hasPermission(user, 'auditoria.ver'))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-lg border border-slate-200">
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 mx-auto flex items-center justify-center mb-4 border border-red-100">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Acceso Restringido a Auditoría</h2>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            El módulo de trazabilidad y auditoría de cambios está reservado exclusivamente para perfiles{' '}
            <strong>Administrador</strong> o <strong>Soporte Técnico</strong>.
          </p>
          <Link
            href="/cotizaciones"
            className="mt-6 inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors w-full shadow-sm"
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
                  Auditoría, Accesos y Versiones DGL
                </h1>
                <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                  Panel Administrador / Soporte
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                  {versionActual.tag}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Supervisión en tiempo real de accesos al sistema, sesiones de usuarios, registro histórico de cambios en
                cotizaciones y catálogo, y control de versiones desplegadas en producción.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {activeTab === 'bitacora' && (
              <button
                onClick={() => fetchAuditLogs(true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
                title="Actualizar bitácora"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-purple-700' : ''}`} />
                <span>Actualizar</span>
              </button>
            )}

            <Link
              href="/configuracion/bibliografia"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition-colors shadow-2xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bibliografía IA</span>
            </Link>
          </div>
        </div>

        {/* Selector de Pestañas Principales */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <button
            onClick={() => setActiveTab('bitacora')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bitacora'
                ? 'bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Bitácora de Trazabilidad y Accesos</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'bitacora' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
              }`}
            >
              {total || metrics.totalLogs}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('versiones')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'versiones'
                ? 'bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Historial de Versiones y Despliegues</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'versiones'
                  ? 'bg-emerald-400 text-slate-950 font-extrabold'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {versionActual.tag} Activa
            </span>
          </button>
        </div>

        {/* PESTAÑA 1: BITÁCORA DE TRAZABILIDAD */}
        {activeTab === 'bitacora' && (
          <div className="space-y-6">
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
                {/* Filtro por Usuario Responsable */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <User className="w-3.5 h-3.5 text-purple-600" />
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="text-xs bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
                    title="Filtrar por usuario registrado o responsable"
                  >
                    <option value="TODOS">Todos los Usuarios ({userOptions.length})</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.role ? `(${u.role})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

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

            {/* Indicador de filtro activo por usuario */}
            {selectedUser !== 'TODOS' && (
              <div className="flex items-center justify-between gap-2 bg-purple-50/90 border border-purple-200 px-4 py-2 rounded-xl text-xs text-purple-900 animate-in fade-in duration-150 shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-purple-800">Filtrando historial por:</span>
                  <span className="font-mono bg-purple-200/70 text-purple-950 px-2 py-0.5 rounded font-bold border border-purple-300">
                    {userOptions.find((u) => u.id === selectedUser)?.name || selectedUser}
                  </span>
                  <span className="text-[11px] text-purple-600">
                    ({total} evento{total === 1 ? '' : 's'} encontrado{total === 1 ? '' : 's'})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser('TODOS')}
                  className="text-purple-700 hover:text-purple-950 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[11px] shrink-0"
                >
                  ✕ Ver todos los usuarios
                </button>
              </div>
            )}

            {/* Rango de fechas y exportación */}
            <div className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Período:</span>
                <label className="flex items-center gap-1.5">
                  <span>Desde</span>
                  <input
                    type="date"
                    value={dateFrom}
                    max={dateTo || undefined}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50/50 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </label>
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                  >
                    Limpiar fechas
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto">
                <button
                  onClick={exportCsv}
                  disabled={exporting || logs.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Exportar registros filtrados a CSV"
                >
                  <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce text-emerald-700' : ''}`} />
                  <span>{exporting ? 'Generando CSV...' : `Exportar CSV (${(total || logs.length).toLocaleString('es-CL')})`}</span>
                </button>
              </div>
            </div>

            {/* Tabla de Bitácora */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">Fecha y Hora</th>
                      <th className="py-3 px-4">Usuario Responsable</th>
                      <th className="py-3 px-4">Módulo</th>
                      <th className="py-3 px-4">Acción Registrada</th>
                      <th className="py-3 px-4">Descripción y Modificación</th>
                      <th className="py-3 px-4 text-center">IP</th>
                      <th className="py-3 px-4 text-center">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                            <span>Cargando bitácora de auditoría...</span>
                          </div>
                        </td>
                      </tr>
                    ) : logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Info className="w-8 h-8 text-slate-300" />
                            <span className="font-semibold text-slate-600">No se encontraron registros de auditoría</span>
                            <span className="text-[11px] text-slate-400 max-w-sm">
                              Intenta ajustar los filtros de módulo, acción, rango de fechas o término de búsqueda.
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => {
                        const badge = getActionBadge(log.action);
                        const dateFormatted = new Date(log.timestamp).toLocaleString('es-CL', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        });

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                              {dateFormatted}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-semibold text-slate-900">{log.userName}</span>
                                <span className="text-[10px] text-slate-400">{log.userEmail || '—'}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                {log.module}
                              </span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-md">
                              <p className="line-clamp-2 text-slate-800 font-medium">{log.description}</p>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {log.ip || '127.0.0.1'}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-purple-700 hover:bg-purple-50 transition-colors cursor-pointer"
                                title="Ver detalles técnicos"
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

              {!loading && logs.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60 text-[11px] text-slate-500">
                  <span>
                    Mostrando <strong className="text-slate-800">{logs.length.toLocaleString('es-CL')}</strong> de{' '}
                    <strong className="text-slate-800">{total.toLocaleString('es-CL')}</strong> eventos
                  </span>
                  {hasMore && (
                    <button
                      onClick={() => fetchAuditLogs(false)}
                      disabled={loadingMore}
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {loadingMore ? 'Cargando...' : 'Cargar más eventos'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: HISTORIAL DE VERSIONES Y DESPLIEGUES */}
        {activeTab === 'versiones' && (
          <div className="space-y-6">
            {/* Banner Destacado: Versión Activa en Producción */}
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white rounded-2xl p-6 border border-indigo-900/40 shadow-lg relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Versión Activa en Producción
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white/10 text-white border border-white/15">
                      {versionActual.tag}
                    </span>
                    <span className="text-xs text-indigo-200 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-300" />
                      {versionActual.fechaFormato}
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-white tracking-tight">
                    {versionActual.titulo}
                  </h2>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {versionActual.descripcion}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {versionActual.modulos.map((mod) => (
                      <span
                        key={mod}
                        className="text-[11px] px-2.5 py-0.5 rounded-lg bg-indigo-900/60 text-indigo-200 border border-indigo-700/50 font-medium"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col gap-2 bg-white/5 border border-white/10 p-4 rounded-xl backdrop-blur-xs min-w-[220px]">
                  <div className="flex items-center justify-between text-xs text-indigo-200">
                    <span>Ambiente:</span>
                    <span className="font-semibold text-white">Cloudflare Workers</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-indigo-200">
                    <span>Base de Datos:</span>
                    <span className="font-semibold text-white">Supabase PostgreSQL</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-indigo-200">
                    <span>Seguridad:</span>
                    <span className="font-semibold text-emerald-400 font-mono">Inmutable (RLS)</span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Responsable:</span>
                    <span className="text-slate-300">{versionActual.autor || 'Equipo DGL'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtros del Historial de Versiones */}
            <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por versión (ej: v2.4), módulo o mejora técnica..."
                  value={versionSearch}
                  onChange={(e) => setVersionSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 bg-slate-50/50"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={versionModuleFilter}
                    onChange={(e) => setVersionModuleFilter(e.target.value)}
                    className="text-xs bg-transparent border-none text-slate-700 font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="TODOS">Todos los Módulos</option>
                    <option value="Auditoría">Auditoría & Seguridad</option>
                    <option value="Tarifario">Tarifario</option>
                    <option value="Cotizador">Cotizador</option>
                    <option value="Salesforce">Salesforce</option>
                    <option value="Inteligencia Artificial">Inteligencia Artificial</option>
                    <option value="Infraestructura">Infraestructura Nube</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Lista Cronológica de Despliegues */}
            <div className="space-y-4">
              {filteredVersiones.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-slate-200/80 text-center text-slate-500">
                  <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No se encontraron versiones</p>
                  <p className="text-xs text-slate-400 mt-1">Prueba con otros términos de búsqueda o módulo.</p>
                </div>
              ) : (
                filteredVersiones.map((v) => {
                  const isCurrent = v.estado === 'activa';
                  return (
                    <div
                      key={v.version}
                      className={`bg-white rounded-2xl border transition-all shadow-xs overflow-hidden ${
                        isCurrent
                          ? 'border-purple-300 ring-2 ring-purple-500/10'
                          : 'border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="p-5 md:p-6 space-y-3.5">
                        {/* Cabecera de la versión */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-900 text-white shadow-2xs">
                              {v.tag}
                            </span>
                            {isCurrent ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Producción Activa
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Desplegada
                              </span>
                            )}
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {v.fechaFormato}
                            </span>
                          </div>

                          <span className="text-[11px] text-slate-400 font-medium">
                            Autor: {v.autor || 'Equipo DGL'}
                          </span>
                        </div>

                        {/* Título y descripción ejecutiva */}
                        <div>
                          <h3 className="text-base font-bold text-slate-900 tracking-tight">
                            {v.titulo}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                            {v.descripcion}
                          </p>
                        </div>

                        {/* Hitos y Mejoras Clave */}
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                            Mejoras y Funcionalidades Incluidas
                          </span>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {v.detalles.map((detalle, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100 shadow-2xs"
                              >
                                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <span>{detalle}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Módulos Impactados */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-400 mr-1">
                            Módulos:
                          </span>
                          {v.modulos.map((mod) => (
                            <span
                              key={mod}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal para Inspección de Detalles de Bitácora */}
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
