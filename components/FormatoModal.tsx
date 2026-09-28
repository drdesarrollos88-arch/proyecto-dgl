'use client';

import React, { useState, useEffect, useRef } from 'react';
import { FormatoSettings } from '@/lib/types';
import {
  X,
  FileText,
  Building,
  Phone,
  Mail,
  Globe,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Upload,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';

interface FormatoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFormatoUpdated?: (settings: FormatoSettings) => void;
}

export default function FormatoModal({ isOpen, onClose, onFormatoUpdated }: FormatoModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormatoSettings>({
    formatCode: 'DGL-FA-193 V3',
    officeTitle: 'Oficina central',
    officeAddress: 'Plaza Ercilla 883, Santiago, Chile',
    contactPhone: '+56 2 2978 4800',
    contactEmail: 'contacto@idiem.cl',
    contactWeb: 'www.idiem.cl',
    budgetTitle: 'PRESUPUESTO ENSAYOS DE LABORATORIO',
    divisionTitle: 'División Geotecnia Laboratorio',
  });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setStatusMessage(null);

    fetch('/api/formato')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          setForm(data.settings);
        }
      })
      .catch((err) => {
        console.error('Error fetching formato settings:', err);
        setStatusMessage({ type: 'error', text: 'Error al cargar la configuración de formato.' });
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'Por favor selecciona un archivo de imagen válido (PNG, JPG o WebP).' });
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setStatusMessage({ type: 'error', text: 'La imagen seleccionada es demasiado grande (máximo 4MB).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Optimize using canvas if image is large (> 800px)
        const maxWidth = 800;
        const maxHeight = 350;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimized = canvas.toDataURL('image/png', 0.95);
          setForm((prev) => ({ ...prev, headerImage: optimized }));
        } else {
          setForm((prev) => ({ ...prev, headerImage: rawDataUrl }));
        }
        setStatusMessage({
          type: 'success',
          text: 'Imagen de encabezado cargada. Haz clic en "Guardar Formato" para aplicar el cambio a los PDF.',
        });
      };
      img.onerror = () => {
        setForm((prev) => ({ ...prev, headerImage: rawDataUrl }));
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleResetLogo = () => {
    setForm((prev) => {
      const copy = { ...prev };
      delete copy.headerImage;
      return copy;
    });
    setStatusMessage({ type: 'success', text: 'Se ha restablecido el logo oficial predeterminado de IDIEM.' });
  };

  const handleResetDefaults = () => {
    setForm({
      formatCode: 'DGL-FA-193 V3',
      officeTitle: 'Oficina central',
      officeAddress: 'Plaza Ercilla 883, Santiago, Chile',
      contactPhone: '+56 2 2978 4800',
      contactEmail: 'contacto@idiem.cl',
      contactWeb: 'www.idiem.cl',
      budgetTitle: 'PRESUPUESTO ENSAYOS DE LABORATORIO',
      headerImage: undefined,
    });
    setStatusMessage({ type: 'success', text: 'Valores restablecidos a los predeterminados oficiales.' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/formato', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok && data.settings) {
        setStatusMessage({ type: 'success', text: 'Configuración del formato oficial guardada exitosamente.' });
        if (onFormatoUpdated) onFormatoUpdated(data.settings);
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Error al guardar la configuración.' });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Error al comunicarse con el servidor.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#1A1A1A] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#E20000]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#E20000] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Editar Formato Oficial</h2>
              <p className="text-xs text-slate-400">
                Personaliza el logo de encabezado, pie de página institucional y código para todas las cotizaciones
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 space-y-4">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs border ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-[#E20000] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500">Cargando formato...</span>
            </div>
          ) : (
            <>
              {/* Image Upload: Logotipo / Encabezado Oficial */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#E20000]" />
                    <span>Logotipo / Imagen de Encabezado Oficial (PDF)</span>
                  </h3>
                  {form.headerImage ? (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      Logo Personalizado
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-600 bg-slate-200/80 px-2 py-0.5 rounded-full">
                      Logo Oficial Predeterminado (IDIEM 125 Años)
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500">
                  Esta imagen se inserta automáticamente en la esquina superior izquierda de <strong>todas las páginas</strong> de cada cotización emitida.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  {/* Image Preview Box */}
                  <div className="h-16 w-44 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-center p-2 flex-shrink-0 relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.headerImage || '/logo_125.png'}
                      alt="Logo Encabezado"
                      className="max-h-14 max-w-full object-contain drop-shadow-xs"
                    />
                  </div>

                  {/* Actions & Description */}
                  <div className="flex-1 flex flex-col gap-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="formato-header-upload"
                      />
                      <label
                        htmlFor="formato-header-upload"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E20000] hover:bg-[#C20000] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Subir Nueva Imagen de Encabezado</span>
                      </label>

                      {form.headerImage && (
                        <button
                          type="button"
                          onClick={handleResetLogo}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Restablecer Predeterminado</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Recomendado: archivo PNG con fondo transparente, proporciones horizontales aprox. 350 × 150 px.
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 1: Code & Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Código de Formato Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.formatCode}
                    onChange={(e) => setForm({ ...form, formatCode: e.target.value })}
                    placeholder="ej. DGL-FA-193 V3"
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-blue-950 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none bg-blue-50/20"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Se imprime en la esquina inferior derecha de cada página sobre el número de hoja.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Título de la Cotización (Página 1) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.budgetTitle}
                    onChange={(e) => setForm({ ...form, budgetTitle: e.target.value })}
                    placeholder="ej. PRESUPUESTO ENSAYOS DE LABORATORIO"
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Encabezado principal centrado sobre la tabla de ensayos.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    División / Unidad Institucional (Firma) *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.divisionTitle || 'División Geotecnia Laboratorio'}
                    onChange={(e) => setForm({ ...form, divisionTitle: e.target.value })}
                    placeholder="ej. División Geotecnia Laboratorio"
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 rounded-xl border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:border-transparent focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Se imprime debajo del cargo del emisor en la firma de cada cotización.
                  </span>
                </div>
              </div>

              {/* Row 2: Oficina Central Details */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-[#E20000]" />
                  <span>Columna Izquierda: Oficina Central</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Título Oficina *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.officeTitle}
                      onChange={(e) => setForm({ ...form, officeTitle: e.target.value })}
                      placeholder="Oficina central"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Dirección *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.officeAddress}
                      onChange={(e) => setForm({ ...form, officeAddress: e.target.value })}
                      placeholder="Plaza Ercilla 883, Santiago, Chile"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Row 3: Contact Details */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#E20000]" />
                  <span>Columna Central: Contacto Institucional</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Teléfono *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      placeholder="+56 2 2978 4800"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Correo Electrónico *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.contactEmail}
                      onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                      placeholder="contacto@idiem.cl"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Sitio Web *
                    </label>
                    <input
                      type="text"
                      required
                      value={form.contactWeb}
                      onChange={(e) => setForm({ ...form, contactWeb: e.target.value })}
                      placeholder="www.idiem.cl"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-[#E20000] focus:outline-none bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview of Document Formatting */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-tight mb-1.5 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-[#E20000]" />
                  <span>Vista Previa del Formato Oficial (Encabezado y Pie de Página en PDF)</span>
                </label>
                <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-inner space-y-4">
                  {/* Top Header Mockup */}
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div className="h-10 w-28 relative flex items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={form.headerImage || '/logo_125.png'}
                        alt="Logo Encabezado"
                        className="max-h-10 max-w-full object-contain"
                      />
                    </div>
                    <div className="text-right text-[10px] text-slate-600 font-mono">
                      <div className="font-bold text-slate-800">PR.DGL.CCCC.2026.XXXX</div>
                      <div>Fecha: 04 de septiembre de 2026</div>
                    </div>
                  </div>

                  {/* Centered Title Mockup */}
                  <div className="text-center font-bold text-slate-900 text-xs tracking-tight">
                    {form.budgetTitle || 'PRESUPUESTO ENSAYOS DE LABORATORIO'}
                  </div>

                  {/* 3-Column Footer Mockup */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-700 leading-snug items-end">
                      {/* Left Column */}
                      <div>
                        <div className="font-semibold text-slate-900">{form.officeTitle || 'Oficina central'}</div>
                        <div className="text-slate-600">{form.officeAddress || 'Plaza Ercilla 883, Santiago, Chile'}</div>
                      </div>

                      {/* Center Column */}
                      <div className="text-center">
                        <div className="text-slate-600">Teléfono: {form.contactPhone || '+56 2 2978 4800'}</div>
                        <div className="text-slate-600">Correo electrónico: {form.contactEmail || 'contacto@idiem.cl'}</div>
                        <div className="font-bold text-[#E20000]">{form.contactWeb || 'www.idiem.cl'}</div>
                      </div>

                      {/* Right Column */}
                      <div className="text-right">
                        <div className="font-mono text-slate-800">{form.formatCode || 'DGL-FA-193 V3'}</div>
                        <div className="font-medium text-slate-900">Página 1 de 2</div>
                      </div>
                    </div>

                    {/* Solid bottom line */}
                    <div className="h-1 bg-[#1A1A1A] mt-3 rounded-full"></div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer Valores Oficiales</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#E20000] hover:bg-[#C20000] rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Guardando...' : 'Guardar Formato'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
