'use client';

import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  AlertCircle,
  CheckCircle2,
  X,
  RefreshCw,
  Users,
  ShieldCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface BulkUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RowError {
  fila: number;
  rut?: string;
  email?: string;
  error: string;
}

interface ImportSummary {
  totalFilas: number;
  creados: number;
  actualizados: number;
  errores: RowError[];
}

export default function BulkUsersModal({ isOpen, onClose, onSuccess }: BulkUsersModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Descargar plantilla Excel oficial
  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      setErrorMessage(null);
      const res = await fetch('/api/users/template');
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al generar la plantilla oficial.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Carga_Masiva_Usuarios_DGL.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo descargar la plantilla.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Manejar selección de archivo
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    setSummary(null);
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.name.endsWith('.xlsx')) {
        setErrorMessage('El archivo debe tener extensión Microsoft Excel (.xlsx).');
        setFile(null);
        return;
      }
      setFile(selected);
    }
  };

  // Subir y procesar la planilla
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Por favor seleccione una planilla Excel para procesar.');
      return;
    }

    try {
      setUploading(true);
      setErrorMessage(null);
      setSummary(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/users/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error al procesar el archivo Excel.');
      }

      setSummary(data.result);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error durante la carga masiva.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setSummary(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="px-6 py-4 bg-linear-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Carga Masiva de Usuarios y Permisos
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Excel (.xlsx)
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Crea o actualiza usuarios, roles y matriz de permisos por módulos con la plantilla oficial.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Mensaje de Error Global */}
          {errorMessage && (
            <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-900 flex items-start gap-3 text-xs animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Error en la operación</p>
                <p className="mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* PASO 1: Descargar Plantilla */}
          <div className="border border-slate-200 rounded-xl p-4.5 bg-slate-50/70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    Descargar Plantilla Oficial Excel
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1 pl-8">
                  Contiene las 2 hojas oficiales: <strong>Usuarios y Permisos</strong> (con los 26 permisos organizados en los 10 módulos del sistema) y la <strong>Guía de Perfiles y Roles</strong> con instrucciones de llenado.
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2.5 pl-8">
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    Cotizador & PDFs
                  </span>
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    CRM & Ventas
                  </span>
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    Tarifario Oficial
                  </span>
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    Clientes & Proyectos
                  </span>
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    Tickets & Soporte
                  </span>
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    IA Copiloto & RAG
                  </span>
                  <span className="text-[10px] font-medium bg-white px-2 py-0.5 rounded-md border border-slate-200 text-slate-600">
                    RBAC y Auditoría
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {downloadingTemplate ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Plantilla</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* PASO 2: Subir Planilla Diligenciada */}
          <div className="border border-slate-200 rounded-xl p-4.5 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h4 className="text-sm font-bold text-slate-900">
                Subir Planilla Diligenciada
              </h4>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  file
                    ? 'border-blue-500 bg-blue-50/40'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  onChange={handleFileChange}
                />

                <FileSpreadsheet
                  className={`w-10 h-10 mx-auto mb-2 ${
                    file ? 'text-blue-600' : 'text-slate-400'
                  }`}
                />

                {file ? (
                  <div>
                    <p className="text-sm font-bold text-slate-900">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB — Listo para procesar
                    </p>
                    <p className="text-[11px] text-blue-600 font-medium mt-1">
                      Clic para cambiar de archivo
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Haz clic para seleccionar o arrastra tu archivo Excel aquí
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Formato admitido: Microsoft Excel (.xlsx)
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Los usuarios existentes se actualizarán y los nuevos se registrarán.</span>
                </div>

                <div className="flex items-center gap-2">
                  {file && (
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={uploading}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 font-medium"
                    >
                      Limpiar
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!file || uploading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Procesando usuarios...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Cargar y Aplicar Usuarios</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* RESUMEN DE PROCESAMIENTO */}
          {summary && (
            <div className="border border-emerald-200 rounded-xl bg-emerald-50/50 p-4.5 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <h4 className="text-sm font-bold">
                  Procesamiento de Usuarios Completado Exitosamente
                </h4>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                  <div className="text-xs text-slate-500 font-medium">Filas Procesadas</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">{summary.totalFilas}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                  <div className="text-xs text-emerald-600 font-medium">Usuarios Creados</div>
                  <div className="text-lg font-black text-emerald-700 mt-0.5">{summary.creados}</div>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100 shadow-2xs">
                  <div className="text-xs text-blue-600 font-medium">Usuarios Actualizados</div>
                  <div className="text-lg font-black text-blue-700 mt-0.5">{summary.actualizados}</div>
                </div>
              </div>

              {/* Errores o advertencias en filas individuales */}
              {summary.errores.length > 0 && (
                <div className="mt-3 pt-3 border-t border-emerald-200/60">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Advertencias u omisiones en {summary.errores.length} fila(s):</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 text-[11px] bg-white p-2.5 rounded-lg border border-amber-200 text-slate-700">
                    {summary.errores.map((err, idx) => (
                      <div key={idx} className="flex items-start justify-between gap-2 border-b border-slate-100 pb-1 last:border-b-0 last:pb-0">
                        <div>
                          <span className="font-semibold text-slate-900">Fila {err.fila}:</span>{' '}
                          {err.rut && <span className="text-slate-500 font-mono">[{err.rut}] </span>}
                          {err.email && <span className="text-slate-500">({err.email}) </span>}
                          <span className="text-rose-600">{err.error}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pie del Modal */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Permisos RBAC sincronizados con Supabase y respaldo de sesión</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

