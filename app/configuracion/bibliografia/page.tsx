'use client';

import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/Navbar';
import { BibliografiaItem, TipoBibliografia, SessionUser } from '@/lib/types';
import { isAdminRole } from '@/lib/permissions';
import Link from 'next/link';
import {
  Sparkles,
  BookOpen,
  FileText,
  Upload,
  UploadCloud,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
  Search,
  ExternalLink,
  MessageSquare,
  Scale,
  ShieldCheck,
  FileCheck,
  Eye,
  Check,
  Tag,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface BulkFileItem {
  id: string;
  file: File;
  originalName: string;
  sizeFormatted: string;
  titulo: string;
  descripcion: string;
  tags: string;
  isSummarizing: boolean;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
}

export default function BibliografiaPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [activeTab, setActiveTab] = useState<TipoBibliografia>('tecnica');
  const [items, setItems] = useState<BibliografiaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Estados de carga de nuevo documento
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTipo, setUploadTipo] = useState<TipoBibliografia>('tecnica');
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadText, setUploadText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Estados de Carga Masiva
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTipo, setBulkTipo] = useState<TipoBibliografia>('tecnica');
  const [bulkQueue, setBulkQueue] = useState<BulkFileItem[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const [bulkUploadingCurrentIndex, setBulkUploadingCurrentIndex] = useState<number>(-1);
  const [isSummarizingAll, setIsSummarizingAll] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Modal para ver contenido completo
  const [previewItem, setPreviewItem] = useState<BibliografiaItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bibliografia?tipo=${activeTab}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          setItems(data.items);
        }
      }
    } catch (err) {
      console.error('Error cargando bibliografía:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const handleToggleEstado = async (id: string) => {
    try {
      const res = await fetch(`/api/bibliografia/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggleEstado' }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setItems((prev) => prev.map((it) => (it.id === id ? data.item : it)));
        }
      }
    } catch (err) {
      console.error('Error toggling estado:', err);
    }
  };

  const handleDelete = async (id: string, titulo: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${titulo}" de la base de conocimientos?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/bibliografia/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setItems((prev) => prev.filter((it) => it.id !== id));
      }
    } catch (err) {
      console.error('Error deleting bibliografía:', err);
    }
  };

  const handleSaveDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setUploadError('Debes ingresar un título para el documento.');
      return;
    }
    if (!selectedFile && !uploadText.trim()) {
      setUploadError('Debes seleccionar un archivo (PDF, Word, TXT) o escribir el contenido técnico.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      let res: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append('tipo', uploadTipo);
        formData.append('titulo', uploadTitle.trim());
        formData.append('descripcion', uploadDesc.trim());
        formData.append('tags', uploadTags.trim());
        formData.append('file', selectedFile);

        res = await fetch('/api/bibliografia', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/bibliografia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: uploadTipo,
            titulo: uploadTitle.trim(),
            descripcion: uploadDesc.trim(),
            contenidoTexto: uploadText.trim(),
            tags: uploadTags.split(',').map((t) => t.trim()).filter(Boolean),
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar documento');
      }

      const data = await res.json();
      if (data.item) {
        if (data.item.tipo === activeTab) {
          setItems((prev) => [data.item, ...prev]);
        } else {
          setActiveTab(data.item.tipo);
        }
      }

      // Limpiar formulario y cerrar modal
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadDesc('');
      setUploadTags('');
      setUploadText('');
      setSelectedFile(null);
    } catch (err: any) {
      setUploadError(err?.message || 'Error desconocido al subir el documento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddBulkFiles = (filesList: FileList | File[]) => {
    const files = Array.from(filesList).filter((f) => f.size > 0);
    const newItems: BulkFileItem[] = files.map((f) => {
      const cleanName = f.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file: f,
        originalName: f.name,
        sizeFormatted:
          f.size > 1024 * 1024
            ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(f.size / 1024)} KB`,
        titulo: cleanName,
        descripcion: '',
        tags: '',
        isSummarizing: false,
        status: 'pending',
      };
    });
    setBulkQueue((prev) => [...prev, ...newItems]);
  };

  const updateBulkItem = (id: string, patch: Partial<BulkFileItem>) => {
    setBulkQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeBulkItem = (id: string) => {
    setBulkQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleGenerateAiSummary = async (itemId: string) => {
    const item = bulkQueue.find((i) => i.id === itemId);
    if (!item) return;

    setBulkQueue((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, isSummarizing: true } : i))
    );

    try {
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('titulo', item.titulo);

      const res = await fetch('/api/bibliografia/resumir', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBulkQueue((prev) =>
            prev.map((i) =>
              i.id === itemId
                ? {
                    ...i,
                    titulo: data.titulo || i.titulo,
                    descripcion: data.resumen || i.descripcion,
                    tags: data.tags || i.tags,
                    isSummarizing: false,
                  }
                : i
            )
          );
          return;
        }
      }
    } catch (err) {
      console.error('Error al generar resumen IA:', err);
    } finally {
      setBulkQueue((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isSummarizing: false } : i))
      );
    }
  };

  const handleSummarizeAllWithAi = async () => {
    if (isSummarizingAll || isBulkUploading) return;
    setIsSummarizingAll(true);

    for (const item of bulkQueue) {
      if (item.status === 'success') continue;
      await handleGenerateAiSummary(item.id);
    }

    setIsSummarizingAll(false);
  };

  const handleStartBulkUpload = async () => {
    if (bulkQueue.length === 0 || isBulkUploading) return;

    setIsBulkUploading(true);

    for (let i = 0; i < bulkQueue.length; i++) {
      const item = bulkQueue[i];
      if (item.status === 'success') continue;

      setBulkUploadingCurrentIndex(i);
      setBulkQueue((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading' } : it))
      );

      try {
        const formData = new FormData();
        formData.append('tipo', bulkTipo);
        formData.append('titulo', item.titulo.trim() || item.originalName);
        formData.append('descripcion', item.descripcion.trim());
        formData.append('tags', item.tags.trim());
        formData.append('file', item.file);

        const res = await fetch('/api/bibliografia', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al procesar subida');
        }

        const data = await res.json();
        if (data.item) {
          setBulkQueue((prev) =>
            prev.map((it, idx) => (idx === i ? { ...it, status: 'success' } : it))
          );
        }
      } catch (err: any) {
        setBulkQueue((prev) =>
          prev.map((it, idx) =>
            idx === i
              ? { ...it, status: 'error', errorMessage: err?.message || 'Error al cargar' }
              : it
          )
        );
      }
    }

    setIsBulkUploading(false);
    setBulkUploadingCurrentIndex(-1);

    // Actualizar lista principal
    await fetchItems();
  };

  const filteredItems = items.filter((it) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      it.titulo.toLowerCase().includes(q) ||
      (it.descripcion && it.descripcion.toLowerCase().includes(q)) ||
      (it.tags && it.tags.some((t) => t.toLowerCase().includes(q))) ||
      it.contenidoTexto.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Encabezado y Explicación */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Base de Conocimientos y Bibliografía IA
                </h1>
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                  RAG Institucional DGL
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Carga de documentos técnicos, normas chilenas oficiales (NCh, ASTM, Manual de Carreteras MOP) y gestión
                del archivo histórico de consultas para el Asistente IA de cotizaciones.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setBulkTipo(activeTab);
                setShowBulkModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Carga Masiva (PDFs)</span>
            </button>

            <button
              onClick={() => {
                setUploadTipo(activeTab);
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Cargar Individual</span>
            </button>
          </div>
        </div>

        {/* Banner de Regla de Prevalencia Técnica */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 shadow-2xs flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
            <Scale className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <h3 className="font-bold text-amber-950 flex items-center gap-2">
              <span>Regla de Prevalencia Técnica Obligatoria</span>
              <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded">
                Criterio Maestro
              </span>
            </h3>
            <p className="text-amber-900 mt-0.5 leading-relaxed">
              La <strong>Bibliografía Técnica</strong> (normativa oficial NCh, ASTM, Manual de Carreteras, especificaciones
              de laboratorio) es la <strong>máxima autoridad</strong> técnica para la IA y <strong>prevalece siempre</strong>{' '}
              sobre cualquier interacción guardada en la <strong>Bibliografía Histórica</strong>. En caso de discrepancia,
              Gemini respetará siempre el criterio de la norma técnica.
            </p>
          </div>
        </div>

        {/* Pestañas de Navegación: Técnica vs Histórica */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('tecnica')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'tecnica'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileCheck className="w-4 h-4" />
              <span>Bibliografía Técnica (Normas y Procedimientos)</span>
            </button>

            <button
              onClick={() => setActiveTab('historica')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'historica'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Bibliografía Histórica (Chats y Casos Previos)</span>
            </button>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar en bibliografía..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            />
          </div>
        </div>

        {/* Listado de Documentos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs">Cargando base de conocimientos...</span>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs">
              <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-800">No hay documentos en esta sección</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {activeTab === 'tecnica'
                  ? 'Carga especificaciones técnicas, normas NCh o memorias de laboratorio para enriquecer el criterio de la IA.'
                  : 'Los chats guardados al reiniciar el asistente o al emitir cotizaciones aparecerán en esta sección.'}
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setBulkTipo(activeTab);
                    setShowBulkModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Carga Masiva (PDFs)</span>
                </button>
                <button
                  onClick={() => {
                    setUploadTipo(activeTab);
                    setShowUploadModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cargar Individual</span>
                </button>
              </div>
            </div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                className={`bg-white rounded-2xl p-5 border transition-all shadow-xs flex flex-col justify-between ${
                  item.estado === 'activo'
                    ? 'border-slate-200/80 hover:border-indigo-300'
                    : 'border-slate-200 opacity-60 bg-slate-50/50'
                }`}
              >
                <div>
                  {/* Top Bar Card */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        item.tipo === 'tecnica'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-purple-50 text-purple-700 border border-purple-200'
                      }`}
                    >
                      {item.tipo === 'tecnica' ? 'Norma / Técnica' : 'Caso Histórico'}
                    </span>

                    <button
                      onClick={() => handleToggleEstado(item.id)}
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                        item.estado === 'activo'
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title="Activar o desactivar este documento para la IA"
                    >
                      {item.estado === 'activo' ? '✓ Activo en IA' : '○ Inactivo'}
                    </button>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-1.5">
                    {item.titulo}
                  </h3>

                  {item.descripcion && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                      {item.descripcion}
                    </p>
                  )}

                  {/* Tags */}
                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.slice(0, 3).map((t, idx) => (
                        <span
                          key={idx}
                          className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Card */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 mt-2">
                  <div className="flex flex-col text-[11px]">
                    <span className="font-medium text-slate-600">{item.nombreArchivoOriginal || item.tipoArchivo}</span>
                    <span>{new Date(item.creadoEn).toLocaleDateString('es-CL')}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewItem(item)}
                      className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                      title="Ver texto indexado para la IA"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDelete(item.id, item.titulo)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Eliminar de la base de conocimientos"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal para Carga de Documento / Norma */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Cargar Documento a Base de Conocimientos
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Soporta archivos PDF, Word (.docx), Planillas Excel y notas de texto
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocument} className="space-y-4 text-xs">
              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* Selector de Tipo */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Categoría de Bibliografía</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setUploadTipo('tecnica')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      uploadTipo === 'tecnica'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="font-bold block text-xs">Bibliografía Técnica</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Normas oficiales NCh, ASTM, MOP (Máxima Autoridad)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadTipo('historica')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      uploadTipo === 'historica'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span className="font-bold block text-xs">Bibliografía Histórica</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Casos de proyectos pasados y acuerdos previos
                    </span>
                  </button>
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Título del Documento o Norma *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: NCh 1508:2014 Geotecnia - Estudio de Mecánica de Suelos"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 text-xs"
                />
              </div>

              {/* Archivo adjunto */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Archivo de Respaldo (Opcional)</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setSelectedFile(file);
                        if (!uploadTitle) {
                          setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer text-xs"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{selectedFile ? 'Cambiar Archivo' : 'Seleccionar Archivo'}</span>
                  </button>
                  {selectedFile && (
                    <span className="text-xs text-indigo-700 font-medium truncate max-w-xs">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                    </span>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción Breve</label>
                <input
                  type="text"
                  placeholder="Resumen del alcance técnico o proyecto asociado..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 text-xs"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Etiquetas (Separadas por coma)</label>
                <input
                  type="text"
                  placeholder="NCh1508, Suelos, Rocas, Edometría..."
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 text-xs"
                />
              </div>

              {/* Contenido / Texto directo */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Contenido Técnico / Extracto Normativo (Si no subes archivo)
                </label>
                <textarea
                  rows={4}
                  placeholder="Escribe o pega aquí los artículos, exigencias normativas o batería técnica..."
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-slate-50/50 text-xs"
                />
              </div>

              {/* Botones */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>Guardar e Indexar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Visualizar Texto Completo Indexado */}
      {previewItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    previewItem.tipo === 'tecnica'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}
                >
                  {previewItem.tipo === 'tecnica' ? 'Bibliografía Técnica' : 'Bibliografía Histórica'}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{previewItem.titulo}</h3>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-3">
              {previewItem.descripcion && (
                <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {previewItem.descripcion}
                </p>
              )}

              <div>
                <span className="font-semibold text-slate-700 block mb-1">
                  Texto Indexado y Disponible para Gemini:
                </span>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl text-[11px] font-mono whitespace-pre-wrap max-h-72 overflow-y-auto border border-slate-800 leading-relaxed">
                  {previewItem.contenidoTexto}
                </pre>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Carga Masiva de Bibliografía */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            {/* Header del Modal */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Carga Masiva de Bibliografía y Normas Técnicas
                    </h3>
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                      Asistente IA Integrado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Selecciona múltiples documentos PDF o Word. Podrás personalizar el nombre, dejar la descripción como opcional o generar un resumen de ~20 palabras con IA antes de subirlos uno por uno.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isBulkUploading) setShowBulkModal(false);
                }}
                disabled={isBulkUploading}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ✕
              </button>
            </div>

            {/* Categoría y Acciones Globales */}
            <div className="py-3 border-b border-slate-100 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Categoría:</span>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setBulkTipo('tecnica')}
                    disabled={isBulkUploading}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      bulkTipo === 'tecnica'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bibliografía Técnica (Normas)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTipo('historica')}
                    disabled={isBulkUploading}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      bulkTipo === 'historica'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Bibliografía Histórica (Casos)
                  </button>
                </div>
              </div>

              {bulkQueue.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSummarizeAllWithAi}
                    disabled={isSummarizingAll || isBulkUploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                    title="Lee cada documento pendiente y genera título formal y un resumen técnico de ~20 palabras con IA"
                  >
                    {isSummarizingAll ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                        <span>Resumiendo con IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>✨ Resumir todos con IA (~20 palabras)</span>
                      </>
                    )}
                  </button>

                  {!isBulkUploading && (
                    <button
                      type="button"
                      onClick={() => setBulkQueue([])}
                      className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 rounded cursor-pointer transition-colors"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Dropzone para Arrastrar o Seleccionar Múltiples Archivos */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  handleAddBulkFiles(e.dataTransfer.files);
                }
              }}
              className={`mt-3 p-4 border-2 border-dashed rounded-2xl text-center transition-all ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/60'
                  : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50'
              } shrink-0 cursor-pointer`}
              onClick={() => bulkFileInputRef.current?.click()}
            >
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.xlsx,.xls,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleAddBulkFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />

              <div className="flex flex-col items-center justify-center gap-1">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  Haz clic para examinar o arrastra múltiples archivos PDF / Word aquí
                </p>
                <p className="text-[11px] text-slate-500">
                  Selecciona todos los documentos que desees cargar de una sola vez
                </p>
              </div>
            </div>

            {/* Lista de Documentos en Cola (Staging Previo a Cargar) */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-3 pr-1 min-h-[160px]">
              {bulkQueue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center py-10 text-slate-400 text-xs">
                  <FileText className="w-8 h-8 text-slate-300 mb-2" />
                  <span>Aún no has agregado documentos. Selecciona archivos arriba para comenzar.</span>
                </div>
              ) : (
                bulkQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col gap-2.5 ${
                      item.status === 'uploading'
                        ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-400/20'
                        : item.status === 'success'
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : item.status === 'error'
                        ? 'border-red-300 bg-red-50/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    {/* Fila 1: Archivo Original y Estado */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-800 truncate block text-[11px]">
                            {item.originalName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.sizeFormatted}
                          </span>
                        </div>
                      </div>

                      {/* Estado */}
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'pending' && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Pendiente
                          </span>
                        )}
                        {item.status === 'uploading' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Subiendo...</span>
                          </span>
                        )}
                        {item.status === 'success' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>✓ Subido</span>
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 flex items-center gap-1" title={item.errorMessage}>
                            <AlertTriangle className="w-3 h-3 text-red-600" />
                            <span>Error al cargar</span>
                          </span>
                        )}

                        {!isBulkUploading && item.status !== 'success' && (
                          <button
                            type="button"
                            onClick={() => removeBulkItem(item.id)}
                            className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                            title="Quitar de la lista"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Fila 2: Nombre Editable + Botón Resumen IA */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                          Nombre / Título en Plataforma *
                        </label>
                        <input
                          type="text"
                          value={item.titulo}
                          disabled={isBulkUploading || item.status === 'success'}
                          onChange={(e) => updateBulkItem(item.id, { titulo: e.target.value })}
                          placeholder="Ej: NCh 1508:2014 Geotecnia..."
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                        />
                      </div>

                      <div className="sm:self-end">
                        <button
                          type="button"
                          disabled={item.isSummarizing || isBulkUploading || item.status === 'success'}
                          onClick={() => handleGenerateAiSummary(item.id)}
                          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer disabled:opacity-50 h-[32px]"
                          title="Lee el documento con IA y redacta un resumen técnico de ~20 palabras y título formal"
                        >
                          {item.isSummarizing ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-600" />
                              <span>Leyendo documento...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>✨ Resumen IA (~20 palabras)</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Fila 3: Descripción (Opcional o generada por IA) */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-0.5">
                        Descripción Técnica (Opcional / Resumen de ~20 palabras)
                      </label>
                      <textarea
                        rows={2}
                        value={item.descripcion}
                        disabled={isBulkUploading || item.status === 'success'}
                        onChange={(e) => updateBulkItem(item.id, { descripcion: e.target.value })}
                        placeholder="Descripción opcional del documento o generada automáticamente por el asistente de IA..."
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer con Progreso y Ejecución de Carga Secuencial */}
            <div className="pt-3 border-t border-slate-100 mt-3 shrink-0 space-y-3">
              {isBulkUploading && (
                <div className="space-y-1.5 bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-900 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>Subiendo documento {bulkUploadingCurrentIndex + 1} de {bulkQueue.length} uno por uno...</span>
                    </span>
                    <span className="text-indigo-700 font-mono text-[11px] font-bold">
                      {Math.round(((bulkQueue.filter((i) => i.status === 'success').length) / bulkQueue.length) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.round(((bulkQueue.filter((i) => i.status === 'success').length) / bulkQueue.length) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  {bulkQueue.length > 0
                    ? `${bulkQueue.filter((i) => i.status === 'success').length} de ${bulkQueue.length} documentos subidos exitosamente.`
                    : 'Sin documentos seleccionados.'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isBulkUploading) {
                        setShowBulkModal(false);
                        fetchItems();
                      }
                    }}
                    disabled={isBulkUploading}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-40"
                  >
                    {bulkQueue.some((i) => i.status === 'success') ? 'Cerrar' : 'Cancelar'}
                  </button>

                  {bulkQueue.length > 0 && bulkQueue.every((i) => i.status === 'success') ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkModal(false);
                        setBulkQueue([]);
                        fetchItems();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Finalizar y Ver Documentos</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={bulkQueue.length === 0 || isBulkUploading || bulkQueue.every((i) => i.status === 'success')}
                      onClick={handleStartBulkUpload}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isBulkUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Subiendo ({bulkUploadingCurrentIndex + 1}/{bulkQueue.length})...</span>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          <span>
                            Subir {bulkQueue.filter((i) => i.status !== 'success').length} Documento(s) Uno por Uno
                          </span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
