'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  CotizacionItem,
  TarifarioItem,
  ReglaAprendida,
  CasoReferenciaRAG,
} from '@/lib/types';
import {
  AiChatAction,
  AiChatMessage,
  AiChatResponse,
  AiAnalisisResponse,
  AiEnsayoSugerido,
  AiDatosProyecto,
} from '@/lib/ai-service';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Bot,
  User as UserIcon,
  Trash2,
  CheckCircle2,
  PlusCircle,
  Edit2,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Scale,
  FileText,
  Upload,
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
  FileUp,
  Key,
  ShieldCheck,
  BookOpen,
  Database,
  Brain,
  History,
  TrendingUp,
  Sliders,
  ExternalLink,
  Search,
  Paperclip,
} from 'lucide-react';

export interface UnifiedAiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'chat' | 'analizar' | 'memoria';
  currentItems: CotizacionItem[];
  onApplyActions: (acciones: AiChatAction[], itemsCompletos: TarifarioItem[]) => void;
  onApplyCampaign: (data: {
    datosProyecto?: AiDatosProyecto;
    ensayos: AiEnsayoSugerido[];
    centroCosto: string | null;
    observacionesComerciales?: string;
  }) => void;
  contexto?: {
    clientName?: string;
    projectName?: string;
    centroCosto?: string;
    currency?: string;
  };
}

interface DisplayChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  acciones?: AiChatAction[];
  analisis?: AiAnalisisResponse;
  archivoAdjunto?: { nombre: string; tamanoKb: number };
  timestamp: string;
}

const CHAT_SUGGESTIONS = [
  'Agregale a este presupuesto 3 Clasificaciones Completas y 3 Consolidaciones de 20 cm sin permeabilidad',
  'Cambia el ensayo de corte directo a 7 muestras',
  'Elimina los ensayos de cono de arena',
  'Aplica un 10% de descuento (factor 0.9) a todos los ensayos',
  '¿Qué ensayos se recomiendan para un estudio de fundación en gravas según NCh1508?',
];

const ANALISIS_EJEMPLOS = [
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

const LOADING_STEPS = [
  'Extrayendo datos de la solicitud y especificaciones...',
  'Consultando memoria RAG histórica y catálogo oficial de 358 ensayos...',
  'Estructurando batería técnica, cantidades y normativa IDIEM...',
  'Optimizando propuesta comercial y preguntas aclaratorias...',
];

function getFileBadgeInfo(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return {
      label: 'Excel',
      bg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
      pillBg: 'bg-emerald-600 text-white',
      iconText: '📊',
    };
  }
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return {
      label: 'Word',
      bg: 'bg-blue-50 text-blue-900 border-blue-300',
      pillBg: 'bg-blue-600 text-white',
      iconText: '📝',
    };
  }
  if (lower.endsWith('.pdf')) {
    return {
      label: 'PDF',
      bg: 'bg-red-50 text-red-900 border-red-300',
      pillBg: 'bg-red-600 text-white',
      iconText: '📄',
    };
  }
  return {
    label: 'Texto',
    bg: 'bg-slate-100 text-slate-800 border-slate-300',
    pillBg: 'bg-slate-600 text-white',
    iconText: '📄',
  };
}

