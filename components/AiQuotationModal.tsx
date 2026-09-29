'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  AiAnalisisResponse,
  AiEnsayoSugerido,
  AiDatosProyecto,
} from '@/lib/ai-service';
import {
  Sparkles,
  X,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Copy,
  Check,
  Building2,
  MapPin,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileUp,
  Trash2,
  Key,
  ShieldCheck,
  Send,
  HelpCircle,
  Hash,
  Info,
} from 'lucide-react';

interface AiQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: {
    datosProyecto: AiDatosProyecto;
    ensayos: AiEnsayoSugerido[];
    centroCosto: string | null;
    observacionesComerciales?: string;
  }) => void;
}

const EJEMPLOS = [
  {
    titulo: 'Licitación ESVAL (Cantera Melipilla)',
    texto: `Estimado Francisco, para licitación con ESVAL, solicito pueda cotizar la toma de muestra y caracterización y ensayo de roca de 5 a 6 ton.
La roca se extraerá desde cantera la Virgen, en Melipilla
https://maps.app.goo.gl/FnGoyTiqovJwUojJ8
El informe deberá contener una caracterización completa de la muestra, descripción micro y macro, clasificación litológica, enfocada en las cualidades que tiene el material para prestar servicio en condiciones marítimas.
Las características de la roca solicitadas por el mandante son:
Resistencia a la compresión mayor a 60MPa
Densidad aparente mayor a 2,65 ton/m3
Porosidad menor a 6%, absorción agua menor a 2%
Resistencia al desgaste de los ángeles menor a 25%
Dimensiones lado menor mayor > 1/3 lado mayor

Los ensayos que debería haber asignado o entregado como referencia son:
- Analisis mineralógico macroscópico y microscópico
- Corte Transparente
- Extracción de testigos de colpas
- Compresión simple en roca
- Desgaste de los angeles con preparación de ensayos
- Propiedades físicas`,
  },
  {
    titulo: 'Edificio Habitacional (14 pisos)',
    texto: `De: carlos.munoz@constructora-andes.cl
Para: cotizaciones@idiem.cl
Asunto: Cotización ensayos mecánica de suelos - Edificio Los Olivos

Hola Diego,
Te contacto para solicitar cotización de ensayos de laboratorio para el proyecto "Edificio Los Olivos", ubicado en Providencia, Santiago.
Consiste en una torre habitacional de 14 pisos con 2 subterráneos.
Necesitaremos ensayar muestras de calicatas y sondajes:
- Clasificación USCS completa (con límites de Atterberg y granulometría)
- Ensayos de Proctor Modificado para sello de fundación
- 3 densidades in situ cono de arena en terreno
- 3 ensayos de corte directo para cohesión y fricción
- Humedad natural

Por favor enviar propuesta con plazos estimados.
Saludos,
Carlos Muñoz - Constructora Andes S.A.
Teléfono: +56 9 8765 4321`,
  },
  {
    titulo: 'Pavimentación Vial MOP',
    texto: `Solicitud de Ensayos para Obra: "Mejoramiento Ruta K-60", Región del Maule.
Empresa: Consorcio Vial del Sur SpA.
Contacto: Ing. Roberto Valenzuela (rvalenzuela@vialdelsur.cl, +56 9 7654 3210).
Ensayos requeridos según Manual de Carreteras Volumen 8:
- Granulometría de bases y sub-bases (3 muestras)
- Proctor Modificado (2 muestras)
- CBR de laboratorio en probeta saturada (2 muestras)
- Densidad máxima y mínima
- Desgaste Los Ángeles`,
  },
];

