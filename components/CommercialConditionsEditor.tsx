'use client';

import React, { useState } from 'react';
import {
  CotizacionCondicionesComerciales,
} from '@/lib/types';
import {
  DEFAULT_OBSERVACIONES,
  DEFAULT_CLAUSULAS_ESPECIALES,
  DEFAULT_CLAUSULAS_FACTURACION,
  DEFAULT_CLAUSULAS_TECNICAS,
  PAYMENT_CONDITION_PRESETS,
  VIGENCIA_PRESETS,
} from '@/lib/default-conditions';
import {
  FileText,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  ShieldAlert,
  CheckCircle2,
  FileCheck2,
} from 'lucide-react';

interface CommercialConditionsEditorProps {
  observations: string[];
  onChangeObservations: (obs: string[]) => void;
  condiciones: CotizacionCondicionesComerciales;
  onChangeCondiciones: (cond: CotizacionCondicionesComerciales) => void;
  paymentCondition: string;
  onChangePaymentCondition: (val: string) => void;
  onResetDefaults: () => void;
}

const QUICK_PARTICULAR_SUGGESTIONS = [
  'El mandante suministrará grúa pluma o maquinaria adecuada para la descarga de muestras en laboratorio.',
  'La extracción y transporte de muestras desde cantera/terreno no está incluida y será gestionada por el cliente.',
  'Se contempla un descuento especial del 10% por volumen total de ensayos contratados.',
  'Entrega de informes en formato digital PDF con firma electrónica avanzada y 2 copias impresas foliadas.',
  'Los ensayos están sujetos a confirmación de recepción física en laboratorio antes de programar plazos definitivos.',
  'La custodia de muestras posterior a los 15 días reglamentarios tendrá un costo de almacenamiento a convenir.',
];

const PLAZO_PRESETS = [
  '5 a 7 días hábiles tras recepción de muestras',
  '10 a 15 días hábiles tras recepción conforme',
  '15 a 20 días hábiles según programación',
  'A convenir según programa de obras del cliente',
];