export default function UnifiedAiAssistantModal({
  isOpen,
  onClose,
  initialTab = 'chat',
  currentItems,
  onApplyActions,
  onApplyCampaign,
  contexto = {},
}: UnifiedAiAssistantModalProps) {
  // Pestaña activa: 'chat' (unificada: Chat + Análisis de Documentos/Correos) | 'memoria'
  const [activeTab, setActiveTab] = useState<'chat' | 'memoria'>(
    initialTab === 'memoria' ? 'memoria' : 'chat'
  );

  // Panel desplegable para adjuntar / pegar documento o correo
  const [showInputDrawer, setShowInputDrawer] = useState(initialTab === 'analizar');
  const [drawerMode, setDrawerMode] = useState<'text' | 'file'>('text');
  const [pastedText, setPastedText] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  // Retención de archivo y texto analizado en sesión para re-análisis interactivo o revisión de páginas específicas
  const [lastAnalyzedFile, setLastAnalyzedFile] = useState<File | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState<string>('');

  // Detector inteligente de intención de re-análisis o revisión de páginas/secciones del documento
  const isDocumentRecheckRequest = (msg: string): boolean => {
    const lower = msg.toLowerCase();
    const keywords = [
      'revisa',
      'revisar',
      'revises',
      'revisalo',
      'revisame',
      'revisen',
      'página',
      'pagina',
      'paginas',
      'páginas',
      'hoja',
      'hojas',
      'anexo',
      'anexos',
      'incompleto',
      'incompletos',
      'incompleta',
      'incompletas',
      'falta',
      'faltan',
      'faltante',
      'faltantes',
      'más ensayo',
      'mas ensayo',
      'más ensayos',
      'mas ensayos',
      'solicitan más',
      'piden más',
      'vuelve a',
      'volver a',
      'exhaustiv',
      'busca más',
      'buscar más',
      'documento completo',
      'todo el documento',
      'todo el archivo',
      'todas las páginas',
      'todas las paginas',
      'chequea',
      'escanea',
    ];
    return keywords.some((kw) => lower.includes(kw));
  };

  // Sincronizar initialTab cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'memoria') {
        setActiveTab('memoria');
      } else {
        setActiveTab('chat');
        if (initialTab === 'analizar') {
          setShowInputDrawer(true);
        }
      }
    }
  }, [isOpen, initialTab]);

  // ==========================================
  // ESTADOS COMUNES (API KEY, SEGURIDAD)
  // ==========================================
  const [customApiKey, setCustomApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

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

  // ==========================================
  // ESTADOS DEL ASISTENTE UNIFICADO (CHAT & ANÁLISIS)
  // ==========================================
  const [chatMessages, setChatMessages] = useState<DisplayChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! Soy tu **Asistente IA Técnico-Comercial DGL IDIEM**.\n\nPuedes **adjuntar un archivo (PDF, Word, Excel o TXT)** o **pegar un correo de licitación** para que extraiga los requerimientos y proponga la batería de ensayos oficial.\n\nTambién puedes pedirme en lenguaje natural que agregue ensayos, ajuste cantidades, aplique descuentos o responda cualquier duda técnica sobre nuestro tarifario de 358 ensayos y normativa (NCh1508, NCh433, MOP).',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [analisisLoading, setAnalisisLoading] = useState(false);
  const [analisisStep, setAnalisisStep] = useState(0);
  const [analisisError, setAnalisisError] = useState<string | null>(null);

  // Campaña activa en el chat
  const [activeAnalisis, setActiveAnalisis] = useState<AiAnalisisResponse | null>(null);
  const [ensayosSeleccionados, setEnsayosSeleccionados] = useState<AiEnsayoSugerido[]>([]);
  const [campanaCargada, setCampanaCargada] = useState(false);
  const [analisisResultSubTab, setAnalisisResultSubTab] = useState<'ensayos' | 'consultas' | 'alertas'>('ensayos');
  const [expandedJustifications, setExpandedJustifications] = useState<Record<number, boolean>>({});
  const [copiedMail, setCopiedMail] = useState(false);

  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawerFileInputRef = useRef<HTMLInputElement>(null);

  // Rotador de pasos de carga de análisis
  useEffect(() => {
    if (!analisisLoading) return;
    const interval = setInterval(() => {
      setAnalisisStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [analisisLoading]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, activeTab, chatMessages, analisisLoading, chatLoading]);

  // Focus input
  useEffect(() => {
    if (isOpen && activeTab === 'chat' && !showInputDrawer) {
      setTimeout(() => chatInputRef.current?.focus(), 150);
    }
  }, [isOpen, activeTab, showInputDrawer]);

  // Manejo de drag and drop sobre el área de chat
  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      const lower = f.name.toLowerCase();
      if (
        lower.endsWith('.pdf') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.docx') ||
        lower.endsWith('.doc')
      ) {
        setAttachedFile(f);
        setAnalisisError(null);
      } else {
        setAnalisisError('Formatos admitidos: PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls) o Texto (.txt).');
      }
    }
  };

  // ========================================================
  // ACCIÓN 1: ANALIZAR DOCUMENTO O CORREO
  // ========================================================
  const handleAnalyze = async (overrideText?: string, overrideFile?: File | null) => {
    const textToAnalyze = (overrideText !== undefined ? overrideText : pastedText || chatInput).trim();
    const fileToAnalyze = overrideFile !== undefined ? overrideFile : attachedFile;

    if (!textToAnalyze && !fileToAnalyze) {
      setAnalisisError('Por favor selecciona un archivo (PDF, Word, Excel o TXT) o pega el texto de la solicitud.');
      return;
    }

    if (fileToAnalyze) {
      setLastAnalyzedFile(fileToAnalyze);
    }
    if (textToAnalyze) {
      setLastAnalyzedText(textToAnalyze);
    }

    setAnalisisLoading(true);
    setAnalisisError(null);
    setAnalisisStep(0);
    setCampanaCargada(false);

    // Identificar distintivo del tipo de archivo
    const fileBadge = fileToAnalyze ? getFileBadgeInfo(fileToAnalyze.name) : null;

    // Agregar mensaje del usuario a la conversación
    const isReanalysis = Boolean(overrideFile || (activeAnalisis && fileToAnalyze));
    const userMsgContent = fileToAnalyze
      ? `${fileBadge?.iconText || '📄'} **${isReanalysis ? 'Re-análisis de archivo' : 'Archivo adjunto'} [${fileBadge?.label || 'Documento'}]:** ${fileToAnalyze.name} (${(
          fileToAnalyze.size / 1024
        ).toFixed(1)} KB)${textToAnalyze ? `\n\n*Instrucción:* ${textToAnalyze}` : ''}`
      : `📧 **Solicitud / Correo de Licitación:**\n\n${textToAnalyze}`;

    const userMsg: DisplayChatMessage = {
      id: `user-analisis-${Date.now()}`,
      role: 'user',
      content: userMsgContent,
      archivoAdjunto: fileToAnalyze
        ? { nombre: fileToAnalyze.name, tamanoKb: Math.round(fileToAnalyze.size / 1024) }
        : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    // Resetear inputs de análisis
    setPastedText('');
    setChatInput('');
    setAttachedFile(null);
    setShowInputDrawer(false);

    try {
      let res: Response;
      if (fileToAnalyze) {
        const formData = new FormData();
        formData.append('file', fileToAnalyze);
        if (textToAnalyze) formData.append('texto', textToAnalyze);
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
            texto: textToAnalyze,
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

      const parsedAnalisis: AiAnalisisResponse = data;
      setActiveAnalisis(parsedAnalisis);

      const itemsSugeridos = (parsedAnalisis.ensayos_sugeridos || []).map((e: AiEnsayoSugerido) => ({
        ...e,
        seleccionado: true,
      }));

      // Combinar inteligentemente con los ensayos previamente seleccionados para no perder personalizaciones
      setEnsayosSeleccionados((prevSelected) => {
        if (prevSelected.length === 0) return itemsSugeridos;
        const combined = itemsSugeridos.map((newItem) => {
          const prev = prevSelected.find((p) => p.codigo === newItem.codigo);
          if (prev) {
            return {
              ...newItem,
              cantidad_estimada: Math.max(prev.cantidad_estimada, newItem.cantidad_estimada),
              seleccionado: true,
            };
          }
          return newItem;
        });
        for (const prev of prevSelected) {
          if (!combined.some((c) => c.codigo === prev.codigo)) {
            combined.push({
              ...prev,
              seleccionado: prev.seleccionado ?? true,
            });
          }
        }
        return combined;
      });

      // Agregar respuesta del asistente con la propuesta interactiva
      const assistantMsg: DisplayChatMessage = {
        id: `asst-analisis-${Date.now()}`,
        role: 'assistant',
        content: isReanalysis
          ? `🔍 **Revisión exhaustiva completada para "${
              parsedAnalisis.datos_proyecto_detectados.nombre_obra || 'el proyecto'
            }":**\n\nHe examinado nuevamente el documento completo (${fileToAnalyze?.name || 'solicitud'}), atendiendo a tus indicaciones sobre páginas y ensayos específicos. La campaña cuenta ahora con **${
              parsedAnalisis.ensayos_sugeridos?.length || 0
            } ensayos oficiales DGL** detectados en todas las secciones y páginas requeridas.\n\nPuedes revisar la propuesta actualizada abajo, cargarla al presupuesto o seguir ajustándola por este chat:`
          : `He analizado la solicitud técnica para el proyecto "${
              parsedAnalisis.datos_proyecto_detectados.nombre_obra || 'Sin nombre'
            }" (${parsedAnalisis.datos_proyecto_detectados.empresa_cliente || 'Cliente particular'}).\n\nEstructuré una propuesta de **${
              itemsSugeridos.length
            } ensayos oficiales DGL** conforme al tarifario IDIEM y la normativa aplicable (${
              parsedAnalisis.normativa_aplicable?.slice(0, 3).join(', ') || 'NCh1508'
            }). Puedes revisar y ajustar la campaña a continuación, cargarla al presupuesto o pedirme cualquier modificación directamente por este chat:`,
        analisis: parsedAnalisis,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setAnalisisError(errorText);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Ocurrió un problema al analizar la solicitud: ${errorText}. Por favor intenta nuevamente o sube el archivo en otro formato.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAnalisisLoading(false);
    }
  };

  // ========================================================
  // ACCIÓN 2: CHAT CONVERSACIONAL E INTERACCIÓN POST-ANÁLISIS
  // ========================================================
  const handleSendChatMessage = async (textToSend?: string) => {
    // 1. Si hay un archivo adjunto pendiente en el clip, procesar como análisis
    if (attachedFile) {
      handleAnalyze(textToSend || chatInput);
      return;
    }

    const text = (textToSend || chatInput).trim();
    if (!text || chatLoading || analisisLoading) return;

    // 2. Si hay un documento en memoria y el usuario pide re-examinar, buscar más ensayos o revisar páginas específicas:
    if (lastAnalyzedFile && isDocumentRecheckRequest(text)) {
      handleAnalyze(text, lastAnalyzedFile);
      return;
    }

    // 3. Si hay un texto extenso de licitación en memoria y el usuario pide re-examinar:
    if (!lastAnalyzedFile && lastAnalyzedText && isDocumentRecheckRequest(text)) {
      handleAnalyze(`${text}\n\n[Texto original de licitación]:\n${lastAnalyzedText}`);
      return;
    }

    const userMsg: DisplayChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      // Historial enriquecido para que la IA sepa qué se analizó
      const historial: AiChatMessage[] = chatMessages.map((m) => {
        let content = m.content;
        if (m.analisis) {
          content += `\n[Campaña técnica sugerida: Obra "${m.analisis.datos_proyecto_detectados.nombre_obra || ''}", Cliente "${
            m.analisis.datos_proyecto_detectados.empresa_cliente || ''
          }", CC "${m.analisis.datos_proyecto_detectados.centro_costo_sugerido || ''}". Ensayos: ${m.analisis.ensayos_sugeridos
            .map((e) => `Cód ${e.codigo}: ${e.designacion} (cant: ${e.cantidad_estimada})`)
            .join('; ')}]`;
        }
        return {
          role: m.role,
          content,
        };
      });

      // Si la campaña ya fue cargada, enviamos currentItems; si no, enviamos los ensayos de la campaña activa
      let itemsPayload = currentItems.map((it) => ({
        code: it.code,
        designation: it.designation,
        quantity: it.quantity,
        factor: it.factor,
        ufPrice: it.ufPrice,
      }));

      if (itemsPayload.length === 0 && ensayosSeleccionados.length > 0) {
        itemsPayload = ensayosSeleccionados
          .filter((e) => e.seleccionado)
          .map((e) => ({
            code: e.codigo,
            designation: e.designacion,
            quantity: e.cantidad_estimada,
            factor: 1.0,
            ufPrice: e.precio_uf,
          }));
      }

      const activeContext = {
        clientName: activeAnalisis?.datos_proyecto_detectados.empresa_cliente || contexto.clientName,
        projectName: activeAnalisis?.datos_proyecto_detectados.nombre_obra || contexto.projectName,
        centroCosto: activeAnalisis?.datos_proyecto_detectados.centro_costo_sugerido || contexto.centroCosto,
        currency: contexto.currency,
      };

      const res = await fetch('/api/ai/chat-asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: text,
          historial,
          itemsActuales: itemsPayload,
          contexto: activeContext,
          apiKey: customApiKey.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al conectar con el asistente de IA');
      }

      const data: AiChatResponse = await res.json();

      const assistantMsg: DisplayChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.mensaje || 'He procesado tu solicitud.',
        acciones: data.acciones,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      // Aplicar las acciones
      if (Array.isArray(data.acciones) && data.acciones.length > 0) {
        // 1. Si los ítems ya están en el presupuesto principal, aplicar acciones en el cotizador
        if (currentItems.length > 0 || campanaCargada) {
          onApplyActions(data.acciones, data.itemsAgregadosCompletos || []);
        }

        // 2. Sincronizar también con la tarjeta de campaña activa en el chat si está visible
        if (ensayosSeleccionados.length > 0) {
          setEnsayosSeleccionados((prev) => {
            let updated = [...prev];
            for (const act of data.acciones) {
              if (act.tipo === 'ELIMINAR' && act.codigo) {
                updated = updated.filter((e) => e.codigo !== act.codigo);
              } else if (act.tipo === 'MODIFICAR_CANTIDAD' && act.codigo && act.cantidad) {
                updated = updated.map((e) =>
                  e.codigo === act.codigo ? { ...e, cantidad_estimada: act.cantidad! } : e
                );
              } else if (act.tipo === 'AGREGAR' && act.codigo) {
                const already = updated.some((e) => e.codigo === act.codigo);
                if (!already) {
                  const itemCompleto = data.itemsAgregadosCompletos?.find((it) => it.code === act.codigo);
                  if (itemCompleto) {
                    updated.push({
                      sku: itemCompleto.sku || `SKU-${act.codigo}`,
                      codigo: itemCompleto.code,
                      designacion: itemCompleto.designation,
                      norma: itemCompleto.norm || 'Norma IDIEM',
                      centro_costo: itemCompleto.cc || '1817',
                      unidad: itemCompleto.unit || 'c/u',
                      precio_uf: itemCompleto.ufPrice || 0,
                      cantidad_estimada: act.cantidad || 1,
                      justificacion_tecnica: act.descripcion || 'Agregado mediante chat interactivo',
                      seleccionado: true,
                    });
                  }
                }
              }
            }
            return updated;
          });
        }

        // 3. Retroalimentación automática de aprendizaje (Opción B)
        for (const act of data.acciones) {
          if (act.tipo === 'AGREGAR' && act.codigo) {
            fetch('/api/ai/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                terminoUsuario: text,
                codigoEnsayo: act.codigo,
                origen: 'chat_ia',
              }),
            }).catch(() => {});
          }
        }
      }
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error desconocido';
      setChatMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Ocurrió un inconveniente al procesar tu instrucción: ${errorText}. Por favor intenta nuevamente.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('¿Deseas reiniciar la conversación con el asistente?')) {
      setChatMessages([
        {
          id: 'welcome-reset',
          role: 'assistant',
          content:
            'Conversación reiniciada. Puedes adjuntar un documento (PDF, Word, Excel o TXT), pegar un correo o pedirme cualquier instrucción técnica para tu presupuesto.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setActiveAnalisis(null);
      setEnsayosSeleccionados([]);
      setCampanaCargada(false);
      setAttachedFile(null);
      setLastAnalyzedFile(null);
      setLastAnalyzedText('');
      setPastedText('');
      setShowInputDrawer(false);
    }
  };

  // Manejadores para la tabla interactiva de campaña
  const toggleEnsayo = (index: number) => {
    setEnsayosSeleccionados((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, seleccionado: !item.seleccionado } : item
      )
    );
  };

  const updateCantidadEnsayo = (index: number, val: number) => {
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

  const handleCopyEmail = (correo?: string) => {
    const textToCopy = correo || activeAnalisis?.borrador_correo_aclaratorio;
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedMail(true);
    setTimeout(() => setCopiedMail(false), 2500);
  };

  const handleApplyCampaignClick = () => {
    if (!activeAnalisis) return;
    const activos = ensayosSeleccionados.filter((e) => e.seleccionado);
    if (activos.length === 0) {
      alert('Debes seleccionar al menos un ensayo para cargar al presupuesto.');
      return;
    }

    onApplyCampaign({
      datosProyecto: activeAnalisis.datos_proyecto_detectados,
      ensayos: activos,
      centroCosto: activeAnalisis.datos_proyecto_detectados.centro_costo_sugerido,
      observacionesComerciales: activeAnalisis.observaciones_comerciales,
    });

    setCampanaCargada(true);

    // Mensaje en el chat confirmando la carga
    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-cargado-${Date.now()}`,
        role: 'assistant',
        content: `✅ **¡Campaña cargada exitosamente en el presupuesto!**\nSe incorporaron **${activos.length} ensayos** por un subtotal estimado de **${totalSeleccionadoUf.toFixed(
          2
        )} UF**.\n\nPuedes seguir interactuando conmigo aquí abajo para hacer modificaciones en tiempo real (ej. *"aplica 10% de descuento"*, *"agrega 2 muestras más de corte"*), o cerrar esta ventana cuando desees.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const totalSeleccionadoUf = ensayosSeleccionados
    .filter((e) => e.seleccionado)
    .reduce((acc, curr) => acc + curr.precio_uf * curr.cantidad_estimada, 0);

  // ==========================================
  // ESTADOS DE PESTAÑA: MEMORIA Y APRENDIZAJE IA
  // ==========================================
  const [reglasAprendidas, setReglasAprendidas] = useState<ReglaAprendida[]>([]);
  const [casosRAG, setCasosRAG] = useState<CasoReferenciaRAG[]>([]);
  const [loadingMemoria, setLoadingMemoria] = useState(false);
  const [filtroReglas, setFiltroReglas] = useState('');
  const [showNuevaReglaModal, setShowNuevaReglaModal] = useState(false);
  const [nuevoTermino, setNuevoTermino] = useState('');
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [guardandoRegla, setGuardandoRegla] = useState(false);

  const fetchMemoriaData = async () => {
    setLoadingMemoria(true);
    try {
      const [resReglas, resRAG] = await Promise.all([
        fetch('/api/ai/feedback'),
        fetch('/api/ai/rag-casos'),
      ]);

      if (resReglas.ok) {
        const dReglas = await resReglas.json();
        setReglasAprendidas(dReglas.reglas || []);
      }
      if (resRAG.ok) {
        const dRAG = await resRAG.json();
        setCasosRAG(dRAG.casos || []);
      }
    } catch (e) {
      console.error('Error al cargar memoria de IA:', e);
    } finally {
      setLoadingMemoria(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'memoria') {
      fetchMemoriaData();
    }
  }, [isOpen, activeTab]);

  const handleToggleEstadoRegla = async (id: string) => {
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setReglasAprendidas((prev) =>
          prev.map((r) => (r.id === id ? { ...r, estado: data.regla.estado } : r))
        );
      }
    } catch (e) {
      console.error('Error al alternar estado de regla:', e);
    }
  };

  const handleDeleteRegla = async (id: string) => {
    if (!confirm('¿Deseas eliminar esta regla de aprendizaje?')) return;
    try {
      const res = await fetch(`/api/ai/feedback?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setReglasAprendidas((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (e) {
      console.error('Error al eliminar regla:', e);
    }
  };

  const handleCrearRegla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTermino.trim() || !nuevoCodigo.trim()) return;

    setGuardandoRegla(true);
    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminoUsuario: nuevoTermino.trim(),
          codigoEnsayo: nuevoCodigo.trim(),
          origen: 'manual',
        }),
      });

      if (res.ok) {
        setNuevoTermino('');
        setNuevoCodigo('');
        setShowNuevaReglaModal(false);
        fetchMemoriaData();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Error al guardar la regla');
      }
    } catch (err) {
      console.error(err);
      alert('Error de conexión al guardar regla');
    } finally {
      setGuardandoRegla(false);
    }
  };

  const reglasFiltradas = reglasAprendidas.filter((r) => {
    const q = filtroReglas.toLowerCase();
    return (
      r.terminoUsuario.toLowerCase().includes(q) ||
      (r.codigoEnsayo && r.codigoEnsayo.toLowerCase().includes(q)) ||
      (r.designacion && r.designacion.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl h-[94vh] max-h-[96vh] flex flex-col overflow-hidden">
        {/* ======================================================== */}
        {/* HEADER UNIFICADO DE LA PLATAFORMA DE IA */}
        {/* ======================================================== */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 text-white px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-950/50 text-white border border-white/20 shrink-0">
              <Bot className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Asistente IA Técnico-Comercial DGL
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Zero Data Training
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  358 Ensayos Oficiales
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                Carga documentos, analiza correos de licitación y ajusta la propuesta interactuando en tiempo real con la IA
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden lg:inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/70 border border-emerald-700/50 px-2.5 py-1 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Gemini Flash Activo
            </span>
            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              title="Ajustes de API Key Institucional / Personalizada"
              className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 p-2 rounded-lg border border-slate-700 transition cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Cerrar Asistente (Esc)"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Ajuste de API Key (opcional / institucional) */}
        {showKeyInput && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-emerald-900 shrink-0">
            <div className="flex items-center gap-2 flex-1">
              <Key className="w-4 h-4 text-emerald-700 shrink-0" />
              <span className="font-semibold shrink-0">Estado de Llave Gemini:</span>
              <span className="text-[11px] text-emerald-800">
                ✓ Conectado mediante clave oficial institucional en servidor. No requiere configuración individual.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                placeholder="Personalizar API Key (Opcional)"
                className="w-56 px-2.5 py-1 bg-white border border-emerald-300 rounded text-slate-800 font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              {customApiKey && (
                <button
                  type="button"
                  onClick={() => handleSaveKey('')}
                  className="text-[10px] text-red-600 hover:underline cursor-pointer"
                >
                  Restaurar servidor
                </button>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* BARRA DE NAVEGACIÓN UNIFICADA (2 PESTAÑAS) */}
        {/* ======================================================== */}
        <div className="bg-slate-100 px-4 pt-2 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 sm:gap-2">
            {/* PESTAÑA UNIFICADA: ASISTENTE TÉCNICO-COMERCIAL (CHAT + ANÁLISIS) */}
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-t border-x cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-white text-blue-700 border-slate-200 -mb-[1px] shadow-xs'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
              }`}
            >
              <Bot className="w-4 h-4 text-blue-600" />
              <span>Asistente IA Técnico-Comercial</span>
              <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Chat & Análisis de Solicitudes
              </span>
              {currentItems.length > 0 && (
                <span className="hidden md:inline-flex text-[10px] bg-slate-100 text-slate-700 font-mono px-1.5 py-0.2 rounded border border-slate-200">
                  {currentItems.length} {currentItems.length === 1 ? 'ítem en cotización' : 'ítems en cotización'}
                </span>
              )}
            </button>

            {/* PESTAÑA 2: MEMORIA Y APRENDIZAJE */}
            <button
              type="button"
              onClick={() => setActiveTab('memoria')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-bold rounded-t-xl transition-all border-t border-x cursor-pointer ${
                activeTab === 'memoria'
                  ? 'bg-white text-indigo-700 border-slate-200 -mb-[1px] shadow-xs'
                  : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
              }`}
            >
              <Brain className="w-4 h-4 text-indigo-600" />
              <span>Memoria & Aprendizaje IA</span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 font-semibold px-1.5 py-0.2 rounded-full">
                RAG + Reglas
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 pb-1 text-[11px] text-slate-500">
            {(activeAnalisis?.datos_proyecto_detectados.empresa_cliente || contexto.clientName) && (
              <span className="truncate max-w-[200px]">
                <strong className="text-slate-700">Cliente:</strong>{' '}
                {activeAnalisis?.datos_proyecto_detectados.empresa_cliente || contexto.clientName}
              </span>
            )}
            {(activeAnalisis?.datos_proyecto_detectados.centro_costo_sugerido || contexto.centroCosto) && (
              <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                {(activeAnalisis?.datos_proyecto_detectados.centro_costo_sugerido || contexto.centroCosto)?.slice(0, 4)}
              </span>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* CUERPO DINÁMICO */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          {/* ====================================================== */}
          {/* TAB 1: ASISTENTE UNIFICADO (CHAT & ANÁLISIS DE SOLICITUDES) */}
          {/* ====================================================== */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Franja superior de estado y acciones rápidas de carga */}
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-3">
                  <div>
                    <span className="font-semibold text-slate-700">Presupuesto:</span>{' '}
                    <span className="font-bold text-blue-700 font-mono">{currentItems.length}</span>{' '}
                    {currentItems.length === 1 ? 'ítem cargado' : 'ítems cargados'}
                  </div>
                  <span className="text-slate-300">|</span>
                  <div className="text-slate-600 font-medium truncate max-w-xs">
                    {activeAnalisis?.datos_proyecto_detectados.nombre_obra
                      ? `Proyecto: ${activeAnalisis.datos_proyecto_detectados.nombre_obra}`
                      : contexto.projectName
                      ? `Proyecto: ${contexto.projectName}`
                      : 'Presupuesto en elaboración'}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botón para abrir el cargador de solicitudes / correos */}
                  <button
                    type="button"
                    onClick={() => setShowInputDrawer(!showInputDrawer)}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 text-xs font-bold border ${
                      showInputDrawer
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    <FileUp className="w-3.5 h-3.5 text-red-600" />
                    <span>Cargar Solicitud (PDF, Excel, Word o Correo)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearChat}
                    title="Reiniciar conversación"
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded transition cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Reiniciar</span>
                  </button>
                </div>
              </div>

              {/* DRAWER DESPLEGABLE: CARGA DE DOCUMENTOS / CORREOS DE LICITACIÓN */}
              {showInputDrawer && (
                <div className="bg-slate-50 border-b border-slate-300 p-4 sm:p-5 shadow-inner transition-all animate-in slide-in-from-top-3 duration-200 shrink-0 max-h-[50vh] overflow-y-auto">
                  <div className="max-w-4xl mx-auto space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-red-600" />
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                          Analizar Solicitud de Cotización con IA
                        </h4>
                        <span className="text-[10px] text-slate-500 hidden sm:inline">
                          PDF, Planillas Excel, Documentos Word o texto de licitación
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs font-bold">
                          <button
                            type="button"
                            onClick={() => setDrawerMode('text')}
                            className={`px-2.5 py-1 rounded-md transition ${
                              drawerMode === 'text' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            Pegar Texto
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrawerMode('file')}
                            className={`px-2.5 py-1 rounded-md transition ${
                              drawerMode === 'file' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                            }`}
                          >
                            Subir Archivo (PDF, Excel, Word)
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowInputDrawer(false)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {drawerMode === 'text' ? (
                      <div className="space-y-2">
                        <textarea
                          rows={4}
                          value={pastedText}
                          onChange={(e) => setPastedText(e.target.value)}
                          placeholder="Pega aquí el correo del cliente, memoria técnica o requerimiento de licitación..."
                          className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none placeholder:text-slate-400"
                        />

                        {/* Ejemplos de prueba rápida */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[11px] text-slate-500 font-medium">Casos de prueba IDIEM:</span>
                          {ANALISIS_EJEMPLOS.map((ej, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setPastedText(ej.texto)}
                              className="text-[11px] bg-white hover:bg-red-50 hover:text-red-700 text-slate-700 border border-slate-200 hover:border-red-200 px-2.5 py-0.5 rounded-md transition font-medium cursor-pointer"
                            >
                              ⚡ {ej.titulo}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDropFile}
                          onClick={() => drawerFileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-300 hover:border-red-500 rounded-xl p-5 text-center cursor-pointer transition bg-white hover:bg-red-50/20 flex flex-col items-center justify-center space-y-2"
                        >
                          <input
                            ref={drawerFileInputRef}
                            type="file"
                            accept=".pdf,.txt,.xlsx,.xls,.docx,.doc"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setAttachedFile(e.target.files[0]);
                                setAnalisisError(null);
                              }
                            }}
                            className="hidden"
                          />
                          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-800">
                              {attachedFile ? attachedFile.name : 'Haz clic para seleccionar o arrastra aquí tu archivo'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Formatos soportados: PDF (.pdf), Word (.docx, .doc), Planillas Excel (.xlsx, .xls) o Texto (.txt)
                            </p>
                          </div>

                          {attachedFile && (() => {
                            const badge = getFileBadgeInfo(attachedFile.name);
                            return (
                              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs shadow-xs ${badge.bg}`}>
                                <span>{badge.iconText}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${badge.pillBg}`}>
                                  {badge.label}
                                </span>
                                <span className="font-semibold">{attachedFile.name}</span>
                                <span className="text-slate-500">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAttachedFile(null);
                                  }}
                                  className="text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })()}
                        </div>

                        <div>
                          <input
                            type="text"
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Comentario o instrucción adicional para el análisis (opcional)..."
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-red-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {analisisError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{analisisError}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Zero Data Training • Procesamiento confidencial IDIEM
                      </span>
                      <button
                        type="button"
                        disabled={analisisLoading || (!pastedText.trim() && !attachedFile)}
                        onClick={() => handleAnalyze()}
                        className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 rounded-xl transition shadow-md shadow-red-600/30 flex items-center gap-2 cursor-pointer"
                      >
                        {analisisLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-amber-300" />
                        )}
                        <span>Analizar Solicitud con IA</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* FEED DE MENSAJES DEL CHAT (INTERACTIVO + TARJETAS DE ANÁLISIS) */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFile}
                className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50"
              >
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[95%] sm:max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs ${
                        m.role === 'user'
                          ? 'bg-blue-700 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                      }`}
                    >
                      {/* Texto del mensaje */}
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {/* Tarjeta de acciones rápidas aplicadas por el Asistente */}
                      {m.acciones && m.acciones.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                          <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{m.acciones.length} cambio(s) aplicados en el presupuesto:</span>
                          </div>
                          <ul className="space-y-1 text-[11px] text-slate-700">
                            {m.acciones.map((act, i) => (
                              <li
                                key={i}
                                className="bg-emerald-50/80 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-2"
                              >
                                {act.tipo === 'AGREGAR' && (
                                  <>
                                    <span className="font-bold text-emerald-800">+ {act.cantidad || 1}x</span>
                                    <span className="font-mono text-[10px] text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded font-bold">
                                      Cód. {act.codigo}
                                    </span>
                                    <span className="truncate">{act.descripcion || 'Ensayo agregado'}</span>
                                  </>
                                )}
                                {act.tipo === 'MODIFICAR_CANTIDAD' && (
                                  <>
                                    <span className="font-bold text-blue-800">✎ Cantidad:</span>
                                    <span className="font-mono text-[10px] text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded font-bold">
                                      Cód. {act.codigo}
                                    </span>
                                    <span>a {act.cantidad} muestra(s)</span>
                                  </>
                                )}
                                {act.tipo === 'ELIMINAR' && (
                                  <>
                                    <span className="font-bold text-red-700">✕ Eliminado:</span>
                                    <span className="font-mono text-[10px] text-red-900 bg-red-100 px-1.5 py-0.5 rounded font-bold">
                                      Cód. {act.codigo}
                                    </span>
                                  </>
                                )}
                                {act.tipo === 'APLICAR_FACTOR' && (
                                  <>
                                    <span className="font-bold text-purple-700">% Factor ajustado:</span>
                                    <span className="font-bold">{act.factor}</span>
                                    {act.codigo && <span className="font-mono text-[10px]">(Cód. {act.codigo})</span>}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* ======================================================== */}
                      {/* TARJETA INTERACTIVA DE CAMPAÑA ANALIZADA DENTRO DEL CHAT */}
                      {/* ======================================================== */}
                      {m.analisis && (
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-4">
                          {/* Diagnóstico del Proyecto y Sede */}
                          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-xl p-4 shadow-md border border-slate-700">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/80 pb-3">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                                  <Sparkles className="w-3 h-3" />
                                  Diagnóstico Técnico de Solicitud
                                </span>
                                <h4 className="text-sm font-bold text-white mt-0.5">
                                  Campaña Geotécnica Propuesta
                                </h4>
                                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                                  {m.analisis.resumen_tecnico_proyecto}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="bg-slate-800 border border-slate-600 px-2.5 py-1 rounded-lg text-center">
                                  <span className="text-[9px] text-slate-400 block">Centro de Costo</span>
                                  <span className="text-xs font-bold text-emerald-400">
                                    {m.analisis.datos_proyecto_detectados.centro_costo_sugerido || '1817 - Suelos'}
                                  </span>
                                </div>
                                <div className="bg-slate-800 border border-slate-600 px-2.5 py-1 rounded-lg text-center">
                                  <span className="text-[9px] text-slate-400 block">Total Estimado</span>
                                  <span className="text-xs font-extrabold text-white">
                                    {totalSeleccionadoUf.toFixed(2)} UF
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 text-[11px]">
                              <div>
                                <span className="text-slate-400 text-[10px] block">Cliente:</span>
                                <span className="font-semibold text-white truncate block">
                                  {m.analisis.datos_proyecto_detectados.empresa_cliente || 'No especificado'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">Proyecto:</span>
                                <span className="font-semibold text-white truncate block">
                                  {m.analisis.datos_proyecto_detectados.nombre_obra || 'No especificado'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">Ubicación / Sede:</span>
                                <span className="font-semibold text-white truncate block">
                                  {m.analisis.datos_proyecto_detectados.ciudad_sede || 'Santiago / Regiones'}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400 text-[10px] block">Batería Técnica:</span>
                                <span className="font-semibold text-emerald-400 block">
                                  {ensayosSeleccionados.filter((e) => e.seleccionado).length} de {ensayosSeleccionados.length} ensayos
                                </span>
                              </div>
                            </div>

                            {/* Acciones directas de re-análisis sobre el documento origen */}
                            {lastAnalyzedFile && (
                              <div className="mt-3 pt-2.5 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-2 text-slate-300 text-[11px] truncate">
                                  <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span>Documento origen: <strong className="text-white">{lastAnalyzedFile.name}</strong></span>
                                  <span className="text-[10px] text-slate-400 font-mono">({(lastAnalyzedFile.size / 1024).toFixed(1)} KB)</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={analisisLoading}
                                    onClick={() =>
                                      handleAnalyze(
                                        'Revisión exhaustiva completa: examina todo el documento de principio a fin, página por página (incluyendo anexos, tablas de especificaciones y calicatas), e incorpora todos los ensayos solicitados sin omitir ninguno.',
                                        lastAnalyzedFile
                                      )
                                    }
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    title="Volver a escanear exhaustivamente todas las páginas del documento"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${analisisLoading ? 'animate-spin' : ''}`} />
                                    <span>Re-analizar documento completo</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={analisisLoading}
                                    onClick={() => {
                                      setChatInput('Revisa porque en la página 4 y 5 solicitan más ensayos');
                                      setTimeout(() => chatInputRef.current?.focus(), 80);
                                    }}
                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-600 rounded-lg text-[11px] font-semibold transition cursor-pointer"
                                    title="Indicar páginas 4 y 5"
                                  >
                                    <span>Revisar pág. 4 y 5...</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Sub-tabs de la Propuesta: Ensayos | Consultas al Mandante | Alertas */}
                          <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                            <button
                              type="button"
                              onClick={() => setAnalisisResultSubTab('ensayos')}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                analisisResultSubTab === 'ensayos'
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Ensayos Sugeridos ({ensayosSeleccionados.filter((e) => e.seleccionado).length})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnalisisResultSubTab('consultas')}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                analisisResultSubTab === 'consultas'
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Consultas Técnicas ({m.analisis.preguntas_para_el_cliente?.length || 0})</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAnalisisResultSubTab('alertas')}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                analisisResultSubTab === 'alertas'
                                  ? 'bg-slate-900 text-white'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Alertas y Normativa ({m.analisis.normativa_aplicable?.length || 0})</span>
                            </button>
                          </div>

                          {/* SUB-TAB 1: ENSAYOS SUGERIDOS INTERACTIVOS */}
                          {analisisResultSubTab === 'ensayos' && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>Ajusta cantidades o desmarca ensayos según necesidad:</span>
                                <div className="flex items-center gap-2 font-medium">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEnsayosSeleccionados((prev) =>
                                        prev.map((e) => ({ ...e, seleccionado: true }))
                                      )
                                    }
                                    className="text-blue-700 hover:underline cursor-pointer"
                                  >
                                    Seleccionar todos
                                  </button>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEnsayosSeleccionados((prev) =>
                                        prev.map((e) => ({ ...e, seleccionado: false }))
                                      )
                                    }
                                    className="text-slate-500 hover:underline cursor-pointer"
                                  >
                                    Deseleccionar
                                  </button>
                                </div>
                              </div>

                              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                                {ensayosSeleccionados.map((ensayo, idx) => (
                                  <div
                                    key={idx}
                                    className={`p-3 transition-colors ${
                                      ensayo.seleccionado ? 'bg-white' : 'bg-slate-50 opacity-60'
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <input
                                        type="checkbox"
                                        checked={ensayo.seleccionado}
                                        onChange={() => toggleEnsayo(idx)}
                                        className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                            Cód. {ensayo.codigo}
                                          </span>
                                          <span className="text-xs font-bold text-slate-900">
                                            {ensayo.designacion}
                                          </span>
                                          {ensayo.norma && (
                                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                                              {ensayo.norma}
                                            </span>
                                          )}
                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                            CC: {ensayo.centro_costo || '1817'}
                                          </span>
                                        </div>

                                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                                          <div className="flex items-center gap-1.5">
                                            <label className="text-slate-500 text-[11px]">Muestras:</label>
                                            <input
                                              type="number"
                                              min={1}
                                              value={ensayo.cantidad_estimada}
                                              onChange={(e) =>
                                                updateCantidadEnsayo(idx, parseInt(e.target.value) || 1)
                                              }
                                              disabled={!ensayo.seleccionado}
                                              className="w-14 px-1.5 py-0.5 bg-white border border-slate-300 rounded text-center text-xs font-bold text-slate-800 disabled:bg-slate-100"
                                            />
                                            <span className="text-slate-400 text-[10px]">{ensayo.unidad || 'c/u'}</span>
                                          </div>

                                          <div className="flex items-center gap-3">
                                            <div className="text-right">
                                              <span className="text-[9px] text-slate-400 block">Unitario</span>
                                              <span className="font-semibold text-slate-700 text-xs">
                                                {ensayo.precio_uf.toFixed(2)} UF
                                              </span>
                                            </div>
                                            <div className="text-right">
                                              <span className="text-[9px] text-slate-400 block">Subtotal</span>
                                              <span className="font-bold text-slate-900 text-xs">
                                                {(ensayo.precio_uf * ensayo.cantidad_estimada).toFixed(2)} UF
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => toggleJustification(idx)}
                                              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                              title="Ver justificación técnica"
                                            >
                                              {expandedJustifications[idx] ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                              ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                              )}
                                            </button>
                                          </div>
                                        </div>

                                        {expandedJustifications[idx] && ensayo.justificacion_tecnica && (
                                          <div className="mt-1.5 p-2 bg-blue-50/70 border border-blue-200/70 rounded text-[11px] text-blue-900 leading-relaxed">
                                            <strong className="font-semibold">Justificación técnica:</strong>{' '}
                                            {ensayo.justificacion_tecnica}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* SUB-TAB 2: CONSULTAS AL CLIENTE & BORRADOR DE CORREO */}
                          {analisisResultSubTab === 'consultas' && (
                            <div className="space-y-3">
                              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 space-y-1.5">
                                <div className="font-bold flex items-center gap-1.5">
                                  <HelpCircle className="w-4 h-4 text-amber-700" />
                                  <span>Puntos a aclarar con el mandante:</span>
                                </div>
                                <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                                  {m.analisis.preguntas_para_el_cliente?.map((q, i) => (
                                    <li key={i}>{q}</li>
                                  ))}
                                </ul>
                              </div>

                              {m.analisis.borrador_correo_aclaratorio && (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                                      Borrador de Correo Formal Listo para Enviar:
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyEmail(m.analisis?.borrador_correo_aclaratorio)}
                                      className="text-xs font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition flex items-center gap-1.5 cursor-pointer"
                                    >
                                      {copiedMail ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          <span className="text-emerald-700">¡Copiado!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copiar Correo</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-sans whitespace-pre-wrap text-slate-800 leading-relaxed select-all max-h-48 overflow-y-auto">
                                    {m.analisis.borrador_correo_aclaratorio}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* SUB-TAB 3: ALERTAS Y NORMATIVA */}
                          {analisisResultSubTab === 'alertas' && (
                            <div className="space-y-2.5 text-xs">
                              {m.analisis.ensayos_no_disponibles_o_especiales &&
                                m.analisis.ensayos_no_disponibles_o_especiales.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="font-bold text-red-800 block text-[11px]">
                                      Ensayos especiales o no tabulados detectados:
                                    </span>
                                    {m.analisis.ensayos_no_disponibles_o_especiales.map((esp, idx) => (
                                      <div
                                        key={idx}
                                        className="bg-red-50 border border-red-200 text-red-900 p-2.5 rounded-xl flex items-start gap-2"
                                      >
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                        <div>
                                          <span className="font-bold">{esp.ensayo_solicitado}: </span>
                                          <span>{esp.motivo}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                              {m.analisis.normativa_aplicable && m.analisis.normativa_aplicable.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                  <strong className="block text-slate-800 font-bold mb-1 text-[11px]">
                                    Normativa Aplicable Identificada:
                                  </strong>
                                  <div className="flex flex-wrap gap-1">
                                    {m.analisis.normativa_aplicable.map((norm, i) => (
                                      <span
                                        key={i}
                                        className="bg-white border border-slate-300 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono"
                                      >
                                        {norm}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {m.analisis.observaciones_comerciales && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                  <strong className="block text-slate-800 font-bold mb-1 text-[11px]">
                                    Observaciones Comerciales IDIEM:
                                  </strong>
                                  <p className="text-slate-600 leading-relaxed text-[11px]">
                                    {m.analisis.observaciones_comerciales}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* BOTONES DE ACCIÓN DE LA CAMPAÑA */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-slate-600">
                              <span className="font-bold text-slate-900">
                                {ensayosSeleccionados.filter((e) => e.seleccionado).length} ensayos
                              </span>{' '}
                              seleccionados por un total estimado de{' '}
                              <span className="font-extrabold text-blue-700 font-mono text-sm">
                                {totalSeleccionadoUf.toFixed(2)} UF
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={handleApplyCampaignClick}
                              disabled={ensayosSeleccionados.filter((e) => e.seleccionado).length === 0}
                              className={`px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer ${
                                campanaCargada
                                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                                  : 'bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 shadow-blue-700/30'
                              } disabled:opacity-50`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>
                                {campanaCargada
                                  ? `✓ Campaña Cargada (${ensayosSeleccionados.filter((e) => e.seleccionado).length} Ensayos - Actualizar)`
                                  : `Cargar Campaña al Presupuesto (${totalSeleccionadoUf.toFixed(2)} UF)`}
                              </span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
                  </div>
                ))}

                {/* Loading indicator para análisis */}
                {analisisLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-white border border-red-200 rounded-2xl rounded-bl-xs p-4 text-xs shadow-xs space-y-2 max-w-md">
                      <div className="flex items-center gap-2 text-red-600 font-bold">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Analizando requerimiento geotécnico...</span>
                      </div>
                      <p className="text-[11px] text-slate-600 transition-all duration-300 font-medium pl-6">
                        {LOADING_STEPS[analisisStep]}
                      </p>
                    </div>
                  </div>
                )}

                {/* Loading indicator para chat */}
                {chatLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-600 shadow-xs flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span>Consultando catálogo oficial DGL y ejecutando instrucciones...</span>
                    </div>
                  </div>
                )}

                <div ref={chatMessagesEndRef} />
              </div>

              {/* BARRA DE SUGERENCIAS RÁPIDAS */}
              <div className="px-4 py-2 bg-slate-100/90 border-t border-slate-200 shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Sugerencias Rápidas de Presupuesto:
                  </span>
                  {activeAnalisis && (
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      💡 Puedes pedir cambios sobre la campaña analizada arriba
                    </span>
                  )}
                </div>

                {/* Sugerencias contextuales si hay un documento analizado en sesión */}
                {lastAnalyzedFile && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5 pb-1.5 border-b border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage('Revisa porque en la página 4 y 5 solicitan más ensayos')}
                      disabled={chatLoading || analisisLoading}
                      className="text-[11px] bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-300 font-bold rounded-lg px-2.5 py-1 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                      <span>Revisar páginas 4 y 5 (más ensayos)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage('Revisa exhaustivamente todo el documento completo sin omitir ningún ensayo')}
                      disabled={chatLoading || analisisLoading}
                      className="text-[11px] bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 font-bold rounded-lg px-2.5 py-1 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-700" />
                      <span>Escanear todo el documento sin omisiones</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                  {CHAT_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSendChatMessage(sug)}
                      disabled={chatLoading || analisisLoading}
                      className="text-[11px] text-left bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 rounded-lg px-2.5 py-1 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* INPUT BAR UNIFICADO (TEXTO + ADJUNTAR ARCHIVO CLIP + PEGAR CORREO) */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                {/* Chip si hay archivo adjunto listo para enviar */}
                {attachedFile && (() => {
                  const badge = getFileBadgeInfo(attachedFile.name);
                  return (
                    <div className={`mb-2 flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs shadow-xs ${badge.bg}`}>
                      <div className="flex items-center gap-2">
                        <span>{badge.iconText}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.pillBg}`}>
                          {badge.label}
                        </span>
                        <span className="font-semibold">{attachedFile.name}</span>
                        <span className="text-slate-500">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
                        <span className="text-emerald-700 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-full">
                          Listo para analizar
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        className="text-slate-400 hover:text-red-700 cursor-pointer p-0.5"
                        title="Quitar archivo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })()}

                {/* Banner de documento activo en memoria si no hay archivo pendiente */}
                {!attachedFile && lastAnalyzedFile && (() => {
                  const badge = getFileBadgeInfo(lastAnalyzedFile.name);
                  return (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs shadow-xs text-blue-900">
                      <div className="flex items-center gap-2 truncate max-w-full sm:max-w-md">
                        <span>{badge.iconText}</span>
                        <span className="text-slate-600 text-[11px] font-medium">Documento activo:</span>
                        <span className="font-bold text-blue-950 truncate">{lastAnalyzedFile.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ({(lastAnalyzedFile.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={analisisLoading || chatLoading}
                          onClick={() =>
                            handleAnalyze(
                              'Revisa exhaustivamente todo el documento sin omitir ningún ensayo de ninguna página, tabla o anexo.',
                              lastAnalyzedFile
                            )
                          }
                          className="px-2 py-0.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Volver a escanear exhaustivamente todo el documento"
                        >
                          <RefreshCw className={`w-3 h-3 ${analisisLoading ? 'animate-spin' : ''}`} />
                          <span>Re-analizar completo</span>
                        </button>
                        <button
                          type="button"
                          disabled={analisisLoading || chatLoading}
                          onClick={() => {
                            setChatInput('Revisa porque en la página 4 y 5 solicitan más ensayos');
                            setTimeout(() => chatInputRef.current?.focus(), 80);
                          }}
                          className="px-2 py-0.5 bg-white hover:bg-blue-100 text-blue-800 border border-blue-300 rounded-md text-[11px] font-semibold transition cursor-pointer"
                          title="Indicar páginas 4 y 5"
                        >
                          <span>Páginas 4 y 5</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setLastAnalyzedFile(null)}
                          className="text-slate-400 hover:text-slate-700 p-0.5 ml-1 cursor-pointer"
                          title="Desvincular documento activo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (attachedFile) {
                      handleAnalyze();
                    } else {
                      handleSendChatMessage();
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  {/* Input oculto para adjuntar archivo desde el clip */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.xlsx,.xls,.docx,.doc"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachedFile(e.target.files[0]);
                        setAnalisisError(null);
                      }
                    }}
                    className="hidden"
                  />

                  {/* Botón clip para adjuntar documento */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar archivo (PDF, Word, Excel o TXT) para analizar con IA"
                    className="p-2.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl border border-slate-300 transition cursor-pointer shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Botón rápido para abrir drawer de pegar correo */}
                  <button
                    type="button"
                    onClick={() => setShowInputDrawer(!showInputDrawer)}
                    title="Pegar texto de correo o licitación"
                    className="p-2.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl border border-slate-300 transition cursor-pointer shrink-0"
                  >
                    <Mail className="w-4 h-4" />
                  </button>

                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading || analisisLoading}
                    placeholder={
                      attachedFile
                        ? 'Agrega una nota u observación técnica para el análisis del archivo (opcional)...'
                        : activeAnalisis
                        ? 'Pídeme cambios a la campaña (ej. "quita el corte directo", "aplica 10% dcto", "aumenta a 5 las densidades")...'
                        : 'Escribe tu requerimiento, pega un correo, o adjunta un PDF / Word / Excel con el clip 📎...'
                    }
                    className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
                  />

                  <button
                    type="submit"
                    disabled={(!chatInput.trim() && !attachedFile) || chatLoading || analisisLoading}
                    className={`p-2.5 sm:px-5 sm:py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0 text-xs sm:text-sm font-bold text-white ${
                      attachedFile
                        ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
                        : 'bg-blue-700 hover:bg-blue-800'
                    }`}
                    title="Enviar instrucción (Enter)"
                  >
                    {chatLoading || analisisLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : attachedFile ? (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span className="hidden sm:inline">Analizar</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">Enviar</span>
                      </>
                    )}
                  </button>
                </form>

                <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5 px-1">
                  <span>Chat y análisis integrados en tiempo real sobre el tarifario DGL IDIEM.</span>
                  <span>Zero Data Training • Memoria RAG Activa</span>
                </div>
              </div>
            </div>
          )}

          {/* ====================================================== */}
          {/* TAB 2: MEMORIA Y APRENDIZAJE IA */}
          {/* ====================================================== */}
          {activeTab === 'memoria' && (
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* Tarjeta de Encabezado y Métricas */}
              <div className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 border border-indigo-900/50 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-900/60 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      Sistema de Aprendizaje Continuo DGL
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      Memoria Semántica Activa (Opciones A & B)
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      La IA aprende de cada cotización finalizada (RAG Histórico) y de las confirmaciones de ensayos
                      de los ingenieros, adaptando sinónimos y modismos sin alterar los pesos del modelo (Zero Retraining).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowNuevaReglaModal(true)}
                      className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Nueva Regla</span>
                    </button>
                    <Link
                      href="/configuracion/aprendizaje-ia"
                      className="px-3.5 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-xl transition border border-white/20 flex items-center gap-1.5"
                      title="Abrir panel completo de configuración"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Panel Maestro</span>
                    </Link>
                  </div>
                </div>

                {/* Métricas Rápidas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block">Reglas de Vocabulario</span>
                    <span className="text-lg font-bold text-white mt-0.5 block">
                      {reglasAprendidas.length}
                    </span>
                    <span className="text-[10px] text-emerald-400">
                      {reglasAprendidas.filter((r) => r.estado === 'activo').length} activas
                    </span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block">Casos Históricos RAG</span>
                    <span className="text-lg font-bold text-white mt-0.5 block">
                      {casosRAG.length}
                    </span>
                    <span className="text-[10px] text-indigo-300">Base IDIEM + Finalizadas</span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block">Confirmaciones de Usuario</span>
                    <span className="text-lg font-bold text-white mt-0.5 block">
                      {reglasAprendidas.reduce((acc, r) => acc + (r.conteoConfirmaciones || 0), 0)}
                    </span>
                    <span className="text-[10px] text-amber-300">Feedback Loop Opción B</span>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                    <span className="text-[10px] text-slate-400 block">Política de Privacidad</span>
                    <span className="text-xs font-bold text-emerald-300 mt-1 block">
                      100% Cero Retraining
                    </span>
                    <span className="text-[10px] text-slate-400">En memoria / In-context</span>
                  </div>
                </div>
              </div>

              {/* Diccionario de Reglas Aprendidas */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-700" />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      Diccionario de Modismos y Términos Aprendidos (Opción B)
                    </h4>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filtrar término o código..."
                      value={filtroReglas}
                      onChange={(e) => setFiltroReglas(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {loadingMemoria ? (
                  <div className="py-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Cargando memoria del sistema...</span>
                  </div>
                ) : reglasFiltradas.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                    No se encontraron reglas aprendidas con ese criterio.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {reglasFiltradas.map((regla) => (
                        <div
                          key={regla.id}
                          className="p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">
                                &quot;{regla.terminoUsuario}&quot;
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 shrink-0">
                                Cód. {regla.codigoEnsayo || 'N/A'}
                              </span>
                              <span className="truncate text-slate-600">
                                {regla.designacion || 'Ensayo oficial DGL'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span>Confirmado: <strong className="text-slate-700">{regla.conteoConfirmaciones} veces</strong></span>
                              <span>•</span>
                              <span>Origen: <strong className="text-slate-700">{regla.origen}</strong></span>
                              <span>•</span>
                              <span>Tipo: <strong className="text-slate-700">{regla.tipo}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleEstadoRegla(regla.id)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition ${
                                regla.estado === 'activo'
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              {regla.estado === 'activo' ? 'Activa' : 'Inactiva'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRegla(regla.id)}
                              className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                              title="Eliminar regla"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Casos Históricos de Referencia RAG (Opción A) */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-700" />
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                      Proyectos Históricos en Memoria RAG ({casosRAG.length})
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    ✓ Solo Cotizaciones Finalizadas (Excluye Borradores)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                  {casosRAG.map((caso) => (
                    <div
                      key={caso.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 hover:border-indigo-300 transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 truncate">
                          {caso.empresaCliente}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                          {caso.codigoCotizacion}
                        </span>
                      </div>
                      <div className="text-[11px] text-indigo-900 font-medium truncate">
                        {caso.nombreObra}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-200">
                        <span>{caso.ensayosCotizados?.length || 0} ensayos indexados</span>
                        <span className="font-bold text-slate-700">{caso.totalUf?.toFixed(1) || '0.0'} UF</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Inline para Crear Nueva Regla de Aprendizaje */}
        {showNuevaReglaModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-indigo-600" />
                  <span>Crear Regla de Aprendizaje Manual</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNuevaReglaModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCrearRegla} className="space-y-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Término, Alias o Modismo del Usuario:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. triaxial gigante 15x30, corte rápido..."
                    value={nuevoTermino}
                    onChange={(e) => setNuevoTermino(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Cómo lo escribirán los usuarios en el buscador o chat.
                  </span>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Código de Ensayo Oficial DGL:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 106, 001, 042..."
                    value={nuevoCodigo}
                    onChange={(e) => setNuevoCodigo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Código correspondiente en el tarifario oficial de 358 ensayos.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNuevaReglaModal(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoRegla}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {guardandoRegla ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Guardar Regla</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
