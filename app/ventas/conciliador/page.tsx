'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import {
  ConciliacionItem,
  ConciliacionResumen,
  EerrRegistro,
  SalesforceCuotaRegistro,
  EstadoConciliacion,
  AccionConciliacion,
} from '@/lib/conciliador-types';
import { SessionUser } from '@/lib/types';
import { isSuperAdminRole } from '@/lib/permissions';
import {
  Scale,
  Sparkles,
  Search,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  PlusCircle,
  XCircle,
  HelpCircle,
  Building2,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Bot,
  Send,
  Loader2,
  Check,
  Edit2,
  ArrowRightLeft,
  Trash2,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  Info,
} from 'lucide-react';

const MESES = [
  { num: 1, nombre: 'Enero' },
  { num: 2, nombre: 'Febrero' },
  { num: 3, nombre: 'Marzo' },
  { num: 4, nombre: 'Abril' },
  { num: 5, nombre: 'Mayo' },
  { num: 6, nombre: 'Junio' },
  { num: 7, nombre: 'Julio' },
  { num: 8, nombre: 'Agosto' },
  { num: 9, nombre: 'Septiembre' },
  { num: 10, nombre: 'Octubre' },
  { num: 11, nombre: 'Noviembre' },
  { num: 12, nombre: 'Diciembre' },
];

