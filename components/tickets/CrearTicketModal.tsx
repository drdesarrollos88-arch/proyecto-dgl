'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Bug,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Trash2,
  Send,
  User,
  Clock,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { TicketTipo, TicketPrioridad, TicketInput } from '@/lib/tickets-types';
import { SessionUser } from '@/lib/types';

interface CrearTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated?: () => void;
  currentUser?: SessionUser | null;
}

const MODULOS_DISPONIBLES = [
  'Cotizador (Creación / Edición)',
  'Pipeline Comercial & Metas',
  'Clientes, Empresas & Contactos',
  'Tarifario & Ensayos',
  'Integración Salesforce CRM',
  'Conciliador de Facturación',
  'General / Otro',
];

export default function CrearTicketModal({
  isOpen,
  onClose,
  onTicketCreated,
  currentUser,
}: CrearTicketModalProps) {
  const [tipo, setTipo] = useState<TicketTipo>('error');
  const [prioridad, setPrioridad] = useState<TicketPrioridad>('media');
  const [modulo, setModulo] = useState<string>('Cotizador (Creación / Edición)');
  const [titulo, setTitulo] = useState<string>('');
  const [descripcion, setDescripcion] = useState<string>('');
  const [capturaPantalla, setCapturaPantalla] = useState<string | null>(null);
  const [isPasting, setIsPasting] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fecha y hora actual formateada
  const [currentDateTime, setCurrentDateTime] = useState<string>('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentDateTime(
        new Intl.DateTimeFormat('es-CL', {
          timeZone: 'America/Santiago',
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(now)
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listener global de teclado para capturar Ctrl+V (Pegar imagen desde el portapapeles)
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                setCapturaPantalla(event.target.result as string);
                setIsPasting(true);
                setTimeout(() => setIsPasting(false), 2000);
              }
            };
            reader.readAsDataURL(blob);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('El archivo seleccionado debe ser una imagen (PNG, JPG, WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setCapturaPantalla(event.target.result as string);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descripcion.trim()) {
      setErrorMsg('Por favor completa el título y la descripción del reporte.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: TicketInput = {
        tipo,
        prioridad,
        modulo,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        capturaPantalla: capturaPantalla || undefined,
      };

      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el ticket');

      setSuccessMsg(`Ticket ${data.ticket?.id || ''} enviado con éxito al Superadmin.`);
      setTimeout(() => {
        setTitulo('');
        setDescripcion('');
        setCapturaPantalla(null);
        setSuccessMsg(null);
        onTicketCreated?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al enviar ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-red-900 via-rose-900 to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <Bug className="w-5 h-5 text-rose-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-rose-500/30 text-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full border border-rose-400/30 uppercase tracking-wider">
                  Módulo de Soporte
                </span>
                <span className="text-[11px] text-rose-200/90 font-medium">
                  Reporte de Errores & Mejoras
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white">
                Crear Ticket para Superadmin
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-rose-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Mensajes de Alerta */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Ficha del Solicitante (Automático) */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span>
                Solicitante: <strong className="text-slate-900 dark:text-white">{currentUser?.name || 'Usuario Actual'}</strong>{' '}
                ({currentUser?.email || 'email@idiem.cl'})
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentDateTime}</span>
            </div>
          </div>

          {/* Selector de Tipo y Prioridad */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tipo */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Ticket
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TicketTipo)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-red-500"
              >
                <option value="error">🐛 Error / Bug Detectado</option>
                <option value="mejora">✨ Mejora / Sugerencia</option>
                <option value="consulta">❓ Duda / Soporte Técnico</option>
                <option value="urgente">🚨 Problema Crítico / Urgente</option>
              </select>
            </div>

            {/* Prioridad */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nivel de Prioridad
              </label>
              <select
                value={prioridad}
                onChange={(e) => setPrioridad(e.target.value as TicketPrioridad)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-red-500"
              >
                <option value="baja">Baja (Detalle cosmético)</option>
                <option value="media">Media (Comportamiento irregular)</option>
                <option value="alta">Alta (Bloquea flujo de trabajo)</option>
                <option value="critica">Crítica (Caída o error fatal)</option>
              </select>
            </div>

            {/* Módulo Afectado */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Módulo Afectado
              </label>
              <select
                value={modulo}
                onChange={(e) => setModulo(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-red-500"
              >
                {MODULOS_DISPONIBLES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Asunto / Resumen Breve <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Error al calcular descuento en ensayo SPT o campo RUT no guarda..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500 font-medium"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Descripción Detallada <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Describe qué ocurrió, qué pasos seguiste para que pasara, o qué comportamiento esperabas..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Zona de Pegar Captura de Pantalla (Ctrl+V) o Subir */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Captura de Pantalla / Evidencia Visual</span>
              </label>
              <span className="text-[11px] font-bold text-red-600 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-full">
                ¡Puedes presionar Ctrl + V para pegar directamente!
              </span>
            </div>

            {capturaPantalla ? (
              <div className="relative rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-950/20 p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    onClick={() => setPreviewZoom(true)}
                    className="w-20 h-16 rounded-lg overflow-hidden border border-slate-200 bg-black cursor-pointer group relative shrink-0 shadow-2xs"
                  >
                    <img
                      src={capturaPantalla}
                      alt="Captura adjunta"
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Captura adjunta exitosamente
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Haz clic en la imagen para verla en grande o cámbiala con el botón eliminar
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setCapturaPantalla(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                  title="Eliminar captura"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`p-5 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer text-center ${
                  isPasting
                    ? 'border-emerald-500 bg-emerald-50/50 scale-[1.01]'
                    : 'border-slate-300 dark:border-slate-700 hover:border-red-400 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 flex items-center justify-center mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Copia una captura con Windows (Win + Shift + S) y presiona{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-[10px]">
                    Ctrl + V
                  </kbd>
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  o haz clic aquí para seleccionar un archivo de imagen desde tu computador
                </p>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={isSubmitting || !!successMsg}
            onClick={handleSubmit}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer transition-transform hover:scale-102 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Enviando Ticket...' : 'Enviar Reporte al Superadmin'}</span>
          </button>
        </div>
      </div>

      {/* Modal Zoom de Captura */}
      {previewZoom && capturaPantalla && (
        <div
          onClick={() => setPreviewZoom(false)}
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img src={capturaPantalla} alt="Captura ampliada" className="max-w-full max-h-[88vh] rounded-xl shadow-2xl object-contain" />
            <button
              onClick={() => setPreviewZoom(false)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

