'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import { ReglaAprendida, CasoReferenciaRAG, TarifarioItem, EstadoReglaAprendida } from '@/lib/types';
import {
  Brain,
  Sparkles,
  BookOpen,
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  RefreshCw,
  FolderArchive,
  Lightbulb,
  Cpu,
  ShieldCheck,
  Tag,
  FileCheck,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

export default function AprendizajeIaPage() {
  const [activeTab, setActiveTab] = useState<'reglas' | 'rag'>('reglas');
  const [loading, setLoading] = useState(true);
  const [reglas, setReglas] = useState<ReglaAprendida[]>([]);
  const [casosRAG, setCasosRAG] = useState<CasoReferenciaRAG[]>([]);
  const [tarifario, setTarifario] = useState<TarifarioItem[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    activas: 0,
    pendientes: 0,
    descartadas: 0,
    totalConfirmaciones: 0,
    totalCasosRAG: 0,
  });

  // Filtros de reglas
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | EstadoReglaAprendida>('todos');

  // Modal para agregar regla manual
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    terminoUsuario: '',
    codigoEnsayo: '',
    observacionSugerida: '',
    tipo: 'sinonimo' as 'sinonimo' | 'observacion_frecuente',
  });
  const [savingModal, setSavingModal] = useState(false);

  // Simulador de búsqueda RAG
  const [simuladorQuery, setSimuladorQuery] = useState('Cantera de roca en Melipilla para colpas de escolleras marítimas');
  const [simuladorResultados, setSimuladorResultados] = useState<{
    casos: CasoReferenciaRAG[];
    snippet: string;
  } | null>(null);
  const [simulando, setSimulando] = useState(false);

  // Carga inicial
  const fetchData = async () => {
    setLoading(true);
    try {
      const [resFeedback, resTarifario, resCasos] = await Promise.all([
        fetch('/api/ai/feedback').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/tarifario').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/ai/rag-casos').then((r) => (r.ok ? r.json() : null)),
      ]);

      if (resFeedback) {
        setReglas(resFeedback.reglas || []);
        if (resFeedback.stats) setStats(resFeedback.stats);
      }
      if (resTarifario?.items) {
        setTarifario(resTarifario.items);
      }
      if (resCasos?.casos) {
        setCasosRAG(resCasos.casos);
      }
    } catch (err) {
      console.error('Error al cargar datos de aprendizaje IA:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrado de reglas
  const filteredReglas = useMemo(() => {
    return reglas.filter((r) => {
      if (statusFilter !== 'todos' && r.estado !== statusFilter) return false;
      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase();
      return (
        r.terminoUsuario.toLowerCase().includes(q) ||
        (r.codigoEnsayo && r.codigoEnsayo.toLowerCase().includes(q)) ||
        (r.designacion && r.designacion.toLowerCase().includes(q)) ||
        (r.observacionSugerida && r.observacionSugerida.toLowerCase().includes(q))
      );
    });
  }, [reglas, searchTerm, statusFilter]);

  // Cambiar estado de una regla
  const handleToggleEstado = async (id: string, nuevoEstado: EstadoReglaAprendida) => {
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, estado: nuevoEstado }),
      });
      if (res.ok) {
        setReglas((prev) =>
          prev.map((r) => (r.id === id ? { ...r, estado: nuevoEstado } : r))
        );
      }
    } catch (err) {
      console.error('Error al cambiar estado de regla:', err);
    }
  };

  // Eliminar regla
  const handleDeleteRegla = async (id: string) => {
    if (!confirm('¿Deseas eliminar permanentemente esta regla aprendida?')) return;
    try {
      const res = await fetch(`/api/ai/feedback?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReglas((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error('Error al eliminar regla:', err);
    }
  };

  // Guardar nueva regla manual
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.terminoUsuario.trim()) {
      alert('El término del usuario es obligatorio.');
      return;
    }

    setSavingModal(true);
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: modalForm.tipo,
          terminoUsuario: modalForm.terminoUsuario.trim(),
          codigoEnsayo: modalForm.codigoEnsayo.trim() || undefined,
          observacionSugerida: modalForm.observacionSugerida.trim() || undefined,
          origen: 'manual',
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setModalForm({
          terminoUsuario: '',
          codigoEnsayo: '',
          observacionSugerida: '',
          tipo: 'sinonimo',
        });
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Error al guardar regla');
      }
    } catch (err) {
      console.error('Error al guardar regla manual:', err);
      alert('Error de conexión');
    } finally {
      setSavingModal(false);
    }
  };

  // Simular búsqueda RAG
  const handleSimularRAG = async () => {
    if (!simuladorQuery.trim() || simulando) return;
    setSimulando(true);
    try {
      const res = await fetch('/api/ai/rag-casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: simuladorQuery }),
      });
      if (res.ok) {
        const data = await res.json();
        setSimuladorResultados(data);
      }
    } catch (err) {
      console.error('Error al simular RAG:', err);
    } finally {
      setSimulando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Cabecera Principal */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <span>Configuración</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-indigo-600 font-bold">Memoria y Aprendizaje Continuo IA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
              <Brain className="w-8 h-8 text-indigo-600 animate-pulse" />
              <span>Memoria y Aprendizaje de los Asistentes IA</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-3xl">
              Supervisión de la base de conocimiento histórico (Opción A: RAG) y del diccionario de equivalencias y sinónimos aprendidos en tiempo real por el uso de los ejecutivos (Opción B: Feedback Loop).
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva Regla Manual</span>
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Estado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Reglas Activas (Opción B)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-slate-900">{stats.activas}</span>
                <span className="text-xs text-slate-400">/ {stats.total} registradas</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Confirmaciones por Uso</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-emerald-700">{stats.totalConfirmaciones}</span>
                <span className="text-xs text-emerald-600 font-semibold">veces aplicadas</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Casos RAG Históricos (Opción A)</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-purple-700">{stats.totalCasosRAG}</span>
                <span className="text-xs text-purple-600 font-semibold">obras indexadas</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Privacidad IDIEM</span>
              <span className="text-xs font-bold text-blue-900 block leading-tight">Zero Data Training</span>
              <span className="text-[10px] text-slate-400">100% confidencial y local</span>
            </div>
          </div>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex items-center gap-2 border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('reglas')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'reglas'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lightbulb className="w-4 h-4 text-indigo-600" />
            <span>Pestaña 1: Diccionario de Reglas y Términos Aprendidos (Opción B)</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-bold">
              {stats.activas} activas
            </span>
          </button>

          <button
            onClick={() => setActiveTab('rag')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'rag'
                ? 'border-purple-600 text-purple-700 bg-purple-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-600" />
            <span>Pestaña 2: Base de Conocimiento RAG Geotécnico (Opción A)</span>
            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold">
              {stats.totalCasosRAG} casos
            </span>
          </button>
        </div>

        {/* CONTENIDO PESTAÑA 1: REGLAS Y TÉRMINOS APRENDIDOS (OPCIÓN B) */}
        {activeTab === 'reglas' && (
          <div className="space-y-4">
            {/* Barra de Búsqueda y Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar regla por término, código de ensayo o designación..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="activo">Solo Activas</option>
                  <option value="pendiente_revision">Pendientes de Revisión</option>
                  <option value="descartado">Descartadas</option>
                </select>
              </div>
            </div>

            {/* Tabla de Reglas Aprendidas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Término / Frase de Usuario</th>
                      <th className="py-3 px-4">Ensayo Oficial Asignado (Tarifario DGL)</th>
                      <th className="py-3 px-4 text-center">Confirmaciones</th>
                      <th className="py-3 px-4">Origen</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredReglas.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No se encontraron reglas aprendidas con los filtros aplicados.
                        </td>
                      </tr>
                    ) : (
                      filteredReglas.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded text-indigo-900 border border-slate-200">
                                "{r.terminoUsuario}"
                              </span>
                              {r.tipo === 'observacion_frecuente' && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                  Observación
                                </span>
                              )}
                            </div>
                            {r.observacionSugerida && (
                              <p className="text-[11px] text-slate-500 mt-1 italic line-clamp-1">
                                💬 {r.observacionSugerida}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {r.codigoEnsayo ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                                  Cód. {r.codigoEnsayo}
                                </span>
                                <span className="text-slate-700 font-medium line-clamp-1">
                                  {r.designacion || 'Ensayo oficial'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sin ensayo vinculado</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>{r.conteoConfirmaciones}x</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-[11px] text-slate-500 capitalize">
                              {r.origen === 'chat_ia'
                                ? '💬 Chat Asistente'
                                : r.origen === 'buscador_ensayos'
                                ? '🔍 Buscador'
                                : r.origen === 'analisis_solicitud'
                                ? '🪄 Análisis IA'
                                : '👤 Manual'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() =>
                                handleToggleEstado(
                                  r.id,
                                  r.estado === 'activo' ? 'descartado' : 'activo'
                                )
                              }
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors cursor-pointer ${
                                r.estado === 'activo'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : r.estado === 'pendiente_revision'
                                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {r.estado === 'activo'
                                ? '✓ Activa'
                                : r.estado === 'pendiente_revision'
                                ? '⏳ Revisión'
                                : '✕ Descartada'}
                            </button>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => handleDeleteRegla(r.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar regla"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* CONTENIDO PESTAÑA 2: RAG GEOTÉCNICO HISTÓRICO (OPCIÓN A) */}
        {activeTab === 'rag' && (
          <div className="space-y-6">
            {/* Banner explicativo de RAG */}
            <div className="bg-gradient-to-r from-purple-900 via-indigo-950 to-slate-900 p-5 rounded-2xl text-white shadow-md">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-purple-300 shrink-0 border border-white/10">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-purple-100">
                    ¿Cómo aprende el Asistente IA de las cotizaciones históricas aprobadas?
                  </h3>
                  <p className="text-xs text-purple-200/90 mt-1 max-w-3xl leading-relaxed">
                    Cada vez que un asesor comercial finaliza y emite una propuesta definitiva (PDF oficial), el sistema indexa sus ensayos, cantidades y cláusulas como caso de estudio. <strong>Los borradores no finalizados quedan estrictamente excluidos</strong> para evitar sesgos o propuestas incompletas. Cuando entra una nueva solicitud, el RAG recupera los casos más parecidos y se los inyecta a Gemini como ejemplos demostrativos (Few-Shot Prompting). Así, la IA replica el criterio técnico real de IDIEM sin re-entrenar pesos.
                  </p>
                </div>
              </div>
            </div>

            {/* Simulador Interactivo de Búsqueda RAG */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h4 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                <span>Simulador de Inyección RAG en Tiempo Real</span>
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                Ingresa una solicitud técnica de prueba para ver qué cotizaciones históricas recupera el motor y cómo se presentan a Gemini:
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={simuladorQuery}
                  onChange={(e) => setSimuladorQuery(e.target.value)}
                  placeholder="Ej: Análisis de roca en Cantera Melipilla para colpas de escolleras..."
                  className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={handleSimularRAG}
                  disabled={simulando}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{simulando ? 'Simulando...' : '🔍 Simular Búsqueda RAG'}</span>
                </button>
              </div>

              {simuladorResultados && (
                <div className="mt-4 pt-4 border-t border-slate-100 animate-in fade-in duration-150">
                  <div className="text-xs font-bold text-slate-700 mb-2">
                    🎯 Casos históricos más afines recuperados ({simuladorResultados.casos.length}):
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    {simuladorResultados.casos.map((c, i) => (
                      <div key={i} className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl text-xs">
                        <div className="flex items-center justify-between font-bold text-purple-950 mb-1">
                          <span>{c.codigoCotizacion}</span>
                          <span className="text-[10px] bg-purple-200/80 px-1.5 py-0.5 rounded text-purple-900 font-mono">
                            {c.totalUf} UF
                          </span>
                        </div>
                        <p className="font-semibold text-slate-800">{c.nombreObra}</p>
                        <p className="text-[11px] text-slate-600 mt-1">
                          Cliente: <strong>{c.empresaCliente}</strong> | CC: {c.centroCosto}
                        </p>
                        <div className="mt-2 text-[11px] text-slate-700">
                          <span className="font-bold text-purple-900">Ensayos ({c.ensayosCotizados.length}): </span>
                          {c.ensayosCotizados.map((e) => `[Cód ${e.codigo} x${e.cantidad}]`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>

                  <details className="mt-2">
                    <summary className="text-xs font-bold text-indigo-700 cursor-pointer hover:underline">
                      Ver fragmento de prompt exacto inyectado a Gemini (Few-Shot)
                    </summary>
                    <pre className="mt-2 p-3 bg-slate-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {simuladorResultados.snippet}
                    </pre>
                  </details>
                </div>
              )}
            </div>

            {/* Listado de Casos Históricos Indexados */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderArchive className="w-4 h-4 text-purple-600" />
                  <span>Catálogo de Obras de Referencia Indexadas ({casosRAG.length})</span>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                  ✓ Solo cotizaciones finalizadas (excluye borradores)
                </span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {casosRAG.map((c) => (
                  <div
                    key={c.id}
                    className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl hover:bg-indigo-50/40 hover:border-indigo-200 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-800 mb-1.5">
                      <span className="font-mono text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                        {c.codigoCotizacion}
                      </span>
                      <span className="font-mono text-slate-600">{c.totalUf.toFixed(2)} UF</span>
                    </div>
                    <h5 className="font-bold text-slate-900 text-sm">{c.nombreObra}</h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Cliente: <strong>{c.empresaCliente}</strong> • Sede: {c.ciudad}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Centro de Costo: <span className="font-semibold text-slate-700">{c.centroCosto}</span>
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                      <span className="font-bold text-[11px] text-slate-700 block mb-1">
                        Batería de ensayos aprobada ({c.ensayosCotizados.length} ítems):
                      </span>
                      <ul className="space-y-1">
                        {c.ensayosCotizados.slice(0, 4).map((e, idx) => (
                          <li key={idx} className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="truncate">
                              • [Cód {e.codigo}] {e.designacion}
                            </span>
                            <span className="font-bold text-slate-800 shrink-0 ml-2">{e.cantidad} u</span>
                          </li>
                        ))}
                        {c.ensayosCotizados.length > 4 && (
                          <li className="text-[10px] text-indigo-600 font-semibold italic">
                            + {c.ensayosCotizados.length - 4} ensayos adicionales...
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal para Crear Regla Manual */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-slate-900 mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" />
              <span>Nueva Regla o Equivalencia de Aprendizaje</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enseña al sistema una nueva correlación entre el lenguaje que utilizan los clientes y los códigos del tarifario DGL.
            </p>

            <form onSubmit={handleSaveModal} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Término o Frase que escribe el Usuario / Cliente:
                </label>
                <input
                  type="text"
                  required
                  value={modalForm.terminoUsuario}
                  onChange={(e) => setModalForm({ ...modalForm, terminoUsuario: e.target.value })}
                  placeholder="Ej: triaxial gigante 15x30, colpas de 5 ton, proctor mod..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ensayo Oficial Correspondiente en el Tarifario:
                </label>
                <select
                  value={modalForm.codigoEnsayo}
                  onChange={(e) => setModalForm({ ...modalForm, codigoEnsayo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">Selecciona un ensayo del tarifario...</option>
                  {tarifario.map((t) => (
                    <option key={t.id} value={t.code}>
                      [Cód {t.code}] {t.designation.slice(0, 65)}... ({t.ufPrice} UF)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observación Comercial o Técnica Particular (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={modalForm.observacionSugerida}
                  onChange={(e) => setModalForm({ ...modalForm, observacionSugerida: e.target.value })}
                  placeholder="Ej: Requiere flete y camión pluma coordinado por el mandante."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingModal}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {savingModal ? 'Guardando...' : 'Guardar Regla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