export default function AiQuotationModal({
  isOpen,
  onClose,
  onApply,
}: AiQuotationModalProps) {
  const [inputTab, setInputTab] = useState<'text' | 'file'>('text');
  const [texto, setTexto] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [resultado, setResultado] = useState<AiAnalisisResponse | null>(null);
  const [resultTab, setResultTab] = useState<'ensayos' | 'consultas' | 'alertas'>('ensayos');
  const [ensayosSeleccionados, setEnsayosSeleccionados] = useState<AiEnsayoSugerido[]>([]);
  const [copiedMail, setCopiedMail] = useState(false);
  const [expandedJustifications, setExpandedJustifications] = useState<Record<number, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom API key from localStorage if saved
  useEffect(() => {
    try {
      const savedKey = localStorage.getItem('dgl_gemini_key');
      if (savedKey) setCustomApiKey(savedKey);
    } catch {}
  }, []);

  const handleSaveKey = (val: string) => {
    setCustomApiKey(val);
    try {
      if (val.trim()) {
        localStorage.setItem('dgl_gemini_key', val.trim());
      } else {
        localStorage.removeItem('dgl_gemini_key');
      }
    } catch {}
  };

  // Cycling loading animation text
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % 4);
    }, 1800);
    return () => clearInterval(interval);
  }, [loading]);

  const loadingMessages = [
    'Leyendo y analizando contexto técnico de la solicitud...',
    'Cotejando requerimientos con catálogo oficial DGL (358 ensayos)...',
    'Aplicando criterios normativos (NCh 1508 / ASTM / Manual de Carreteras)...',
    'Generando preguntas técnicas y borrador de respuesta para el cliente...',
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      if (!f.name.endsWith('.pdf') && !f.name.endsWith('.txt')) {
        setError('Por favor selecciona un archivo PDF (.pdf) o Texto plano (.txt).');
        return;
      }
      setSelectedFile(f);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (!f.name.endsWith('.pdf') && !f.name.endsWith('.txt')) {
        setError('Por favor sube un archivo PDF (.pdf) o Texto plano (.txt).');
        return;
      }
      setSelectedFile(f);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (inputTab === 'text' && !texto.trim()) {
      setError('Por favor ingresa o pega el texto de la solicitud.');
      return;
    }
    if (inputTab === 'file' && !selectedFile) {
      setError('Por favor selecciona un archivo PDF o TXT para analizar.');
      return;
    }

    setLoading(true);
    setError(null);
    setResultado(null);

    try {
      let res: Response;

      if (inputTab === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        if (texto.trim()) formData.append('texto', texto.trim());
        if (customApiKey.trim()) formData.append('apiKey', customApiKey.trim());

        res = await fetch('/api/ai/analizar-solicitud', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/ai/analizar-solicitud', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            texto: texto.trim(),
            apiKey: customApiKey.trim() || undefined,
          }),
        });
      }

      const resText = await res.text();
      let data: any;
      try {
        data = JSON.parse(resText);
      } catch {
        throw new Error(
          !res.ok
            ? `El servidor de IA respondió con un error (código ${res.status}). Por favor intenta nuevamente o sube el archivo en otro formato.`
            : 'Respuesta inválida del servidor.'
        );
      }

      if (!res.ok) {
        throw new Error(data.error || 'Error al procesar la solicitud con IA.');
      }

      setResultado(data);
      setEnsayosSeleccionados(
        (data.ensayos_sugeridos || []).map((e: AiEnsayoSugerido) => ({
          ...e,
          seleccionado: true,
        }))
      );
      setResultTab('ensayos');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al comunicarse con el servicio de IA.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEnsayo = (index: number) => {
    setEnsayosSeleccionados((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, seleccionado: !item.seleccionado } : item
      )
    );
  };

  const updateCantidad = (index: number, val: number) => {
    setEnsayosSeleccionados((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, cantidad_estimada: Math.max(1, val) } : item
      )
    );
  };

  const toggleJustification = (index: number) => {
    setExpandedJustifications((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleCopyEmail = () => {
    if (!resultado?.borrador_correo_aclaratorio) return;
    navigator.clipboard.writeText(resultado.borrador_correo_aclaratorio);
    setCopiedMail(true);
    setTimeout(() => setCopiedMail(false), 2500);
  };

  const handleApplyClick = () => {
    if (!resultado) return;
    const activos = ensayosSeleccionados.filter((e) => e.seleccionado);
    onApply({
      datosProyecto: resultado.datos_proyecto_detectados,
      ensayos: activos,
      centroCosto: resultado.datos_proyecto_detectados.centro_costo_sugerido,
      observacionesComerciales: resultado.observaciones_comerciales,
    });
    onClose();
  };

  const totalSeleccionadoUf = ensayosSeleccionados
    .filter((e) => e.seleccionado)
    .reduce((acc, curr) => acc + curr.precio_uf * curr.cantidad_estimada, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-md shadow-red-900/40 text-white">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white tracking-wide">
                  Asistente IA Técnico-Comercial DGL
                </h3>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Zero Data Training
                </span>
              </div>
              <p className="text-xs text-slate-300">
                División Geotecnia y Laboratorio (IDIEM - Universidad de Chile)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-700/50 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Gemini 3 Flash Activo
            </span>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              title="Ajustes de API Key"
              className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2 py-1.5 rounded-lg border border-slate-700 transition flex items-center gap-1"
            >
              <Key className="w-3 h-3 text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Custom API Key Bar */}
        {showKeyInput && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900">
            <div className="flex items-center gap-2 flex-1">
              <Key className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold shrink-0">
                Estado API:
              </span>
              <span className="text-[11px] text-emerald-800">
                ✓ Llave institucional configurada en servidor. Todos los usuarios pueden usar la IA sin ingresar claves.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                placeholder="Personalizar API Key (Opcional)"
                className="w-56 px-2 py-0.5 bg-white border border-emerald-300 rounded text-slate-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              {customApiKey && (
                <button
                  type="button"
                  onClick={() => handleSaveKey('')}
                  className="text-[10px] text-red-600 hover:underline"
                >
                  Restaurar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* If no result yet: Input Screen */}
          {!resultado && (
            <div className="space-y-5">
              {/* Input Mode Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                <button
                  type="button"
                  onClick={() => setInputTab('text')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                    inputTab === 'text'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Pegar Correo / Texto
                </button>
                <button
                  type="button"
                  onClick={() => setInputTab('file')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition ${
                    inputTab === 'file'
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <FileUp className="w-4 h-4" />
                  Cargar Archivo (PDF / TXT)
                </button>
              </div>

              {/* Text Input Area */}
              {inputTab === 'text' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Copia y pega la solicitud del cliente:
                    </label>
                    <button
                      type="button"
                      onClick={() => setTexto('')}
                      className="text-xs text-slate-400 hover:text-red-600 transition"
                    >
                      Limpiar texto
                    </button>
                  </div>
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    rows={8}
                    placeholder="Pega aquí el correo del cliente, memoria técnica o resumen de ensayos solicitados..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition font-sans placeholder:text-slate-400"
                  />

                  {/* Quick Examples */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs text-slate-500 font-medium">
                      O prueba con un ejemplo real:
                    </span>
                    {EJEMPLOS.map((ej, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setTexto(ej.texto)}
                        className="text-xs bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-700 border border-slate-200 hover:border-red-200 px-2.5 py-1 rounded-md transition font-medium"
                      >
                        {ej.titulo}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* File Input Area */}
              {inputTab === 'file' && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Sube las especificaciones técnicas o documento de solicitud:
                  </label>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-2xl p-8 text-center cursor-pointer transition bg-slate-50/60 hover:bg-red-50/30 flex flex-col items-center justify-center space-y-3"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-md border border-slate-200 flex items-center justify-center text-red-600">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {selectedFile ? selectedFile.name : 'Haz clic para seleccionar o arrastra aquí tu archivo'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Formatos soportados: Documentos PDF (.pdf) o archivos de texto (.txt)
                      </p>
                    </div>

                    {selectedFile && (
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 shadow-xs">
                        <FileText className="w-4 h-4 text-red-600" />
                        <span className="font-medium">{selectedFile.name}</span>
                        <span className="text-slate-400">
                          ({(selectedFile.size / 1024).toFixed(1)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-slate-400 hover:text-red-600 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Optional notes with file */}
                  <div className="pt-2">
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      Comentarios o notas adicionales para el análisis (opcional):
                    </label>
                    <input
                      type="text"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Ej: Solo cotizar ensayos de suelo bajo 3 metros..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Confidentiality & Architecture Assurance */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-800">
                    Estricto Cumplimiento de Confidencialidad IDIEM:
                  </span>{' '}
                  Los datos analizados no se utilizan para entrenar modelos públicos. El procesamiento se ejecuta en memoria y es validado contra el catálogo oficial cerrado de 358 ensayos DGL para garantizar 0% alucinaciones.
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Loading Screen */}
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center animate-in fade-in">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-slate-200 border-t-red-600 animate-spin" />
                <Sparkles className="w-6 h-6 text-red-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div>
                <h4 className="text-base font-bold text-slate-900">
                  Analizando Solicitud Geotécnica
                </h4>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md h-6 transition-all duration-300 font-medium">
                  {loadingMessages[loadingStep]}
                </p>
              </div>
            </div>
          )}

          {/* Result View Screen */}
          {resultado && !loading && (
            <div className="space-y-6">
              {/* Technical Campaign Overview Card */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-700">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Diagnóstico Técnico de Solicitud
                    </span>
                    <h4 className="text-base font-bold text-white mt-0.5">
                      Campaña de Ensayos Recomendada
                    </h4>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {resultado.resumen_tecnico_proyecto}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="bg-slate-800/80 border border-slate-600 px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-400 block">Centro de Costo</span>
                      <span className="text-xs font-bold text-emerald-400">
                        {resultado.datos_proyecto_detectados.centro_costo_sugerido || '1817 - Ensayos Básicos'}
                      </span>
                    </div>
                    <div className="bg-slate-800/80 border border-slate-600 px-3 py-1.5 rounded-xl text-center">
                      <span className="text-[10px] text-slate-400 block">Total Estimado</span>
                      <span className="text-sm font-extrabold text-white">
                        {totalSeleccionadoUf.toFixed(2)} UF
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grid of technical metrics & notice */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Batería de Ensayos:</span>
                    <span className="font-semibold text-white block">
                      {resultado.ensayos_sugeridos.length} ensayos identificados en catálogo
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Normativa Clave:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {resultado.normativa_aplicable && resultado.normativa_aplicable.length > 0 ? (
                        resultado.normativa_aplicable.slice(0, 3).map((norm, i) => (
                          <span
                            key={i}
                            className="bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono"
                          >
                            {norm}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 text-[11px]">NCh1508 / ASTM</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Referencia en Solicitud:</span>
                    <span className="font-semibold text-slate-300 truncate block text-[11px]" title={resultado.datos_proyecto_detectados.nombre_obra || resultado.datos_proyecto_detectados.empresa_cliente || 'Sin referencia'}>
                      {resultado.datos_proyecto_detectados.nombre_obra || resultado.datos_proyecto_detectados.empresa_cliente || 'Muestra / Proyecto Geotécnico'}
                    </span>
                  </div>
                </div>

                {/* Clear user notice: Only tests are transferred */}
                <div className="mt-3.5 pt-3 border-t border-slate-700/60 flex items-center gap-2 text-[11px] text-slate-300 bg-slate-800/40 px-3 py-2 rounded-xl">
                  <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span>
                    <strong>Modo Estimación de Campaña:</strong> Al aplicar, únicamente se agregarán a la cotización los ensayos seleccionados con sus cantidades y precios oficiales. Empresa, contacto y proyecto permanecen bajo control manual del analista.
                  </span>
                </div>
              </div>

              {/* Result Sub-tabs */}
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setResultTab('ensayos')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
                      resultTab === 'ensayos'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    Ensayos Sugeridos ({ensayosSeleccionados.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultTab('consultas')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
                      resultTab === 'consultas'
                        ? 'border-red-600 text-red-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Consultas al Cliente ({resultado.preguntas_para_el_cliente.length})
                  </button>
                  {resultado.ensayos_no_disponibles_o_especiales.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setResultTab('alertas')}
                      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition ${
                        resultTab === 'alertas'
                          ? 'border-amber-600 text-amber-600'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Alertas ({resultado.ensayos_no_disponibles_o_especiales.length})
                    </button>
                  )}
                </div>

                <span className="text-xs text-slate-400 hidden sm:inline">
                  {ensayosSeleccionados.filter((e) => e.seleccionado).length} de{' '}
                  {ensayosSeleccionados.length} seleccionados
                </span>
              </div>

              {/* Sub-tab 1: Ensayos Table */}
              {resultTab === 'ensayos' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider">
                            <th className="py-3 px-3 w-10 text-center">Sel.</th>
                            <th className="py-3 px-3 w-28">SKU / Cód</th>
                            <th className="py-3 px-3">Descripción del Ensayo DGL</th>
                            <th className="py-3 px-3 w-28 text-center">Cant. Estimada</th>
                            <th className="py-3 px-3 w-24 text-right">Precio UF</th>
                            <th className="py-3 px-3 w-24 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {ensayosSeleccionados.map((item, idx) => {
                            const subtotal = item.precio_uf * item.cantidad_estimada;
                            const isExpanded = expandedJustifications[idx] || false;

                            return (
                              <React.Fragment key={idx}>
                                <tr
                                  className={`transition hover:bg-slate-50/80 ${
                                    item.seleccionado ? 'bg-white' : 'bg-slate-50/50 opacity-60'
                                  }`}
                                >
                                  <td className="py-2.5 px-3 text-center">
                                    <input
                                      type="checkbox"
                                      checked={item.seleccionado}
                                      onChange={() => toggleEnsayo(idx)}
                                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                    <span className="font-semibold text-slate-800 block">
                                      {item.sku}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      Cód. {item.codigo}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-800 text-xs">
                                      {item.designacion}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[11px] text-slate-500 font-mono">
                                        {item.norma}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => toggleJustification(idx)}
                                        className="text-[10px] text-red-600 hover:text-red-700 underline font-medium flex items-center gap-0.5"
                                      >
                                        {isExpanded ? 'Ocultar criterio' : 'Ver criterio técnico'}
                                        {isExpanded ? (
                                          <ChevronUp className="w-3 h-3" />
                                        ) : (
                                          <ChevronDown className="w-3 h-3" />
                                        )}
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                      <button
                                        type="button"
                                        disabled={!item.seleccionado || item.cantidad_estimada <= 1}
                                        onClick={() => updateCantidad(idx, item.cantidad_estimada - 1)}
                                        className="px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold"
                                      >
                                        -
                                      </button>
                                      <input
                                        type="number"
                                        min={1}
                                        disabled={!item.seleccionado}
                                        value={item.cantidad_estimada}
                                        onChange={(e) =>
                                          updateCantidad(idx, parseInt(e.target.value, 10) || 1)
                                        }
                                        className="w-12 text-center text-xs font-bold text-slate-800 border-none focus:outline-none focus:ring-0 p-0"
                                      />
                                      <button
                                        type="button"
                                        disabled={!item.seleccionado}
                                        onClick={() => updateCantidad(idx, item.cantidad_estimada + 1)}
                                        className="px-2 py-1 text-slate-500 hover:bg-slate-100 disabled:opacity-30 text-xs font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-700">
                                    {item.precio_uf.toFixed(2)} UF
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-xs font-bold text-slate-900">
                                    {subtotal.toFixed(2)} UF
                                  </td>
                                </tr>

                                {/* Collapsible Technical Justification */}
                                {isExpanded && (
                                  <tr className="bg-red-50/40 border-b border-red-100">
                                    <td colSpan={6} className="px-6 py-2 text-xs text-slate-700">
                                      <div className="flex items-start gap-2">
                                        <Info className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-bold text-slate-800">
                                            Justificación Geotécnica:
                                          </span>{' '}
                                          {item.justificacion_tecnica}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                    <div className="text-xs text-slate-600">
                      Ensayos verificados contra la base de datos oficial de tarifas IDIEM.
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-700">
                        Total Seleccionado:
                      </span>
                      <span className="text-base font-extrabold text-red-600 font-mono">
                        {totalSeleccionadoUf.toFixed(2)} UF
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab 2: Consultas al Cliente & Borrador de Correo */}
              {resultTab === 'consultas' && (
                <div className="space-y-5">
                  {/* Technical Questions List */}
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-red-600" />
                      Preguntas Clave para el Cliente (Resolución de Ambigüedad):
                    </h5>
                    {resultado.preguntas_para_el_cliente.length > 0 ? (
                      <ul className="space-y-2">
                        {resultado.preguntas_para_el_cliente.map((p, idx) => (
                          <li
                            key={idx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 flex items-start gap-2.5"
                          >
                            <span className="w-5 h-5 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center shrink-0 text-[11px]">
                              {idx + 1}
                            </span>
                            <span className="mt-0.5">{p}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        No se detectaron ambigüedades técnicas críticas en la solicitud.
                      </p>
                    )}
                  </div>

                  {/* Formal Email Draft */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Mail className="w-4 h-4 text-emerald-600" />
                        Borrador de Correo Formal Institucional (Listo para enviar):
                      </h5>
                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className={`text-xs px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 shadow-2xs ${
                          copiedMail
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                        }`}
                      >
                        {copiedMail ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            ¡Copiado al Portapapeles!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-500" />
                            Copiar Correo
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="w-full p-4 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-slate-800 shadow-inner">
                      {resultado.borrador_correo_aclaratorio}
                    </pre>
                  </div>
                </div>
              )}

              {/* Sub-tab 3: Alertas Comerciales & No Cubiertos */}
              {resultTab === 'alertas' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-2 mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Ensayos o Servicios No Disponibles en el Catálogo DGL:
                    </h5>
                    <p className="text-xs text-amber-800 mb-3">
                      Los siguientes requerimientos fueron mencionados por el cliente pero no pertenecen a los 358 ensayos del tarifario oficial vigente o requieren subcontratación especial:
                    </p>
                    <ul className="space-y-2">
                      {resultado.ensayos_no_disponibles_o_especiales.map((item, idx) => (
                        <li
                          key={idx}
                          className="bg-white border border-amber-300 rounded-lg p-3 text-xs flex items-start gap-2"
                        >
                          <span className="font-bold text-slate-800 shrink-0">
                            • {item.ensayo_solicitado}:
                          </span>
                          <span className="text-slate-600">{item.motivo}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {resultado.observaciones_comerciales && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        Observaciones y Alertas Comerciales:
                      </h5>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {resultado.observaciones_comerciales}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            {resultado && !loading ? (
              <button
                type="button"
                onClick={() => setResultado(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-semibold underline"
              >
                ← Modificar Solicitud / Reintentar
              </button>
            ) : (
              <span className="text-xs text-slate-400">
                Catálogo DGL: 358 ensayos oficiales integrados
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition"
            >
              Cancelar
            </button>

            {!resultado ? (
              <button
                type="button"
                disabled={loading || (inputTab === 'text' && !texto.trim()) || (inputTab === 'file' && !selectedFile)}
                onClick={handleAnalyze}
                className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 rounded-xl transition shadow-md shadow-red-600/30 flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analizando Solicitud...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analizar Solicitud con IA
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyClick}
                disabled={ensayosSeleccionados.filter((e) => e.seleccionado).length === 0}
                className="px-6 py-2.5 text-xs font-extrabold text-white bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 rounded-xl transition shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Cargar Campaña ({ensayosSeleccionados.filter((e) => e.seleccionado).length} Ensayos - {totalSeleccionadoUf.toFixed(2)} UF)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