export default function CommercialConditionsEditor({
  observations,
  onChangeObservations,
  condiciones,
  onChangeCondiciones,
  paymentCondition,
  onChangePaymentCondition,
  onResetDefaults,
}: CommercialConditionsEditorProps) {
  const [activeTab, setActiveTab] = useState<'parametros' | 'observaciones' | 'generales'>('parametros');
  const [isExpanded, setIsExpanded] = useState(true);
  const [newParticularText, setNewParticularText] = useState('');
  const [newObsText, setNewObsText] = useState('');
  const [expandedGeneralSection, setExpandedGeneralSection] = useState<'especiales' | 'facturacion' | 'tecnicas' | null>(null);

  // Particular clauses helpers
  const particulares = condiciones.clausulasParticulares || [];

  const handleAddParticular = (textToAdd?: string) => {
    const text = (textToAdd || newParticularText).trim();
    if (!text) return;
    onChangeCondiciones({
      ...condiciones,
      clausulasParticulares: [...particulares, text],
    });
    if (!textToAdd) setNewParticularText('');
  };

  const handleUpdateParticular = (index: number, val: string) => {
    const updated = [...particulares];
    updated[index] = val;
    onChangeCondiciones({
      ...condiciones,
      clausulasParticulares: updated,
    });
  };

  const handleRemoveParticular = (index: number) => {
    onChangeCondiciones({
      ...condiciones,
      clausulasParticulares: particulares.filter((_, i) => i !== index),
    });
  };

  // Observations helpers (Page 1 Item 1.2)
  const currentObs = observations && observations.length > 0 ? observations : DEFAULT_OBSERVACIONES;

  const handleAddObservation = () => {
    if (!newObsText.trim()) return;
    onChangeObservations([...currentObs, newObsText.trim()]);
    setNewObsText('');
  };

  const handleUpdateObservation = (index: number, val: string) => {
    const updated = [...currentObs];
    updated[index] = val;
    onChangeObservations(updated);
  };

  const handleRemoveObservation = (index: number) => {
    onChangeObservations(currentObs.filter((_, i) => i !== index));
  };

  // General clauses helpers (Anexo)
  const currentEspeciales = condiciones.clausulasEspeciales || DEFAULT_CLAUSULAS_ESPECIALES;
  const currentFacturacion = condiciones.clausulasFacturacion || DEFAULT_CLAUSULAS_FACTURACION;
  const currentTecnicas = condiciones.clausulasTecnicas || DEFAULT_CLAUSULAS_TECNICAS;

  const handleUpdateGeneralClause = (
    type: 'especiales' | 'facturacion' | 'tecnicas',
    index: number,
    val: string
  ) => {
    if (type === 'especiales') {
      const updated = [...currentEspeciales];
      updated[index] = val;
      onChangeCondiciones({ ...condiciones, clausulasEspeciales: updated });
    } else if (type === 'facturacion') {
      const updated = [...currentFacturacion];
      updated[index] = val;
      onChangeCondiciones({ ...condiciones, clausulasFacturacion: updated });
    } else {
      const updated = [...currentTecnicas];
      updated[index] = val;
      onChangeCondiciones({ ...condiciones, clausulasTecnicas: updated });
    }
  };

  const handleRemoveGeneralClause = (
    type: 'especiales' | 'facturacion' | 'tecnicas',
    index: number
  ) => {
    if (type === 'especiales') {
      onChangeCondiciones({
        ...condiciones,
        clausulasEspeciales: currentEspeciales.filter((_, i) => i !== index),
      });
    } else if (type === 'facturacion') {
      onChangeCondiciones({
        ...condiciones,
        clausulasFacturacion: currentFacturacion.filter((_, i) => i !== index),
      });
    } else {
      onChangeCondiciones({
        ...condiciones,
        clausulasTecnicas: currentTecnicas.filter((_, i) => i !== index),
      });
    }
  };

  const handleAddGeneralClause = (type: 'especiales' | 'facturacion' | 'tecnicas') => {
    if (type === 'especiales') {
      onChangeCondiciones({
        ...condiciones,
        clausulasEspeciales: [...currentEspeciales, 'Nueva condición especial para este presupuesto.'],
      });
    } else if (type === 'facturacion') {
      onChangeCondiciones({
        ...condiciones,
        clausulasFacturacion: [...currentFacturacion, 'Nueva condición de facturación para este presupuesto.'],
      });
    } else {
      onChangeCondiciones({
        ...condiciones,
        clausulasTecnicas: [...currentTecnicas, 'Nueva condición técnica para este presupuesto.'],
      });
    }
  };

  const hasCustomConditions =
    particulares.length > 0 ||
    (condiciones.vigenciaDias && condiciones.vigenciaDias !== '30 días') ||
    (condiciones.plazoEntrega && condiciones.plazoEntrega.trim().length > 0) ||
    observations.length > 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs mb-3.5 overflow-hidden transition-all">
      {/* Header Bar */}
      <div className="p-3.5 sm:p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
            <FileText className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>1.2 Condiciones Comerciales y Observaciones de la Propuesta</span>
              </h2>
              {hasCustomConditions && (
                <span className="text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                  Personalizada
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Personaliza plazos, vigencia, forma de pago y cláusulas particulares exclusivamente para esta cotización.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onResetDefaults}
            title="Restaurar a las condiciones y observaciones estándar de IDIEM"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-300 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 text-slate-500" />
            <span>Restaurar Predeterminados</span>
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition"
            title={isExpanded ? 'Plegar sección' : 'Desplegar sección'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setActiveTab('parametros')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'parametros'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Parámetros & Acuerdos Particulares</span>
              {particulares.length > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'parametros' ? 'bg-blue-800 text-white' : 'bg-blue-100 text-blue-800'
                }`}>
                  {particulares.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('observaciones')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'observaciones'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Observaciones (Página 1 PDF)</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeTab === 'observaciones' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-700'
              }`}>
                {currentObs.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('generales')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'generales'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cláusulas Generales del Anexo</span>
            </button>
          </div>

          {/* TAB 1: PARÁMETROS CLAVE & ACUERDOS PARTICULARES */}
          {activeTab === 'parametros' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Key Commercial Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {/* 1. Condición de Venta / Pago */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Condición de Venta / Pago</span>
                    <span className="text-[10px] text-blue-600 font-normal">Obligatorio</span>
                  </label>
                  <input
                    type="text"
                    value={condiciones.condicionVenta || paymentCondition}
                    onChange={(e) => {
                      const v = e.target.value;
                      onChangePaymentCondition(v);
                      onChangeCondiciones({ ...condiciones, condicionVenta: v });
                    }}
                    placeholder="ej. 50% anticipo y 50% contra entrega"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium"
                  />
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {PAYMENT_CONDITION_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          onChangePaymentCondition(preset);
                          onChangeCondiciones({ ...condiciones, condicionVenta: preset });
                        }}
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition cursor-pointer ${
                          (condiciones.condicionVenta || paymentCondition) === preset
                            ? 'bg-blue-600 text-white border-blue-700 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Vigencia de la Oferta */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Vigencia del Presupuesto</span>
                    <Clock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    value={condiciones.vigenciaDias || '30 días'}
                    onChange={(e) =>
                      onChangeCondiciones({ ...condiciones, vigenciaDias: e.target.value })
                    }
                    placeholder="ej. 30 días"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium"
                  />
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {VIGENCIA_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          onChangeCondiciones({ ...condiciones, vigenciaDias: preset })
                        }
                        className={`text-[9px] px-2 py-0.5 rounded border transition cursor-pointer ${
                          (condiciones.vigenciaDias || '30 días') === preset
                            ? 'bg-blue-600 text-white border-blue-700 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Plazo Estimado de Entrega */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                    <span>Plazo de Entrega de Informes</span>
                    <Clock className="w-3 h-3 text-slate-400" />
                  </label>
                  <input
                    type="text"
                    value={condiciones.plazoEntrega || ''}
                    onChange={(e) =>
                      onChangeCondiciones({ ...condiciones, plazoEntrega: e.target.value })
                    }
                    placeholder="ej. 10 a 15 días hábiles tras recepción"
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none font-medium"
                  />
                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1 pt-1">
                    {PLAZO_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          onChangeCondiciones({ ...condiciones, plazoEntrega: preset })
                        }
                        className={`text-[9px] px-1.5 py-0.5 rounded border transition cursor-pointer truncate max-w-[140px] ${
                          condiciones.plazoEntrega === preset
                            ? 'bg-blue-600 text-white border-blue-700 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                        title={preset}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cláusulas Particulares / Acuerdos Específicos con el Cliente */}
              <div className="p-3.5 bg-blue-50/40 rounded-xl border border-blue-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Cláusulas Particulares Acordadas para esta Propuesta</span>
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      Añade condiciones exclusivas pactadas con este mandante (se imprimirán como viñetas en el Anexo del PDF).
                    </p>
                  </div>
                </div>

                {/* Quick Suggestion Chips */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Sugerencias frecuentes (clic para añadir):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PARTICULAR_SUGGESTIONS.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleAddParticular(sug)}
                        className="text-[10px] px-2 py-0.5 bg-white border border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-slate-700 rounded-lg text-left transition cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-2.5 h-2.5 text-blue-600" />
                        <span className="truncate max-w-[280px]">{sug}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* List of active custom clauses */}
                {particulares.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {particulares.map((clausula, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs group hover:border-blue-300 transition-colors"
                      >
                        <span className="text-xs font-bold text-blue-700 mt-1 shrink-0 font-mono">
                          •
                        </span>
                        <textarea
                          rows={2}
                          value={clausula}
                          onChange={(e) => handleUpdateParticular(idx, e.target.value)}
                          className="flex-1 text-xs text-slate-800 bg-transparent border-none p-0 focus:outline-none resize-y leading-relaxed font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveParticular(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition shrink-0 cursor-pointer"
                          title="Eliminar cláusula"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-white/70 rounded-lg border border-dashed border-slate-300 text-center text-xs text-slate-500">
                    No se han añadido cláusulas particulares para esta propuesta. Puedes escribir una abajo o hacer clic en una sugerencia.
                  </div>
                )}

                {/* Input to add a new custom clause */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={newParticularText}
                    onChange={(e) => setNewParticularText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddParticular();
                      }
                    }}
                    placeholder="Escribe una nueva cláusula o acuerdo comercial particular..."
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddParticular()}
                    disabled={!newParticularText.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Cláusula</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OBSERVACIONES DE LA PROPUESTA (PÁGINA 1) */}
          {activeTab === 'observaciones' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Observaciones Técnicas (Sección 1.2 - Pie de Tabla Página 1)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Estas líneas se imprimen directamente debajo del resumen económico de ensayos en la primera página del PDF.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onChangeObservations([...DEFAULT_OBSERVACIONES])}
                  className="text-xs text-blue-600 hover:underline cursor-pointer"
                >
                  Restablecer 1.2.1 - 1.2.4 originales
                </button>
              </div>

              {/* List of observations */}
              <div className="space-y-2">
                {currentObs.map((obs, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 group hover:border-slate-300 transition-colors"
                  >
                    <span className="text-[11px] font-mono font-bold text-slate-500 mt-1 shrink-0">
                      #{idx + 1}
                    </span>
                    <textarea
                      rows={2}
                      value={obs}
                      onChange={(e) => handleUpdateObservation(idx, e.target.value)}
                      className="flex-1 text-xs text-slate-800 bg-white border border-slate-200 rounded p-1.5 focus:ring-1 focus:ring-blue-600 focus:outline-none resize-y leading-relaxed font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveObservation(idx)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded transition shrink-0 cursor-pointer"
                      title="Eliminar observación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Observation */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newObsText}
                  onChange={(e) => setNewObsText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddObservation();
                    }
                  }}
                  placeholder="ej. 1.2.5 Muestras recepcionadas en obra y trasladadas por mandante..."
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddObservation}
                  disabled={!newObsText.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir Observación</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CLÁUSULAS GENERALES DEL ANEXO */}
          {activeTab === 'generales' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Flexibilidad Contractual para Licitaciones:</span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Modificar estas cláusulas solo afectará a este presupuesto específico en el Anexo PDF. No alterará la configuración global de IDIEM para otras cotizaciones.
                  </p>
                </div>
              </div>

              {/* Accordion 1: Condiciones Especiales */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGeneralSection(
                      expandedGeneralSection === 'especiales' ? null : 'especiales'
                    )
                  }
                  className="w-full p-3 bg-slate-50 flex items-center justify-between text-left text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-red-600">●</span>
                    Sección 1: Condiciones Especiales ({currentEspeciales.length} cláusulas)
                  </span>
                  {expandedGeneralSection === 'especiales' ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {expandedGeneralSection === 'especiales' && (
                  <div className="p-3 space-y-2 bg-white border-t border-slate-200">
                    {currentEspeciales.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-1">{i + 1}.</span>
                        <textarea
                          rows={2}
                          value={c}
                          onChange={(e) => handleUpdateGeneralClause('especiales', i, e.target.value)}
                          className="flex-1 p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneralClause('especiales', i)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddGeneralClause('especiales')}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir párrafo
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 2: Condiciones de Facturación */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGeneralSection(
                      expandedGeneralSection === 'facturacion' ? null : 'facturacion'
                    )
                  }
                  className="w-full p-3 bg-slate-50 flex items-center justify-between text-left text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-red-600">●</span>
                    Sección 2: Condiciones de Facturación ({currentFacturacion.length} cláusulas)
                  </span>
                  {expandedGeneralSection === 'facturacion' ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {expandedGeneralSection === 'facturacion' && (
                  <div className="p-3 space-y-2 bg-white border-t border-slate-200">
                    {currentFacturacion.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-1">{i + 1}.</span>
                        <textarea
                          rows={2}
                          value={c}
                          onChange={(e) => handleUpdateGeneralClause('facturacion', i, e.target.value)}
                          className="flex-1 p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneralClause('facturacion', i)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddGeneralClause('facturacion')}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir párrafo
                    </button>
                  </div>
                )}
              </div>

              {/* Accordion 3: Condiciones Técnicas */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedGeneralSection(
                      expandedGeneralSection === 'tecnicas' ? null : 'tecnicas'
                    )
                  }
                  className="w-full p-3 bg-slate-50 flex items-center justify-between text-left text-xs font-bold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="text-red-600">●</span>
                    Sección 3: Condiciones Técnicas ({currentTecnicas.length} cláusulas)
                  </span>
                  {expandedGeneralSection === 'tecnicas' ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                {expandedGeneralSection === 'tecnicas' && (
                  <div className="p-3 space-y-2 bg-white border-t border-slate-200">
                    {currentTecnicas.map((c, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-slate-400 mt-1">{i + 1}.</span>
                        <textarea
                          rows={2}
                          value={c}
                          onChange={(e) => handleUpdateGeneralClause('tecnicas', i, e.target.value)}
                          className="flex-1 p-1.5 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-600 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveGeneralClause('tecnicas', i)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => handleAddGeneralClause('tecnicas')}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 pt-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Añadir párrafo
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