export default function ConciliadorPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // Parámetros de consulta
  const [selectedMes, setSelectedMes] = useState<number>(1);
  const [selectedAnio, setSelectedAnio] = useState<number>(2026);
  const [selectedDivision, setSelectedDivision] = useState<string>('DGL');
  const [sfSource, setSfSource] = useState<'excel' | 'salesforce_live'>('excel');

  // Datos principales
  const [items, setItems] = useState<ConciliacionItem[]>([]);
  const [resumen, setResumen] = useState<ConciliacionResumen | null>(null);
  const [eerrItems, setEerrItems] = useState<EerrRegistro[]>([]);
  const [sfItems, setSfItems] = useState<SalesforceCuotaRegistro[]>([]);
  const [mesesConDatos, setMesesConDatos] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtros de tabla
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoConciliacion>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Acciones en cola para aplicar a Salesforce
  const [colaAcciones, setColaAcciones] = useState<
    Array<{
      idItem: string;
      accion: AccionConciliacion;
      cuotaId?: string;
      opportunityId?: string;
      nuevoMontoClp?: number;
      nuevaFecha?: string;
      titulo: string;
      justificacion?: string;
    }>
  >([]);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyResultMsg, setApplyResultMsg] = useState<string | null>(null);

  // Asistente IA interactivo
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  // Carga de archivo Excel personalizado
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [archivoCargadoNombre, setArchivoCargadoNombre] = useState<string | null>(null);

  // 1. Validar autenticación y rol SuperAdmin
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  // 2. Cargar datos del período
  const fetchData = async (origenSf = sfSource) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/conciliador/data?mes=${selectedMes}&anio=${selectedAnio}&division=${selectedDivision}&source=${origenSf}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status} al cargar conciliación.`);
      }

      const data = await res.json();
      setItems(data.items || []);
      setResumen(data.resumen || null);
      setEerrItems(data.eerrItems || []);
      setSfItems(data.sfItems || []);
      if (Array.isArray(data.mesesConDatos)) {
        setMesesConDatos(data.mesesConDatos);
      }
      if (data.liveError) {
        alert(`Aviso de Salesforce API: ${data.liveError}`);
      }
    } catch (err: any) {
      console.error('Error cargando datos del conciliador:', err);
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && (isSuperAdminRole(user.role) || user.profileId === 'superadmin')) {
      fetchData();
    }
  }, [user, selectedMes, selectedAnio, selectedDivision, sfSource]);

  // Manejo de carga de archivo Excel personalizado
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mes', String(selectedMes));
    formData.append('anio', String(selectedAnio));
    formData.append('division', selectedDivision);

    try {
      const res = await fetch('/api/conciliador/data', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error procesando el archivo subido.');
      }

      const data = await res.json();
      setItems(data.items || []);
      setResumen(data.resumen || null);
      setEerrItems(data.eerrItems || []);
      setSfItems(data.sfItems || []);
      setArchivoCargadoNombre(file.name);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al subir y procesar el archivo.');
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Consulta al Asistente IA
  const handleAskAi = async (customQuery?: string) => {
    const q = (customQuery || aiQuery).trim();
    if (!q || loadingAi) return;

    setLoadingAi(true);
    setAiResponse(null);
    setShowAiModal(true);

    try {
      const res = await fetch('/api/conciliador/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          eerrItems,
          sfItems,
          items,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al consultar al Asistente IA.');
      }

      const data = await res.json();
      setAiResponse(data.respuesta || 'Sin respuesta generada.');
    } catch (err: any) {
      setAiResponse(`⚠️ Error al consultar con la IA: ${err.message || 'Error de conexión'}`);
    } finally {
      setLoadingAi(false);
    }
  };

  // Asignar acción rápida a una fila
  const handleSeleccionarAccion = (
    item: ConciliacionItem,
    accion: AccionConciliacion,
    params?: { nuevoMontoClp?: number; nuevaFecha?: string }
  ) => {
    const cuotaId = item.cuota?.id;
    const opportunityId = item.cuota?.opportunityId;
    const nuevoMonto = params?.nuevoMontoClp ?? (item.nuevoMontoClp || item.eerr?.montoClp);

    const tituloAccion =
      accion === 'aceptar_match'
        ? `Confirmar Cuadre: ${item.cuota?.opportunityName}`
        : accion === 'ajustar_cuota'
        ? `Ajustar Cuota a $${(nuevoMonto || 0).toLocaleString('es-CL')} CLP en ${item.cuota?.opportunityName}`
        : accion === 'mover_cuota'
        ? `Mover Cuota a fecha efectiva (${item.eerr?.fecha})`
        : accion === 'postergar_mes'
        ? `Postergar Cuota al mes siguiente (${item.mesDestinoPostergar}/${item.anioDestinoPostergar})`
        : accion === 'crear_cuota'
        ? `Crear Cuota de $${(item.eerr?.montoClp || 0).toLocaleString('es-CL')} para ${item.eerr?.referenciaInterna}`
        : `Eliminar Cuota de ${item.cuota?.opportunityName}`;

    // Actualizar estado en grilla local
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, accionAplicada: accion } : it))
    );

    // Agregar o actualizar en la cola de acciones para Salesforce
    setColaAcciones((prev) => {
      const filtered = prev.filter((c) => c.idItem !== item.id);
      return [
        ...filtered,
        {
          idItem: item.id,
          accion,
          cuotaId,
          opportunityId,
          nuevoMontoClp: nuevoMonto,
          nuevaFecha: params?.nuevaFecha || item.eerr?.fecha,
          titulo: tituloAccion,
        },
      ];
    });
  };

  // Enviar cambios acumulados a Salesforce
  const handleEjecutarSincronizacion = async () => {
    if (colaAcciones.length === 0 || isApplying) return;
    setIsApplying(true);
    setApplyResultMsg(null);

    try {
      const res = await fetch('/api/conciliador/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acciones: colaAcciones,
          mes: selectedMes,
          anio: selectedAnio,
          division: selectedDivision,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al sincronizar con Salesforce.');
      }

      const data = await res.json();
      setApplyResultMsg(data.mensaje || 'Sincronización completada con éxito.');
      setColaAcciones([]);
      // Recargar datos actualizados
      await fetchData();
    } catch (err: any) {
      setApplyResultMsg(`⚠️ Fallo: ${err.message || 'Error al aplicar cambios'}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Filtrado de la tabla comparativa
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (filtroEstado !== 'todos' && it.estado !== filtroEstado) return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();

      const matchEerr =
        it.eerr &&
        (it.eerr.razonSocial.toLowerCase().includes(q) ||
          it.eerr.rut.toLowerCase().includes(q) ||
          it.eerr.referenciaInterna.toLowerCase().includes(q) ||
          it.eerr.referenciaExterna.toLowerCase().includes(q) ||
          String(it.eerr.montoClp).includes(q));

      const matchSf =
        it.cuota &&
        (it.cuota.opportunityName.toLowerCase().includes(q) ||
          it.cuota.cuenta.toLowerCase().includes(q) ||
          it.cuota.rutEmpresa.toLowerCase().includes(q) ||
          String(it.cuota.montoClp).includes(q));

      return matchEerr || matchSf;
    });
  }, [items, filtroEstado, searchTerm]);

  // Si está cargando usuario o no es superadmin
  if (loadingUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Validando privilegios de acceso...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = user && (isSuperAdminRole(user.role) || user.profileId === 'superadmin');

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto p-6 flex items-center justify-center">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Acceso Restringido a Administrador / Soporte</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              El módulo <strong>Conciliador de Ingresos (EERR vs Salesforce)</strong> se encuentra actualmente en fase de prueba controlada y está reservado exclusivamente para la cuenta de <strong>Administración y Soporte</strong>.
            </p>
            <div className="pt-2">
              <Link
                href="/ventas"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Volver a Ventas
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Cabecera Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link href="/ventas" className="hover:text-red-700 transition-colors">
                Ventas
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-indigo-600 font-bold">Conciliador de Ingresos</span>
              <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-purple-200">
                Solo Soporte
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Scale className="w-8 h-8 text-indigo-600" />
              <span>Conciliador EERR vs Salesforce</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
              Comparación uno a uno entre la facturación y traspasos internos efectivamente realizados según el Departamento de Gestión y las cuotas de facturación reportadas en Salesforce.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Input oculto para subir archivo */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingFile}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Cargar otro archivo Excel de EERR"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>{isUploadingFile ? 'Subiendo...' : 'Subir Excel EERR'}</span>
            </button>

            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Recargar Conciliación</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros de Período y Fuentes de Datos */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Selector de Mes */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">Mes:</span>
              <select
                value={selectedMes}
                onChange={(e) => setSelectedMes(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {MESES.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.nombre} {mesesConDatos.includes(m.num) ? '✓' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Año */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Año:</span>
              <select
                value={selectedAnio}
                onChange={(e) => setSelectedAnio(parseInt(e.target.value, 10))}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </div>

            {/* Selector de División */}
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">División:</span>
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-indigo-700 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="DGL">DGL (Geotecnia Laboratorio)</option>
                <option value="DAC">DAC</option>
                <option value="DCO">DCO</option>
                <option value="DDA">DDA</option>
                <option value="DEP">DEP</option>
                <option value="DES">DES</option>
                <option value="DGI">DGI</option>
                <option value="DHC">DHC</option>
                <option value="DHI">DHI</option>
                <option value="DIC">DIC</option>
                <option value="DIO">DIO</option>
                <option value="DPR">DPR</option>
                <option value="DTC">DTC</option>
                <option value="TODAS">Todas las Divisiones</option>
              </select>
            </div>
          </div>

          {/* Selector de Origen Salesforce */}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-600">Fuente Salesforce:</span>
            <div className="inline-flex rounded-xl p-0.5 bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setSfSource('excel')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  sfSource === 'excel'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Hoja Excel
              </button>
              <button
                type="button"
                onClick={() => setSfSource('salesforce_live')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                  sfSource === 'salesforce_live'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>⚡ API en Vivo</span>
              </button>
            </div>
          </div>
        </div>

        {/* Archivo cargado feedback si aplica */}
        {archivoCargadoNombre && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-xl text-xs flex items-center justify-between">
            <span className="font-medium">
              ✓ Usando archivo Excel cargado: <strong>{archivoCargadoNombre}</strong>
            </span>
            <button
              onClick={() => {
                setArchivoCargadoNombre(null);
                fetchData();
              }}
              className="text-emerald-700 hover:underline font-bold text-[11px]"
            >
              Volver a Formato EERR oficial
            </button>
          </div>
        )}

        {/* Resumen Ejecutivo de Cuadratura (KPI Cards) */}
        {resumen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: EERR Real */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Facturado EERR
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900">
                  ${resumen.totalEerrClp.toLocaleString('es-CL')}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  ~{resumen.totalEerrUf.toFixed(1)} UF
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {eerrItems.length} comprobantes / facturas
              </span>
            </div>

            {/* KPI 2: Salesforce Proyectado */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Cuotas Salesforce
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-black text-indigo-950">
                  ${resumen.totalSalesforceClp.toLocaleString('es-CL')}
                </span>
                <span className="text-xs font-bold text-indigo-600">
                  ~{resumen.totalSalesforceUf.toFixed(1)} UF
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {sfItems.length} cuotas programadas
              </span>
            </div>

            {/* KPI 3: Diferencia Neta */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Diferencia Neta (EERR - SF)
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span
                  className={`text-xl font-black ${
                    Math.abs(resumen.diferenciaNetaClp) <= 2000
                      ? 'text-emerald-600'
                      : resumen.diferenciaNetaClp > 0
                      ? 'text-blue-600'
                      : 'text-amber-600'
                  }`}
                >
                  {resumen.diferenciaNetaClp > 0 ? '+' : ''}$
                  {resumen.diferenciaNetaClp.toLocaleString('es-CL')}
                </span>
                <span className="text-xs font-bold text-slate-500">
                  {resumen.diferenciaNetaUf > 0 ? '+' : ''}
                  {resumen.diferenciaNetaUf.toFixed(1)} UF
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {Math.abs(resumen.diferenciaNetaClp) <= 2000 ? 'Cuadratura perfecta' : 'Desfase pendiente de cuadre'}
              </span>
            </div>

            {/* KPI 4: Cuadratura y Casos */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Cuadratura Operativa
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-700">
                  {resumen.porcentajeCuadratura}%
                </span>
                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {resumen.conteoConciliados} / {eerrItems.length} ok
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(resumen.porcentajeCuadratura, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Barra de Búsqueda Asistida por IA */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-4 text-white shadow-md">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/50 flex items-center justify-center text-indigo-300 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold tracking-wide">
                  Asistente IA de Búsqueda y Cruce Heurístico (Gemini)
                </h3>
                <p className="text-[11px] text-slate-300">
                  Pregunta por empresa, proyecto, código o monto aproximado para encontrar cuotas difíciles.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAskAi();
                }}
                placeholder="ej: '¿Dónde está la factura de Minera Los Pelambres?'..."
                className="w-full px-3 py-1.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={() => handleAskAi()}
                disabled={loadingAi || !aiQuery.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {loadingAi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                <span>Consultar</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Filtros Rápidos de Estado */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFiltroEstado('todos')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filtroEstado === 'todos'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => setFiltroEstado('conciliado')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroEstado === 'conciliado'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Match Exacto ({resumen?.conteoConciliados || 0})</span>
            </button>
            <button
              onClick={() => setFiltroEstado('diferencia_monto')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroEstado === 'diferencia_monto'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Diferencia de Monto ({resumen?.conteoDiferenciaMonto || 0})</span>
            </button>
            <button
              onClick={() => setFiltroEstado('desfase_temporal')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroEstado === 'desfase_temporal'
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-white text-orange-800 hover:bg-orange-50 border border-orange-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Desfase de Mes ({resumen?.conteoDesfaseTemporal || 0})</span>
            </button>
            <button
              onClick={() => setFiltroEstado('no_proyectado')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroEstado === 'no_proyectado'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-800 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>No Proyectados ({resumen?.conteoNoProyectados || 0})</span>
            </button>
            <button
              onClick={() => setFiltroEstado('no_facturado')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filtroEstado === 'no_facturado'
                  ? 'bg-red-600 text-white shadow-xs'
                  : 'bg-white text-red-800 hover:bg-red-50 border border-red-200'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>No Facturados ({resumen?.conteoNoFacturados || 0})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por RUT, cliente, ref o monto..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Tabla Comparativa Dual: EERR vs Salesforce (Uno a Uno) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <span className="text-xs font-medium">Analizando y conciliando registros de {selectedDivision}...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-20 text-center text-slate-400">
              <Scale className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">No se encontraron registros con los filtros seleccionados</p>
              <p className="text-[11px] text-slate-400 mt-1">Intenta cambiando el mes o limpiando el filtro de búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="py-3 px-4 w-[38%]">Facturación Real EERR (Gestión)</th>
                    <th className="py-3 px-4 w-[24%] text-center">Estado y Diagnóstico IA</th>
                    <th className="py-3 px-4 w-[38%]">Cuota Proyectada (Salesforce DGL)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((it) => {
                    const esConciliado = it.estado === 'conciliado';
                    const esDiferencia = it.estado === 'diferencia_monto';
                    const esDesfase = it.estado === 'desfase_temporal';
                    const esNoProy = it.estado === 'no_proyectado';
                    const esNoFact = it.estado === 'no_facturado';

                    return (
                      <tr
                        key={it.id}
                        className={`transition-colors hover:bg-slate-50/80 ${
                          it.accionAplicada
                            ? 'bg-emerald-50/30'
                            : esConciliado
                            ? 'bg-emerald-50/10'
                            : esDiferencia
                            ? 'bg-amber-50/20'
                            : esDesfase
                            ? 'bg-orange-50/20'
                            : esNoProy
                            ? 'bg-blue-50/20'
                            : 'bg-red-50/20'
                        }`}
                      >
                        {/* LADO IZQUIERDO: EERR */}
                        <td className="py-3.5 px-4 align-top">
                          {it.eerr ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                    it.eerr.tipo === 'traspaso_interno'
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                      : 'bg-blue-100 text-blue-900 border border-blue-200'
                                  }`}
                                >
                                  {it.eerr.tipo === 'traspaso_interno' ? 'Traspaso Interno' : 'Factura'}
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-800">
                                  {it.eerr.referenciaExterna ? `Doc: ${it.eerr.referenciaExterna}` : 'Sin N° Doc'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {it.eerr.fecha}
                                </span>
                              </div>

                              <p className="font-bold text-slate-900 leading-snug">
                                {it.eerr.razonSocial}
                              </p>

                              {it.eerr.rut && (
                                <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                  RUT: {it.eerr.rut}
                                </span>
                              )}

                              <p className="text-[11px] text-slate-600 line-clamp-2 italic">
                                {it.eerr.referenciaInterna || it.eerr.glosa}
                              </p>

                              <div className="pt-1 flex items-baseline gap-2">
                                <span className="font-mono font-bold text-slate-900 text-sm">
                                  ${it.eerr.montoClp.toLocaleString('es-CL')} CLP
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500">
                                  (~{it.eerr.montoUfAprox} UF)
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                              <span className="text-xs italic font-medium">
                                (Sin registro en el EERR este mes)
                              </span>
                            </div>
                          )}
                        </td>

                        {/* CENTRO: ESTADO, DIFERENCIA Y SUGERENCIA IA */}
                        <td className="py-3.5 px-4 align-top text-center border-x border-slate-100 bg-slate-50/40">
                          <div className="flex flex-col items-center gap-1.5">
                            {/* Badge de Estado */}
                            {esConciliado && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Match 100%</span>
                              </span>
                            )}
                            {esDiferencia && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                <span>Diferencia Monto</span>
                              </span>
                            )}
                            {esDesfase && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-200">
                                <Clock className="w-3 h-3 text-orange-600" />
                                <span>Desfase de Mes</span>
                              </span>
                            )}
                            {esNoProy && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                <PlusCircle className="w-3 h-3 text-blue-600" />
                                <span>No Proyectado en SF</span>
                              </span>
                            )}
                            {esNoFact && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-200">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>No Facturado en EERR</span>
                              </span>
                            )}

                            {/* Monto diferencial */}
                            {it.diferenciaClp !== 0 && (
                              <div className="font-mono text-[11px] font-bold">
                                <span className={it.diferenciaClp > 0 ? 'text-blue-700' : 'text-red-700'}>
                                  {it.diferenciaClp > 0 ? '+' : ''}$
                                  {it.diferenciaClp.toLocaleString('es-CL')}
                                </span>
                              </div>
                            )}

                            {/* Sugerencia IA si aplica */}
                            {it.explicacionIa && (
                              <div className="p-2 bg-indigo-50/80 border border-indigo-200/60 rounded-xl text-[10px] text-indigo-900 text-left w-full space-y-1">
                                <div className="flex items-center gap-1 font-bold text-indigo-700">
                                  <Sparkles className="w-3 h-3" />
                                  <span>IA ({it.confianzaIa}% certeza):</span>
                                </div>
                                <p className="leading-snug">{it.explicacionIa}</p>
                              </div>
                            )}

                            {/* Botones de Acción Contextual */}
                            <div className="pt-2 w-full flex flex-col gap-1">
                              {esConciliado && (
                                <button
                                  onClick={() => handleSeleccionarAccion(it, 'aceptar_match')}
                                  disabled={it.accionAplicada === 'aceptar_match'}
                                  className="w-full py-1 px-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-100 disabled:text-emerald-800 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  {it.accionAplicada === 'aceptar_match' ? '✓ Conciliado' : 'Aceptar Cuadre'}
                                </button>
                              )}

                              {esDiferencia && (
                                <button
                                  onClick={() =>
                                    handleSeleccionarAccion(it, 'ajustar_cuota', {
                                      nuevoMontoClp: it.eerr?.montoClp,
                                    })
                                  }
                                  className="w-full py-1 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Ajustar Cuota a ${((it.eerr?.montoClp || 0)).toLocaleString('es-CL')}
                                </button>
                              )}

                              {esDesfase && (
                                <button
                                  onClick={() => handleSeleccionarAccion(it, 'mover_cuota')}
                                  className="w-full py-1 px-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Mover Cuota a este Mes
                                </button>
                              )}

                              {esNoProy && (
                                <button
                                  onClick={() => handleSeleccionarAccion(it, 'crear_cuota')}
                                  className="w-full py-1 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  + Crear Cuota en SF
                                </button>
                              )}

                              {esNoFact && (
                                <div className="grid grid-cols-2 gap-1 w-full">
                                  <button
                                    onClick={() => handleSeleccionarAccion(it, 'postergar_mes')}
                                    className="py-1 px-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-[9px] font-bold cursor-pointer"
                                    title="Postergar al mes siguiente"
                                  >
                                    Postergar Mes
                                  </button>
                                  <button
                                    onClick={() => handleSeleccionarAccion(it, 'eliminar_cuota')}
                                    className="py-1 px-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[9px] font-bold cursor-pointer"
                                    title="Eliminar cuota de Salesforce"
                                  >
                                    Eliminar Cuota
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* LADO DERECHO: SALESFORCE */}
                        <td className="py-3.5 px-4 align-top">
                          {it.cuota ? (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                  Cuota #{it.cuota.numeroCuota}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Fecha Pago: {it.cuota.fechaPago}
                                </span>
                              </div>

                              <p className="font-bold text-slate-900 leading-snug">
                                {it.cuota.opportunityName}
                              </p>

                              <p className="text-[11px] text-slate-600">
                                Cliente: <strong>{it.cuota.cuenta}</strong>
                                {it.cuota.rutEmpresa && ` (RUT: ${it.cuota.rutEmpresa})`}
                              </p>

                              <div className="pt-1 flex items-baseline gap-2">
                                <span className="font-mono font-bold text-indigo-950 text-sm">
                                  ${it.cuota.montoClp.toLocaleString('es-CL')} CLP
                                </span>
                                <span className="text-[10px] font-semibold text-indigo-600">
                                  ({it.cuota.montoUf} UF)
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="py-4 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                              <span className="text-xs italic font-medium">
                                (Sin cuota programada en Salesforce)
                              </span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Barra Flotante de Cambios Preparados para Salesforce */}
        {colaAcciones.length > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-4 z-40 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div>
              <span className="text-xs font-bold block">
                {colaAcciones.length} cambio(s) preparado(s) para sincronizar en Salesforce
              </span>
              <span className="text-[11px] text-slate-400">
                Se ajustarán cuotas, fechas o montos de venta según lo seleccionado.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setColaAcciones([])}
                className="px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowApplyModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                Revisar y Aplicar en Salesforce
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Confirmación y Sincronización en Salesforce */}
      {showApplyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              <span>Aplicar Conciliación en Salesforce</span>
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Revisa las acciones que se enviarán en lote hacia la API de Salesforce:
            </p>

            {applyResultMsg && (
              <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs">
                {applyResultMsg}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
              {colaAcciones.map((c, idx) => (
                <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 block">{c.titulo}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{c.accion}</span>
                  </div>
                  <span className="text-xs font-bold text-indigo-700">✓ Listo</span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowApplyModal(false)}
                disabled={isApplying}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                onClick={handleEjecutarSincronizacion}
                disabled={isApplying || colaAcciones.length === 0}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isApplying ? 'Sincronizando...' : 'Confirmar y Enviar a Salesforce'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Respuesta Asistente IA */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Respuesta del Asistente IA</h3>
              </div>
              <button
                onClick={() => setShowAiModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="py-2 min-h-[120px]">
              {loadingAi ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-indigo-600">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs text-slate-500 font-medium">Analizando cruce semántico y montos...</span>
                </div>
              ) : (
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  {aiResponse}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
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

