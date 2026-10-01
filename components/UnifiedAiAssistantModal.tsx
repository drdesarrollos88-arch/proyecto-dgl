'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  Trash2,
  CheckCircle2,
  PlusCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  FileText,
  Upload,
  AlertTriangle,
  Mail,
  Copy,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  FileUp,
  Key,
  ShieldCheck,
  BookOpen,
  Database,
  Brain,
  Search,
  Paperclip,
  ExternalLink,
  Maximize2,
  Eye,
  Minus,
  Plus,
  Filter,
  MessageSquare,
  History,
  BookmarkCheck,
} from 'lucide-react';

export interface DisplayChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  acciones?: AiChatAction[];
  analisis?: AiAnalisisResponse;
  archivoAdjunto?: { nombre: string; tamanoKb: number };
  timestamp: string;
}

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
    cotizacionCode?: string;
  };
  initialChatMessages?: DisplayChatMessage[] | null;
  initialActiveAnalisis?: AiAnalisisResponse | null;
  onChatStateChange?: (messages: DisplayChatMessage[], activeAnalisis: AiAnalisisResponse | null) => void;
}

const CHAT_SUGGESTIONS = [
  'Agrega 3 Clasificaciones USCS completas y 3 Consolidaciones',
  'Cambia el corte directo a 5 muestras',
  'Elimina los ensayos de cono de arena',
  'Aplica un 10% de descuento a todos los ensayos',
  '¿Qué normativa aplica para fundación en roca según NCh1508?',
];

