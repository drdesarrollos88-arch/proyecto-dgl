'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BibliografiaItem, TipoBibliografia, SessionUser } from '@/lib/types';
import { isAdminRole } from '@/lib/permissions';
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

interface BibliografiaSectionProps {
  hideHeaderBanner?: boolean;
}

export default function BibliografiaSection({ hideHeaderBanner = false }: BibliografiaSectionProps) {
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

      const res = await fetch('/api/bibliografia/summarize', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Error al generar resumen');
      }

      const data = await res.json();
      setBulkQueue((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                isSummarizing: false,
                descripcion: data.descripcion || i.descripcion,
                tags: Array.isArray(data.tags) ? data.tags.join(', ') : i.tags,
                titulo: data.tituloSugerido || i.titulo,
              }
            : i
        )
      );
    } catch (err) {
      console.error('Error generando resumen para item:', itemId, err);
      setBulkQueue((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, isSummarizing: false } : i))
      );
    }
  };

  const handleSummarizeAll = async () => {
    if (isSummarizingAll) return;
    setIsSummarizingAll(true);
    for (const item of bulkQueue) {
      if (!item.descripcion && item.status === 'pending') {
        await handleGenerateAiSummary(item.id);
      }
    }
    setIsSummarizingAll(false);
  };

  const handleStartBulkUpload = async () => {
    if (isBulkUploading) return;
    setIsBulkUploading(true);

    for (let i = 0; i < bulkQueue.length; i++) {
      const item = bulkQueue[i];
      if (item.status === 'success') continue;

      setBulkUploadingCurrentIndex(i);
      setBulkQueue((prev) =>
        prev.map((it, idx) => (idx === i ? { ...it, status: 'uploading', errorMessage: undefined } : it))
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
          let errorMsg = `Error HTTP ${res.status}`;
          try {
            const errData = await res.json();
            if (errData && errData.error) errorMsg = errData.error;
          } catch {
            const errText = await res.text().catch(() => '');
            if (errText && errText.length < 150) errorMsg = errText;
          }
          throw new Error(errorMsg);
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

  const handleRetryBulkItem = async (index: number) => {
    if (isBulkUploading) return;
    const item = bulkQueue[index];
    if (!item) return;

    setBulkQueue((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, status: 'uploading', errorMessage: undefined } : it))
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
        let errorMsg = `Error HTTP ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch {
          const errText = await res.text().catch(() => '');
          if (errText && errText.length < 150) errorMsg = errText;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (data.item) {
        setBulkQueue((prev) =>
          prev.map((it, idx) => (idx === index ? { ...it, status: 'success' } : it))
        );
        await fetchItems();
      }
    } catch (err: any) {
      setBulkQueue((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? { ...it, status: 'error', errorMessage: err?.message || 'Error al cargar' }
            : it
        )
      );
    }
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
    <div className="space-y-6">
      {/* Top Banner (Optional if header is already in parent) */}
      {!hideHeaderBanner && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white flex items-center justify-center shadow-sm shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Base de Conocimientos y Bibliografía IA
                </h2>
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
      )}

      {/* Action Bar when banner is hidden */}
      {hideHeaderBanner && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Gestión de Documentos y Normativas RAG
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Normas oficiales NCh, ASTM, Manual de Carreteras MOP y consultas técnicas indexadas.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setBulkTipo(activeTab);
                setShowBulkModal(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Carga Masiva (PDFs)</span>
            </button>

            <button
              onClick={() => {
                setUploadTipo(activeTab);
                setShowUploadModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Documento</span>
            </button>
          </div>
        </div>
      )}

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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tecnica')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
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
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'historica'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Bibliografía Histórica (Chats y Casos)</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
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
              <span className="text-xs">Cargando base de conocimiento...</span>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-bold text-slate-700">No se encontraron documentos en esta sección</h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto mt-1">
              {search
                ? 'Intenta con otro término de búsqueda o limpia el filtro.'
                : 'Carga las normas técnicas oficiales NCh, ASTM o manuales de ensayo para enriquecer la inteligencia del cotizador.'}
            </p>
            {!search && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    setBulkTipo(activeTab);
                    setShowBulkModal(true);
                  }}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
                >
                  Cargar PDFs Masivos
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between ${
                item.estado === 'activo' ? 'border-slate-200' : 'border-slate-200/60 opacity-60 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                      item.tipo === 'tecnica'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {item.tipo === 'tecnica' ? <FileCheck className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                    {item.tipo === 'tecnica' ? 'Norma Técnica' : 'Histórico'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleEstado(item.id)}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold cursor-pointer transition-colors ${
                        item.estado === 'activo'
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title={item.estado === 'activo' ? 'Desactivar para que la IA no lo use' : 'Activar para que la IA lo use'}
                    >
                      {item.estado === 'activo' ? 'Activo en IA' : 'Inactivo'}
                    </button>
                  </div>
                </div>

                <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug mb-1">
                  {item.titulo}
                </h4>

                {item.descripcion && (
                  <p className="text-[11px] text-slate-600 line-clamp-2 mb-3 leading-relaxed">
                    {item.descripcion}
                  </p>
                )}

                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {item.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="text-[10px]">
                  {new Date(item.creadoEn || Date.now()).toLocaleDateString('es-CL')}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewItem(item)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                    title="Ver contenido del documento"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {isAdminRole(user?.role) && (
                    <button
                      onClick={() => handleDelete(item.id, item.titulo)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Preview Documento */}
      {previewItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    previewItem.tipo === 'tecnica' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {previewItem.tipo === 'tecnica' ? 'Norma Técnica Oficial' : 'Histórico'}
                </span>
                <h3 className="text-sm font-bold text-slate-900 mt-1">{previewItem.titulo}</h3>
                {previewItem.descripcion && (
                  <p className="text-xs text-slate-500 mt-0.5">{previewItem.descripcion}</p>
                )}
              </div>

              <button
                onClick={() => setPreviewItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Texto indexado en base RAG:
              </h4>
              <div className="bg-slate-50 p-4 rounded-xl text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-200/60 max-h-96 overflow-y-auto">
                {previewItem.contenidoTexto || 'Sin contenido de texto extraído.'}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Carga Individual */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Cargar Documento Individual</h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleSaveDocument} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipo de Documento</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUploadTipo('tecnica')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadTipo === 'tecnica'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Norma Técnica</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadTipo('historica')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 cursor-pointer ${
                      uploadTipo === 'historica'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Histórico / Casos</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Título de la Norma o Documento <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: NCh 1508:2014 Geotecnia - Estudio de Mecánica de Suelos"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción Breve</label>
                <input
                  type="text"
                  placeholder="Resumen o alcance técnico..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Etiquetas (separadas por coma)</label>
                <input
                  type="text"
                  placeholder="geotecnia, nch1508, suelos, exploracion"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Archivo (PDF, Word, TXT)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                      if (!uploadTitle) {
                        const clean = e.target.files[0].name.replace(/\.[^/.]+$/, '');
                        setUploadTitle(clean);
                      }
                    }
                  }}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-[10px] text-slate-400 uppercase font-semibold">O PEGAR TEXTO</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Contenido de Texto</label>
                <textarea
                  rows={4}
                  placeholder="Si no tienes el archivo, pega aquí el extracto técnico o los procedimientos de la norma..."
                  value={uploadText}
                  onChange={(e) => setUploadText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isUploading ? 'Indexando...' : 'Guardar e Indexar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Carga Masiva (Bulk Upload con Resumen IA) */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Carga Masiva de Documentos y Normas</h3>
                  <p className="text-[11px] text-slate-500">
                    Sube múltiples PDFs a la vez con generación automática de resumen IA en 20 palabras.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (isBulkUploading) {
                    if (!confirm('La carga masiva está en curso. ¿Deseas cerrar?')) return;
                  }
                  setShowBulkModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Dropzone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files) {
                  handleAddBulkFiles(e.dataTransfer.files);
                }
              }}
              onClick={() => bulkFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]'
                  : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <input
                ref={bulkFileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleAddBulkFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
              <UploadCloud className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Arrastra aquí tus archivos PDF o haz clic para explorar
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Formatos compatibles: PDF, DOCX, TXT. Puedes seleccionar decenas de normas o manuales.
              </p>
            </div>

            {/* Queue List */}
            {bulkQueue.length > 0 && (
              <div className="flex-1 overflow-y-auto mt-4 space-y-3 pr-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Archivos en cola ({bulkQueue.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSummarizeAll}
                      disabled={isSummarizingAll || isBulkUploading}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isSummarizingAll ? 'Generando resúmenes...' : 'Resumir todos con IA'}</span>
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      onClick={() => setBulkQueue([])}
                      disabled={isBulkUploading}
                      className="text-xs text-red-600 hover:text-red-800 cursor-pointer disabled:opacity-50"
                    >
                      Limpiar cola
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {bulkQueue.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        item.status === 'success'
                          ? 'bg-emerald-50/40 border-emerald-200'
                          : item.status === 'error'
                          ? 'bg-red-50/40 border-red-200'
                          : item.status === 'uploading'
                          ? 'bg-indigo-50/40 border-indigo-200 ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                            <input
                              type="text"
                              value={item.titulo}
                              onChange={(e) => updateBulkItem(item.id, { titulo: e.target.value })}
                              placeholder="Título del documento..."
                              className="font-bold text-slate-800 text-xs border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none flex-1 bg-transparent"
                            />
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {item.sizeFormatted}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.descripcion}
                              onChange={(e) => updateBulkItem(item.id, { descripcion: e.target.value })}
                              placeholder="Descripción o resumen de 20 palabras..."
                              className="text-[11px] text-slate-600 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none flex-1 bg-transparent"
                            />
                            <button
                              onClick={() => handleGenerateAiSummary(item.id)}
                              disabled={item.isSummarizing || isBulkUploading}
                              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2 py-0.5 rounded flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                              title="Generar resumen automático de 20 palabras con IA"
                            >
                              {item.isSummarizing ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              <span>IA Resumen</span>
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={item.tags}
                              onChange={(e) => updateBulkItem(item.id, { tags: e.target.value })}
                              placeholder="Etiquetas (ej: suelos, nch1508, le304)..."
                              className="text-[10px] text-slate-500 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:outline-none flex-1 bg-transparent"
                            />
                          </div>

                          {item.errorMessage && (
                            <p className="text-[10px] text-red-600 font-medium">
                              Error: {item.errorMessage}
                            </p>
                          )}
                        </div>

                        {/* Status / Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.status === 'success' && (
                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="hidden sm:inline">Listo</span>
                            </span>
                          )}
                          {item.status === 'uploading' && (
                            <span className="text-[11px] font-bold text-indigo-600 flex items-center gap-1">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="hidden sm:inline">Subiendo...</span>
                            </span>
                          )}
                          {item.status === 'error' && (
                            <button
                              onClick={() => handleRetryBulkItem(idx)}
                              disabled={isBulkUploading}
                              className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded hover:bg-amber-200 cursor-pointer"
                            >
                              Reintentar
                            </button>
                          )}
                          {item.status === 'pending' && (
                            <button
                              onClick={() => removeBulkItem(item.id)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="Quitar de la cola"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Tipo de destino:</span>
                <select
                  value={bulkTipo}
                  onChange={(e) => setBulkTipo(e.target.value as TipoBibliografia)}
                  className="text-xs rounded-lg border border-slate-200 px-2.5 py-1 bg-slate-50 font-medium"
                >
                  <option value="tecnica">Norma Técnica Oficial</option>
                  <option value="historica">Histórico / Casos</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBulkModal(false)}
                  disabled={isBulkUploading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleStartBulkUpload}
                  disabled={bulkQueue.length === 0 || isBulkUploading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isBulkUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isBulkUploading
                      ? `Cargando (${bulkUploadingCurrentIndex + 1}/${bulkQueue.length})...`
                      : `Procesar e Indexar (${bulkQueue.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