const ANALISIS_EJEMPLOS = [
  {
    titulo: 'Licitación ESVAL (Cantera Melipilla)',
    texto: `Estimado Francisco, para licitación con ESVAL, solicito pueda cotizar la toma de muestra y caracterización y ensayo de roca de 5 a 6 ton.
La roca se extraerá desde cantera la Virgen, en Melipilla https://maps.app.goo.gl/FnGoyTiqovJwUojJ8
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
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      pillBg: 'bg-emerald-600 text-white',
      iconText: '📊',
    };
  }
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return {
      label: 'Word',
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      pillBg: 'bg-blue-600 text-white',
      iconText: '📝',
    };
  }
  if (lower.endsWith('.pdf')) {
    return {
      label: 'PDF',
      bg: 'bg-red-50 text-red-700 border-red-200',
      pillBg: 'bg-red-600 text-white',
      iconText: '📄',
    };
  }
  return {
    label: 'Texto',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
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
  initialChatMessages,
  initialActiveAnalisis,
  onChatStateChange,
}: UnifiedAiAssistantModalProps) {
  // Pestaña principal: 'workbench' | 'memoria'
  const [activeTab, setActiveTab] = useState<'workbench' | 'memoria'>(
    initialTab === 'memoria' ? 'memoria' : 'workbench'
  );

  // Estados de archivo y texto
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [lastAnalyzedFile, setLastAnalyzedFile] = useState<File | null>(null);
  const [lastAnalyzedText, setLastAnalyzedText] = useState<string>('');
  const [pastedText, setPastedText] = useState('');
  const [rawFileText, setRawFileText] = useState<string | null>(null);
  const [leftViewMode, setLeftViewMode] = useState<'viewer' | 'paste'>('viewer');

  // Modales adicionales: Vista preliminar (no ocupa espacio permanente) y Pegar texto
  const [showDocPreview, setShowDocPreview] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);

  // URL del objeto PDF para vista preliminar nativa
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Detector inteligente de intención de re-análisis
  const isDocumentRecheckRequest = (msg: string): boolean => {
    const lower = msg.toLowerCase();
    const keywords = [
      'revisa', 'revisar', 'revises', 'revisalo', 'revisame', 'revisen',
      'página', 'pagina', 'paginas', 'páginas', 'hoja', 'hojas',
      'anexo', 'anexos', 'incompleto', 'incompletos', 'incompleta',
      'falta', 'faltan', 'faltante', 'faltantes', 'más ensayo', 'mas ensayo',
      'más ensayos', 'mas ensayos', 'solicitan más', 'piden más',
      'vuelve a', 'volver a', 'exhaustiv', 'busca más', 'buscar más',
      'documento completo', 'todo el documento', 'todo el archivo',
      'todas las páginas', 'todas las paginas', 'chequea', 'escanea'
    ];
    return keywords.some((kw) => lower.includes(kw));
  };

  // Crear y limpiar ObjectURL cuando cambia el archivo actual
  useEffect(() => {
    const current = attachedFile || lastAnalyzedFile;
    if (current && (current.type === 'application/pdf' || current.name.toLowerCase().endsWith('.pdf'))) {
      const url = URL.createObjectURL(current);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setPreviewUrl(null);
    }
  }, [attachedFile, lastAnalyzedFile]);

  // Extraer texto crudo si es archivo TXT
  useEffect(() => {
    const current = attachedFile || lastAnalyzedFile;
    if (current && (current.name.toLowerCase().endsWith('.txt') || current.type.startsWith('text/'))) {
      current.text().then((txt) => setRawFileText(txt)).catch(() => setRawFileText(null));
    } else {
      setRawFileText(null);
    }
  }, [attachedFile, lastAnalyzedFile]);

  // Sincronizar initialTab
  useEffect(() => {
    if (isOpen) {
      if (initialTab === 'memoria') {
        setActiveTab('memoria');
      } else {
        setActiveTab('workbench');
      }
    }
  }, [isOpen, initialTab]);

  // API Key personalizada / institucional
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

  // Modal de confirmación para Reiniciar (Guardar en Histórica / Solo Reiniciar / Cancelar)
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [isArchivingHistory, setIsArchivingHistory] = useState(false);
  const [archiveSuccessToast, setArchiveSuccessToast] = useState(false);

  const defaultWelcomeMessage: DisplayChatMessage = {
    id: 'welcome',
    role: 'assistant',
    content:
      '¡Hola! Soy tu **Asistente Técnico-Comercial DGL IDIEM impulsado por Gemini**.\n\nPuedes ver el documento preliminar en el panel izquierdo y la propuesta de ensayos en el panel derecho. Indícame cualquier instrucción técnica en este chat (ej. *"agrega 3 proctor"*, *"revisa la pág 4"*, *"aplica 10% de descuento"* o consultas sobre NCh1508) y ajustaré la campaña en tiempo real.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };

  // ==========================================
  // ESTADOS DEL WORKBENCH (CHAT, ANÁLISIS & ENSAYOS)
  // ==========================================
  const [chatMessages, setChatMessages] = useState<DisplayChatMessage[]>(() => {
    if (initialChatMessages && Array.isArray(initialChatMessages) && initialChatMessages.length > 0) {
      return initialChatMessages;
    }
    return [defaultWelcomeMessage];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [analisisLoading, setAnalisisLoading] = useState(false);
  const [analisisStep, setAnalisisStep] = useState(0);
  const [analisisError, setAnalisisError] = useState<string | null>(null);

  // Campaña y propuesta técnica activa
  const [activeAnalisis, setActiveAnalisis] = useState<AiAnalisisResponse | null>(() => initialActiveAnalisis || null);
  const [ensayosSeleccionados, setEnsayosSeleccionados] = useState<AiEnsayoSugerido[]>(() => initialActiveAnalisis?.ensayos_sugeridos || []);

  const onChatStateChangeRef = useRef(onChatStateChange);
  useEffect(() => {
    onChatStateChangeRef.current = onChatStateChange;
  }, [onChatStateChange]);

  // Sincronizar mensajes cuando cambian desde cotización (e.g. cargar borrador o nueva cotización)
  const lastInitialMessagesRef = useRef<DisplayChatMessage[] | null | undefined>(undefined);
  useEffect(() => {
    if (initialChatMessages !== undefined && initialChatMessages !== lastInitialMessagesRef.current) {
      lastInitialMessagesRef.current = initialChatMessages;
      if (initialChatMessages && Array.isArray(initialChatMessages) && initialChatMessages.length > 0) {
        setChatMessages(initialChatMessages);
      } else if (initialChatMessages === null) {
        setChatMessages([defaultWelcomeMessage]);
      }
    }
  }, [initialChatMessages]);

  const lastInitialAnalisisRef = useRef<AiAnalisisResponse | null | undefined>(undefined);
  useEffect(() => {
    if (initialActiveAnalisis !== undefined && initialActiveAnalisis !== lastInitialAnalisisRef.current) {
      lastInitialAnalisisRef.current = initialActiveAnalisis;
      setActiveAnalisis(initialActiveAnalisis);
      if (initialActiveAnalisis?.ensayos_sugeridos) {
        setEnsayosSeleccionados(initialActiveAnalisis.ensayos_sugeridos);
      }
    }
  }, [initialActiveAnalisis]);

  // Notificar al componente padre sobre cambios en la conversación para persistencia de borrador
  const isFirstSyncRef = useRef(true);
  useEffect(() => {
    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false;
      return;
    }
    if (onChatStateChangeRef.current) {
      onChatStateChangeRef.current(chatMessages, activeAnalisis);
    }
  }, [chatMessages, activeAnalisis]);
  const [campanaCargada, setCampanaCargada] = useState(false);
  const [activeRightSubTab, setActiveRightSubTab] = useState<'ensayos' | 'consultas' | 'alertas'>('ensayos');
  const [searchEnsayoQuery, setSearchEnsayoQuery] = useState('');
  const [expandedJustifications, setExpandedJustifications] = useState<Record<number, boolean>>({});
  const [copiedMail, setCopiedMail] = useState(false);

  // Referencias DOM
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rotador de pasos de carga
  useEffect(() => {
    if (!analisisLoading) return;
    const interval = setInterval(() => {
      setAnalisisStep((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2600);
    return () => clearInterval(interval);
  }, [analisisLoading]);

  // Auto-scroll del chat
  useEffect(() => {
    if (isOpen && activeTab === 'workbench') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, activeTab, chatMessages, analisisLoading, chatLoading]);

  // Manejo de drag and drop
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
        setLeftViewMode('viewer');
      } else {
        setAnalisisError('Formatos admitidos: PDF (.pdf), Word (.docx, .doc), Excel (.xlsx, .xls) o Texto (.txt).');
      }
    }
  };

  // ========================================================
  // ACCIÓN 1: ANALIZAR DOCUMENTO O TEXTO
  // ========================================================
  const handleAnalyze = async (overrideText?: string, overrideFile?: File | null) => {
    const textToAnalyze = (overrideText !== undefined ? overrideText : pastedText || chatInput).trim();
    const fileToAnalyze = overrideFile !== undefined ? overrideFile : (attachedFile || lastAnalyzedFile);

    if (!textToAnalyze && !fileToAnalyze) {
      setAnalisisError('Por favor sube un archivo o escribe/pega el requerimiento para analizar.');
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

    const fileBadge = fileToAnalyze ? getFileBadgeInfo(fileToAnalyze.name) : null;
    const isReanalysis = Boolean(overrideFile || (activeAnalisis && fileToAnalyze));

    const userMsgContent = fileToAnalyze
      ? `${fileBadge?.iconText || '📄'} **${isReanalysis ? 'Revisión técnica' : 'Análisis de documento'} [${fileBadge?.label}]:** ${fileToAnalyze.name} (${(
          fileToAnalyze.size / 1024
        ).toFixed(1)} KB)${textToAnalyze ? `\n\n*Instrucción:* ${textToAnalyze}` : ''}`
      : `📋 **Solicitud técnica:**\n\n${textToAnalyze}`;

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
    setChatInput('');

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
            ? `El servidor de IA respondió con un error (código ${res.status}).`
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

      // Combinar con personalizaciones previas
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

      const assistantMsg: DisplayChatMessage = {
        id: `asst-analisis-${Date.now()}`,
        role: 'assistant',
        content: isReanalysis
          ? `🔍 **Revisión completada para "${parsedAnalisis.datos_proyecto_detectados.nombre_obra || 'el proyecto'}":**\n\nHe examinado el documento atendiendo a tus indicaciones. La campaña cuenta ahora con **${
              parsedAnalisis.ensayos_sugeridos?.length || 0
            } ensayos oficiales DGL** listados en el panel derecho. Puedes ajustar cantidades o seguir modificando la propuesta aquí en el chat.`
          : `He analizado la solicitud técnica para el proyecto **"${
              parsedAnalisis.datos_proyecto_detectados.nombre_obra || 'Sin nombre'
            }"** (${parsedAnalisis.datos_proyecto_detectados.empresa_cliente || 'Cliente particular'}).\n\nPropuse **${
              itemsSugeridos.length
            } ensayos oficiales DGL** conforme al tarifario IDIEM y la normativa aplicable (${
              parsedAnalisis.normativa_aplicable?.slice(0, 3).join(', ') || 'NCh1508'
            }). Revisa la lista a la derecha o dame cualquier instrucción para ajustarla.`,
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
          content: `⚠️ Ocurrió un problema al analizar la solicitud: ${errorText}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setAnalisisLoading(false);
    }
  };

  // ========================================================
  // ACCIÓN 2: CHAT CONVERSACIONAL E INTERACCIÓN BIDIRECCIONAL
  // ========================================================
  const handleSendChatMessage = async (textToSend?: string) => {
    // Si hay un archivo adjunto pendiente, procesar como análisis
    if (attachedFile && !lastAnalyzedFile) {
      handleAnalyze(textToSend || chatInput, attachedFile);
      return;
    }

    const text = (textToSend || chatInput).trim();
    if (!text || chatLoading || analisisLoading) return;

    // Si el usuario pide re-examinar páginas específicas del documento en memoria:
    if (lastAnalyzedFile && isDocumentRecheckRequest(text)) {
      handleAnalyze(text, lastAnalyzedFile);
      return;
    }

    // Si hay texto extenso de licitación en memoria y el usuario pide re-examinar:
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
        content: data.mensaje || 'He procesado tu instrucción.',
        acciones: data.acciones,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, assistantMsg]);

      // Aplicar las acciones en tiempo real sobre los ensayos seleccionados
      if (Array.isArray(data.acciones) && data.acciones.length > 0) {
        if (currentItems.length > 0 || campanaCargada) {
          onApplyActions(data.acciones, data.itemsAgregadosCompletos || []);
        }

        // Sincronizar en tiempo real el listado del panel derecho
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
                    justificacion_tecnica: act.descripcion || 'Agregado mediante interacción IA',
                    seleccionado: true,
                  });
                }
              }
            }
          }
          return updated;
        });

        // Feedback de aprendizaje
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
          content: `⚠️ Inconveniente al procesar la instrucción: ${errorText}.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleRequestClearChat = () => {
    // Si hay interacción real del usuario, consultar si desea guardarlo en la Bibliografía Histórica
    const hasUserMessages = chatMessages.some((m) => m.role === 'user');
    if (hasUserMessages) {
      setShowResetConfirmModal(true);
    } else {
      executeResetChat(false);
    }
  };

  const executeResetChat = async (saveToHistory: boolean) => {
    if (saveToHistory) {
      setIsArchivingHistory(true);
      try {
        const transcript = chatMessages
          .map((m) => `[${m.role === 'user' ? 'EJECUTIVO COMERCIAL' : 'ASISTENTE IA'}] (${m.timestamp}):\n${m.content}`)
          .join('\n\n');

        const activeEnsayosSummary =
          ensayosSeleccionados.length > 0
            ? `\n\nBATERÍA DE ENSAYOS REVISADA:\n` +
              ensayosSeleccionados.map((e) => `- [Cód ${e.codigo}] ${e.designacion} (cant: ${e.cantidad_estimada})`).join('\n')
            : '';

        await fetch('/api/bibliografia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'historica',
            titulo: `Chat Asistente - ${contexto.projectName || contexto.clientName || 'Consulta Técnica'} (${new Date().toLocaleDateString('es-CL')})`,
            descripcion: `Interacción guardada al reiniciar el asistente. Consultas: ${chatMessages
              .filter((m) => m.role === 'user')
              .map((m) => m.content)
              .slice(0, 3)
              .join('; ')
              .slice(0, 200)}`,
            contenidoTexto: transcript + activeEnsayosSummary,
            tipoArchivo: 'chat',
            tags: ['Chat Asistente', 'Histórica', ...(contexto.centroCosto ? [contexto.centroCosto.slice(0, 4)] : [])],
            metadatos: {
              cliente: contexto.clientName,
              proyecto: contexto.projectName,
              centroCosto: contexto.centroCosto,
              codigoCotizacion: contexto.cotizacionCode,
            },
          }),
        });

        setArchiveSuccessToast(true);
        setTimeout(() => setArchiveSuccessToast(false), 3000);
      } catch (err) {
        console.error('Error guardando en bibliografía histórica:', err);
      } finally {
        setIsArchivingHistory(false);
      }
    }

    setChatMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content:
          'Mesa de trabajo reiniciada. Puedes subir un nuevo documento o formular una consulta técnica en el chat.',
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
    setRawFileText(null);
    setShowResetConfirmModal(false);
  };

  // Manejo de la tabla interactiva de ensayos
  const moveEnsayo = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= ensayosSeleccionados.length || fromIndex === toIndex) return;
    setEnsayosSeleccionados((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

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
    const activos = ensayosSeleccionados.filter((e) => e.seleccionado);
    if (activos.length === 0) {
      alert('Debes seleccionar al menos un ensayo para cargar a la cotización principal.');
      return;
    }

    onApplyCampaign({
      datosProyecto: activeAnalisis?.datos_proyecto_detectados,
      ensayos: activos,
      centroCosto: activeAnalisis?.datos_proyecto_detectados.centro_costo_sugerido || '1817',
      observacionesComerciales: activeAnalisis?.observaciones_comerciales,
    });

    setCampanaCargada(true);

    setChatMessages((prev) => [
      ...prev,
      {
        id: `sys-cargado-${Date.now()}`,
        role: 'assistant',
        content: `✅ **¡${activos.length} ensayos cargados exitosamente en la Cotización Principal!**\nSubtotal estimado: **${totalSeleccionadoUf.toFixed(
          2
        )} UF**.\n\nPuedes seguir interactuando conmigo para hacer modificaciones o cerrar la ventana cuando gustes.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Cálculo del total seleccionado
  const totalSeleccionadoUf = useMemo(() => {
    return ensayosSeleccionados
      .filter((e) => e.seleccionado)
      .reduce((acc, curr) => acc + curr.precio_uf * curr.cantidad_estimada, 0);
  }, [ensayosSeleccionados]);

  // Filtrado de ensayos en el panel lateral derecho
  const ensayosFiltrados = useMemo(() => {
    if (!searchEnsayoQuery.trim()) return ensayosSeleccionados;
    const q = searchEnsayoQuery.toLowerCase();
    return ensayosSeleccionados.filter(
      (e) =>
        e.codigo.toLowerCase().includes(q) ||
        e.designacion.toLowerCase().includes(q) ||
        (e.norma && e.norma.toLowerCase().includes(q))
    );
  }, [ensayosSeleccionados, searchEnsayoQuery]);

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

  const currentFile = attachedFile || lastAnalyzedFile;
  const currentBadge = currentFile ? getFileBadgeInfo(currentFile.name) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-hidden animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-[98vw] h-[96vh] max-h-[96vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* ======================================================== */}
        {/* HEADER CLARO, ELEGANTE & PROFESIONAL */}
        {/* ======================================================== */}
        <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-700 flex items-center justify-center text-white shadow-xs shrink-0">
              <Bot className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-wide">
                  Mesa de Trabajo Asistente IA DGL
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Gemini 3 Flash
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  358 Ensayos IDIEM
                </span>
              </div>
            </div>
          </div>

          {/* Navegación entre Mesa de Trabajo y Memoria */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('workbench')}
                className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'workbench'
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Mesa de Trabajo</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('memoria')}
                className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'memoria'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-indigo-400" />
                <span>Memoria RAG</span>
              </button>
            </div>

            <button
              onClick={() => setShowKeyInput(!showKeyInput)}
              title="Ajuste de API Key Gemini"
              className="text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 p-1.5 rounded-lg border border-slate-200 transition cursor-pointer"
            >
              <Key className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              title="Cerrar Mesa de Trabajo (Esc)"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de Ajuste de API Key (Opcional) */}
        {showKeyInput && (
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold text-emerald-700">Estado de Llave Gemini:</span>
              <span className="text-[11px] text-slate-500">
                Conectado con clave oficial del servidor. Puedes ingresar una API Key personalizada:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={customApiKey}
                onChange={(e) => handleSaveKey(e.target.value)}
                placeholder="API Key Personalizada"
                className="w-56 px-2.5 py-1 bg-white border border-slate-300 rounded text-slate-800 font-mono text-xs focus:ring-1 focus:ring-red-600 focus:outline-none"
              />
              {customApiKey && (
                <button
                  type="button"
                  onClick={() => handleSaveKey('')}
                  className="text-[10px] text-red-600 hover:underline cursor-pointer"
                >
                  Restaurar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Input file invisible para selector de archivos */}
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

        {/* ======================================================== */}
        {/* CUERPO DEL MODAL (WORKBENCH DE 2 COLUMNAS O MEMORIA) */}
        {/* ======================================================== */}
        {activeTab === 'workbench' ? (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
            
            {/* ==================================================== */}
            {/* MITAD IZQUIERDA (50%): DIÁLOGO CON ASISTENTE + BOTÓN DE CARGA ABAJO */}
            {/* ==================================================== */}
            <div className="w-full lg:w-1/2 flex flex-col bg-white border-b lg:border-b-0 lg:border-r border-slate-200 overflow-hidden min-h-0">
              
              {/* Header de la consola de chat */}
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 text-xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-red-700" />
                  <span className="font-bold text-slate-800 text-xs">
                    Diálogo con el Asistente Técnico IA
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">
                    • Instrucciones, modificaciones y normativa
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En línea
                  </span>
                  <button
                    type="button"
                    onClick={handleRequestClearChat}
                    title="Reiniciar conversación"
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition cursor-pointer flex items-center gap-1 text-[11px]"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span className="hidden sm:inline">Reiniciar</span>
                  </button>
                </div>
              </div>

              {/* Feed de Mensajes */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/40 text-xs">
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-red-700 text-white rounded-br-xs shadow-xs'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs shadow-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{m.content}</div>

                      {/* Acciones aplicadas por la IA */}
                      {m.acciones && m.acciones.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {m.acciones.length} cambio(s) aplicados en tiempo real:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {m.acciones.map((act, i) => (
                              <span
                                key={i}
                                className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono"
                              >
                                {act.tipo === 'AGREGAR' && `+ ${act.cantidad || 1}x Cód. ${act.codigo}`}
                                {act.tipo === 'MODIFICAR_CANTIDAD' && `✎ Cód. ${act.codigo} a ${act.cantidad}`}
                                {act.tipo === 'ELIMINAR' && `✕ Cód. ${act.codigo} eliminado`}
                                {act.tipo === 'APLICAR_FACTOR' && `% Factor ${act.factor}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">{m.timestamp}</span>
                  </div>
                ))}

                {/* Indicador de carga de análisis */}
                {analisisLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs space-y-1 max-w-md">
                      <div className="flex items-center gap-2 text-red-700 font-bold">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Analizando requerimiento geotécnico...</span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-5">
                        {LOADING_STEPS[analisisStep]}
                      </p>
                    </div>
                  </div>
                )}

                {/* Indicador de carga de chat */}
                {chatLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-800 flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
                      <span>Consultando catálogo oficial DGL y ejecutando instrucción...</span>
                    </div>
                  </div>
                )}

                {/* Mensaje de error si ocurre */}
                {analisisError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{analisisError}</span>
                  </div>
                )}

                <div ref={chatMessagesEndRef} />
              </div>

              {/* Sugerencias Rápidas */}
              <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
                  Rápidas:
                </span>
                {lastAnalyzedFile && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage('Revisa porque en la página 4 y 5 solicitan más ensayos')}
                      disabled={chatLoading || analisisLoading}
                      className="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold rounded px-2 py-0.5 transition cursor-pointer whitespace-nowrap"
                    >
                      ⚡ Revisar pág. 4 y 5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendChatMessage('Revisa exhaustivamente todo el documento sin omitir ningún ensayo')}
                      disabled={chatLoading || analisisLoading}
                      className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold rounded px-2 py-0.5 transition cursor-pointer whitespace-nowrap"
                    >
                      ⚡ Escanear todo el documento
                    </button>
                  </>
                )}
                {CHAT_SUGGESTIONS.map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendChatMessage(sug)}
                    disabled={chatLoading || analisisLoading}
                    className="text-[10px] bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded px-2 py-0.5 transition cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    {sug}
                  </button>
                ))}
              </div>

              {/* PARTE INFERIOR: DOCUMENTO ADJUNTO + LINK PARA SUBIR DOCUMENTO + INPUT DE CHAT */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0 space-y-2">
                
                {/* Chip compacto si hay archivo cargado */}
                {currentFile && (
                  <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs shadow-2xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${currentBadge?.bg}`}>
                        {currentBadge?.label}
                      </span>
                      <span className="font-medium text-slate-800 truncate" title={currentFile.name}>
                        {currentFile.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({(currentFile.size / 1024).toFixed(0)} KB)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Botón para abrir vista preliminar (Req 2) */}
                      <button
                        type="button"
                        onClick={() => setShowDocPreview(true)}
                        className="px-2 py-0.5 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition flex items-center gap-1 cursor-pointer"
                        title="Abrir vista preliminar del documento"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Ver documento</span>
                      </button>

                      {/* Si el archivo aún no ha sido analizado */}
                      {attachedFile && !lastAnalyzedFile && (
                        <button
                          type="button"
                          disabled={analisisLoading}
                          onClick={() => handleAnalyze()}
                          className="px-2 py-0.5 text-[11px] font-bold text-white bg-red-700 hover:bg-red-800 rounded-md transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="Analizar requerimiento técnico con IA"
                        >
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Analizar</span>
                        </button>
                      )}

                      {/* Quitar archivo */}
                      <button
                        type="button"
                        onClick={() => {
                          setAttachedFile(null);
                          setLastAnalyzedFile(null);
                          setPreviewUrl(null);
                          setRawFileText(null);
                          setShowDocPreview(false);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                        title="Quitar archivo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Link para abrir explorador en lugar de arrastrar + Opción de pegar texto (Req 3) */}
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="font-semibold text-red-700 hover:text-red-800 hover:underline flex items-center gap-1.5 cursor-pointer text-xs"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>{currentFile ? 'Cambiar documento (PDF, Word, Excel, TXT)' : 'Cargar documento desde el explorador'}</span>
                    </button>

                    <span className="text-slate-300">|</span>

                    <button
                      type="button"
                      onClick={() => setShowPasteModal(true)}
                      className="font-medium text-slate-600 hover:text-slate-900 hover:underline flex items-center gap-1 cursor-pointer text-xs"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pegar texto</span>
                    </button>
                  </div>

                  {pastedText && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Texto listo
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowDocPreview(true)}
                        className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                      >
                        (ver)
                      </button>
                    </div>
                  )}
                </div>

                {/* Formulario de Chat */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (attachedFile && !lastAnalyzedFile) {
                      handleAnalyze();
                    } else {
                      handleSendChatMessage();
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading || analisisLoading}
                    placeholder="Escribe una instrucción para Gemini (ej. 'agrega 3 proctor', 'aplica 10% dcto')..."
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 disabled:opacity-50"
                  />

                  <button
                    type="submit"
                    disabled={(!chatInput.trim() && !attachedFile) || chatLoading || analisisLoading}
                    className="px-4 py-2 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                  >
                    {chatLoading || analisisLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Enviar</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* ==================================================== */}
            {/* MITAD DERECHA (50%): ITEMIZADO CARGADO POR IA (MINIMALISTA, LINEAL, SIN ACREDITACIONES) */}
            {/* ==================================================== */}
            <div className="w-full lg:w-1/2 flex flex-col bg-slate-50/50 overflow-hidden min-h-0">
              
              {/* Header del Itemizado */}
              <div className="px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Propuesta de Ensayos IA
                      </span>
                      {activeAnalisis?.datos_proyecto_detectados.centro_costo_sugerido && (
                        <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold">
                          CC {activeAnalisis.datos_proyecto_detectados.centro_costo_sugerido}
                        </span>
                      )}
                    </div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-sm">
                      {activeAnalisis?.datos_proyecto_detectados.nombre_obra ||
                        contexto.projectName ||
                        'Presupuesto en Elaboración'}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider block">Total Estimado</span>
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 font-mono">
                        {totalSeleccionadoUf.toFixed(2)} UF
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs: Ensayos / Consultas / Normas */}
                <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setActiveRightSubTab('ensayos')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      activeRightSubTab === 'ensayos'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Ensayos ({ensayosSeleccionados.filter((e) => e.seleccionado).length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightSubTab('consultas')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      activeRightSubTab === 'consultas'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>Consultas ({activeAnalisis?.preguntas_para_el_cliente?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveRightSubTab('alertas')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      activeRightSubTab === 'alertas'
                        ? 'bg-red-700 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Normas & Alertas</span>
                  </button>
                </div>
              </div>

              {/* Sub-tab Ensayos: Minimalista, Lineal y Rápido de Visualizar (Req 4) */}
              {activeRightSubTab === 'ensayos' && (
                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  
                  {/* Filtro y selecciones masivas */}
                  <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Filtrar ensayos por código o nombre..."
                        value={searchEnsayoQuery}
                        onChange={(e) => setSearchEnsayoQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-red-600"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] shrink-0 font-medium">
                      <button
                        type="button"
                        onClick={() =>
                          setEnsayosSeleccionados((prev) =>
                            prev.map((e) => ({ ...e, seleccionado: true }))
                          )
                        }
                        className="text-red-700 hover:underline cursor-pointer"
                      >
                        Todos
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={() =>
                          setEnsayosSeleccionados((prev) =>
                            prev.map((e) => ({ ...e, seleccionado: false }))
                          )
                        }
                        className="text-slate-500 hover:underline cursor-pointer"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>

                  {/* Encabezado de columnas lineal */}
                  <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2.5 shrink-0">
                    <div className="w-4 shrink-0" />
                    <div className="w-14 shrink-0">Código</div>
                    <div className="flex-1 min-w-0">Ensayo</div>
                    <div className="w-24 text-center shrink-0">Cantidad</div>
                    <div className="w-16 text-right shrink-0">Unitario</div>
                    <div className="w-20 text-right shrink-0">Subtotal</div>
                    <div className="w-8 shrink-0" />
                  </div>

                  {/* LISTA LINEAL MINIMALISTA */}
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {ensayosFiltrados.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400">
                        {ensayosSeleccionados.length === 0
                          ? 'Aún no hay ensayos cargados. Puedes cargar un documento o pedirle a Gemini en el chat que agregue ensayos.'
                          : 'No se encontraron ensayos con el criterio de búsqueda.'}
                      </div>
                    ) : (
                      ensayosFiltrados.map((ensayo, idx) => {
                        const realIdx = ensayosSeleccionados.findIndex((e) => e.codigo === ensayo.codigo);
                        return (
                          <div
                            key={ensayo.codigo + '-' + idx}
                            className={`px-3 py-2 transition-colors flex items-center gap-2.5 ${
                              ensayo.seleccionado
                                ? 'bg-white hover:bg-slate-50/80'
                                : 'bg-slate-50/50 opacity-40 hover:opacity-75'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className="flex items-center gap-1 shrink-0">
                              <input
                                type="checkbox"
                                checked={ensayo.seleccionado}
                                onChange={() => toggleEnsayo(realIdx >= 0 ? realIdx : idx)}
                                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                            </div>

                            {/* Código */}
                            <span className="w-14 font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-200 text-center shrink-0">
                              {ensayo.codigo}
                            </span>

                            {/* Ensayo (Nombre limpio, lineal, sin acreditaciones) */}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-900 truncate" title={ensayo.designacion}>
                                {ensayo.designacion}
                              </p>
                            </div>

                            {/* Cantidad Stepper */}
                            <div className="w-24 flex items-center justify-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={!ensayo.seleccionado || ensayo.cantidad_estimada <= 1}
                                onClick={() =>
                                  updateCantidadEnsayo(
                                    realIdx >= 0 ? realIdx : idx,
                                    ensayo.cantidad_estimada - 1
                                  )
                                }
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 flex items-center justify-center cursor-pointer text-xs"
                              >
                                <Minus className="w-2.5 h-2.5" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                value={ensayo.cantidad_estimada}
                                onChange={(e) =>
                                  updateCantidadEnsayo(
                                    realIdx >= 0 ? realIdx : idx,
                                    parseInt(e.target.value) || 1
                                  )
                                }
                                disabled={!ensayo.seleccionado}
                                className="w-9 px-0.5 py-0.5 bg-white border border-slate-200 rounded text-center text-xs font-bold text-slate-900 disabled:bg-slate-50"
                              />
                              <button
                                type="button"
                                disabled={!ensayo.seleccionado}
                                onClick={() =>
                                  updateCantidadEnsayo(
                                    realIdx >= 0 ? realIdx : idx,
                                    ensayo.cantidad_estimada + 1
                                  )
                                }
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-30 text-slate-700 flex items-center justify-center cursor-pointer text-xs"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>

                            {/* Precio Unitario */}
                            <div className="w-16 text-right shrink-0">
                              <span className="font-mono text-xs text-slate-500">
                                {ensayo.precio_uf.toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-0.5">UF</span>
                            </div>

                            {/* Subtotal */}
                            <div className="w-20 text-right shrink-0">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {(ensayo.precio_uf * ensayo.cantidad_estimada).toFixed(2)}
                              </span>
                              <span className="text-[10px] text-slate-400 ml-0.5">UF</span>
                            </div>

                            {/* Reordenar */}
                            <div className="w-8 flex items-center justify-end gap-0.5 shrink-0">
                              <button
                                type="button"
                                disabled={realIdx <= 0}
                                onClick={() => moveEnsayo(realIdx, realIdx - 1)}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-10 cursor-pointer"
                                title="Mover arriba"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={realIdx >= ensayosSeleccionados.length - 1}
                                onClick={() => moveEnsayo(realIdx, realIdx + 1)}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-10 cursor-pointer"
                                title="Mover abajo"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Sub-tab Consultas al Cliente */}
              {activeRightSubTab === 'consultas' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-white">
                  {activeAnalisis?.preguntas_para_el_cliente &&
                  activeAnalisis.preguntas_para_el_cliente.length > 0 ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800">
                        <HelpCircle className="w-4 h-4" />
                        <span>Puntos a aclarar con el mandante:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-slate-700 pl-1">
                        {activeAnalisis.preguntas_para_el_cliente.map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                      No se han detectado consultas técnicas pendientes.
                    </div>
                  )}

                  {activeAnalisis?.borrador_correo_aclaratorio && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-red-700" />
                          Borrador de Correo Formal:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyEmail(activeAnalisis?.borrador_correo_aclaratorio)}
                          className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          {copiedMail ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-300" />
                              <span>¡Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar Correo</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-all max-h-56 overflow-y-auto">
                        {activeAnalisis.borrador_correo_aclaratorio}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab Normas & Alertas */}
              {activeRightSubTab === 'alertas' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs bg-white">
                  {activeAnalisis?.normativa_aplicable && activeAnalisis.normativa_aplicable.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <strong className="block text-slate-900 font-bold mb-1.5 text-xs">
                        Normativa Aplicable Identificada:
                      </strong>
                      <div className="flex flex-wrap gap-1.5">
                        {activeAnalisis.normativa_aplicable.map((norm, i) => (
                          <span
                            key={i}
                            className="bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono shadow-2xs"
                          >
                            {norm}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeAnalisis?.ensayos_no_disponibles_o_especiales &&
                    activeAnalisis.ensayos_no_disponibles_o_especiales.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="font-bold text-red-700 block text-xs">
                          Ensayos especiales o no tabulados detectados:
                        </span>
                        {activeAnalisis.ensayos_no_disponibles_o_especiales.map((esp, idx) => (
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

                  {activeAnalisis?.observaciones_comerciales && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <strong className="block text-slate-900 font-bold mb-1 text-xs">
                        Observaciones Comerciales IDIEM:
                      </strong>
                      <p className="text-slate-700 leading-relaxed text-xs">
                        {activeAnalisis.observaciones_comerciales}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* BARRA INFERIOR DE ACCIÓN: TOTAL Y BOTÓN DE CARGA */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="font-bold text-slate-900">
                    {ensayosSeleccionados.filter((e) => e.seleccionado).length} ensayos
                  </span>{' '}
                  <span className="text-slate-500">seleccionados por</span>{' '}
                  <span className="font-extrabold text-red-700 font-mono text-sm">
                    {totalSeleccionadoUf.toFixed(2)} UF
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleApplyCampaignClick}
                  disabled={ensayosSeleccionados.filter((e) => e.seleccionado).length === 0}
                  className={`px-5 py-2.5 text-xs sm:text-sm font-extrabold text-white rounded-xl transition shadow-md flex items-center gap-2 cursor-pointer ${
                    campanaCargada
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-red-700 hover:bg-red-800'
                  } disabled:opacity-40`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {campanaCargada
                      ? `✓ Campaña Cargada (${totalSeleccionadoUf.toFixed(2)} UF)`
                      : `Cargar en Cotización Principal (${totalSeleccionadoUf.toFixed(2)} UF)`}
                  </span>
                </button>
              </div>
            </div>

          </div>
        ) : (
          /* ====================================================== */
          /* PESTAÑA: MEMORIA & APRENDIZAJE IA (TEMA CLARO) */
          /* ====================================================== */
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-slate-50">
            {/* Encabezado de Memoria */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 border border-slate-700 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
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
                  <span className="text-[10px] text-slate-300 block">Reglas de Vocabulario</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {reglasAprendidas.length}
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    {reglasAprendidas.filter((r) => r.estado === 'activo').length} activas
                  </span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] text-slate-300 block">Casos Históricos RAG</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {casosRAG.length}
                  </span>
                  <span className="text-[10px] text-indigo-300">Base IDIEM + Finalizadas</span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] text-slate-300 block">Confirmaciones de Usuario</span>
                  <span className="text-lg font-bold text-white mt-0.5 block">
                    {reglasAprendidas.reduce((acc, r) => acc + (r.conteoConfirmaciones || 0), 0)}
                  </span>
                  <span className="text-[10px] text-amber-300">Feedback Loop Opción B</span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <span className="text-[10px] text-slate-300 block">Política de Privacidad</span>
                  <span className="text-xs font-bold text-emerald-300 mt-1 block">
                    100% Cero Retraining
                  </span>
                  <span className="text-[10px] text-slate-300">En memoria / In-context</span>
                </div>
              </div>
            </div>

            {/* Diccionario de Reglas Aprendidas */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
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
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {loadingMemoria ? (
                <div className="py-10 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Cargando memoria del sistema...</span>
                </div>
              ) : reglasFiltradas.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 bg-white">
                  No se encontraron reglas aprendidas con ese criterio.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
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
                            <span>Confirmado: <strong className="text-slate-600">{regla.conteoConfirmaciones} veces</strong></span>
                            <span>•</span>
                            <span>Origen: <strong className="text-slate-600">{regla.origen}</strong></span>
                            <span>•</span>
                            <span>Tipo: <strong className="text-slate-600">{regla.tipo}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleEstadoRegla(regla.id)}
                            className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer transition ${
                              regla.estado === 'activo'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
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

            {/* Casos Históricos de Referencia RAG */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Proyectos Históricos en Memoria RAG ({casosRAG.length})
                  </h4>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  ✓ Solo Cotizaciones Finalizadas
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto">
                {casosRAG.map((caso) => (
                  <div
                    key={caso.id}
                    className="bg-white border border-slate-200 rounded-xl p-3 text-xs space-y-1 hover:border-indigo-400 transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">
                        {caso.empresaCliente}
                      </span>
                      <span className="font-mono text-[10px] text-slate-600 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                        {caso.codigoCotizacion}
                      </span>
                    </div>
                    <div className="text-[11px] text-indigo-600 font-medium truncate">
                      {caso.nombreObra}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>{caso.ensayosCotizados?.length || 0} ensayos indexados</span>
                      <span className="font-bold text-slate-700 font-mono">{caso.totalUf?.toFixed(1) || '0.0'} UF</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL / DRAWER DE VISTA PRELIMINAR DEL DOCUMENTO (REQ 2) */}
        {/* Se abre solo a petición y se cierra con botón ✕ */}
        {/* ======================================================== */}
        {showDocPreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-slate-800">
              
              {/* Header del Visor */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-red-700 shrink-0" />
                  <h3 className="font-bold text-slate-900 text-sm truncate">
                    Vista Preliminar: {currentFile?.name || (pastedText ? 'Texto de Cotización' : 'Documento Técnico')}
                  </h3>
                  {currentFile && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${currentBadge?.bg}`}>
                      {currentBadge?.label} • {(currentFile.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => window.open(previewUrl, '_blank')}
                      className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      title="Abrir en pestaña nueva"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Pestaña nueva</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowDocPreview(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="Cerrar vista preliminar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Contenido del Visor */}
              <div className="flex-1 overflow-hidden relative bg-slate-100 flex flex-col">
                {previewUrl ? (
                  <iframe
                    src={`${previewUrl}#toolbar=1&navpanes=0`}
                    className="w-full flex-1 border-0 bg-white"
                    title="Visor PDF Interactivo"
                  />
                ) : rawFileText ? (
                  <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-800 whitespace-pre-wrap bg-white">
                    {rawFileText}
                  </div>
                ) : pastedText ? (
                  <div className="flex-1 p-4 overflow-y-auto text-xs text-slate-800 whitespace-pre-wrap bg-white leading-relaxed">
                    {pastedText}
                  </div>
                ) : currentFile ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-white">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-3xl shadow-xs">
                      {currentBadge?.iconText || '📄'}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{currentFile.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Documento listo para procesamiento por Gemini.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                    No hay documento activo para previsualizar.
                  </div>
                )}
              </div>

              {/* Footer del Visor */}
              <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
                <span className="text-slate-500 truncate">
                  {currentFile?.name || (pastedText ? 'Texto cargado en memoria' : 'Documento en memoria')}
                </span>
                <button
                  type="button"
                  onClick={() => setShowDocPreview(false)}
                  className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-lg transition cursor-pointer"
                >
                  Cerrar Vista
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* MODAL PARA PEGAR TEXTO DE CORREO O LICITACIÓN (REQ 3) */}
        {/* ======================================================== */}
        {showPasteModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-slate-800">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-red-700" />
                  <h3 className="font-bold text-sm text-slate-900">
                    Pegar Texto de Solicitud o Licitación
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Pega el correo o bases de licitación:</span>
                  <div className="flex items-center gap-1">
                    {ANALISIS_EJEMPLOS.map((ej, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPastedText(ej.texto)}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded cursor-pointer transition font-medium"
                      >
                        ⚡ {ej.titulo.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Pega aquí el correo o especificaciones técnicas..."
                  className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 font-sans focus:ring-2 focus:ring-red-600 focus:outline-none resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-400">
                    {pastedText.length} caracteres
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPasteModal(false)}
                      className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      Guardar y Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={analisisLoading || !pastedText.trim()}
                      onClick={() => {
                        setShowPasteModal(false);
                        handleAnalyze();
                      }}
                      className="px-4 py-1.5 bg-red-700 hover:bg-red-800 disabled:opacity-40 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Analizar Texto con IA</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Inline para Crear Nueva Regla de Aprendizaje (Tema Claro) */}
        {showNuevaReglaModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 w-full max-w-md space-y-4 text-slate-800">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Código correspondiente en el tarifario oficial de 358 ensayos.
                  </span>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
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

        {/* Toast de Éxito al Archivar en Bibliografía Histórica */}
        {archiveSuccessToast && (
          <div className="fixed top-5 right-5 z-70 bg-emerald-700 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Conversación guardada con éxito en la Bibliografía Histórica</span>
          </div>
        )}

        {/* Modal de Confirmación al Reiniciar Asistente (Guardar en Histórica / Solo Reiniciar / Cancelar) */}
        {showResetConfirmModal && (
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="bg-white rounded-2xl p-6 shadow-2xl border border-slate-200 w-full max-w-lg space-y-4 text-slate-800 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    ¿Deseas guardar esta conversación en la Bibliografía Histórica?
                  </h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                    Al archivarla en la <strong>Bibliografía Histórica</strong>, el Asistente IA podrá consultar estos antecedentes en futuras cotizaciones (la <em>Bibliografía Técnica</em> siempre tendrá máxima prioridad sobre ella).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Resumen de la sesión a archivar:</span>
                </div>
                <div className="text-[11px] text-slate-500 pl-5">
                  • {chatMessages.filter((m) => m.role === 'user').length} consultas del ejecutivo comercial.
                  {ensayosSeleccionados.length > 0 && ` • ${ensayosSeleccionados.length} ensayos estructurados en la batería.`}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowResetConfirmModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={isArchivingHistory}
                  onClick={() => executeResetChat(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 border border-slate-300 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Solo Reiniciar</span>
                </button>

                <button
                  type="button"
                  disabled={isArchivingHistory}
                  onClick={() => executeResetChat(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {isArchivingHistory ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookmarkCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Guardar en Histórica y Reiniciar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
