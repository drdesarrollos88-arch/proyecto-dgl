'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  Bot,
  User,
  Trash2,
  Copy,
  Check,
  HelpCircle,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const QUICK_PROMPTS = [
  {
    title: 'Normativa NCh 1508',
    prompt: '¿Cuáles son los ensayos mínimos y requisitos que exige la norma NCh 1508 para un estudio de mecánica de suelos?',
    icon: BookOpen,
  },
  {
    title: 'Canteras de Áridos',
    prompt: '¿Qué batería de ensayos se recomienda para caracterizar una cantera de áridos según especificaciones del MOP (MC-V8)?',
    icon: FlaskConical,
  },
  {
    title: 'Triaxial CIU vs UU',
    prompt: '¿Cuál es la diferencia entre el ensayo Triaxial CIU (ASTM D4767) y el Triaxial UU (ASTM D2850), y cuándo se recomienda cada uno?',
    icon: Sparkles,
  },
  {
    title: 'Acreditación LE-304',
    prompt: '¿Qué ensayos del catálogo DGL están bajo el alcance de acreditación INN LE-304 y qué importancia tiene para el cliente?',
    icon: ShieldCheck,
  },
];

export default function AsistenteChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! Soy el **Asistente Técnico-Comercial de DGL** respaldado por Google Gemini y el acervo técnico de IDIEM.\n\nPuedes consultarme sobre:\n- 📖 **Normativas geotécnicas** chilenas e internacionales (NCh, ASTM, MOP, AASHTO).\n- 🔬 **Ensayos de suelos y rocas**: procedimientos, cantidades de muestra, tiempos de ejecución y normativa aplicable.\n- 🛡️ **Alcance de acreditación INN LE-304** en laboratorios DGL.\n- 💡 **Recomendaciones de planes de prospección** y ensayos para proyectos de ingeniería.',
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Formatear historial para la API
      const historial = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch('/api/ai/chat-asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: text,
          historial,
          contexto: {
            modulo: 'centro-ia-dgl',
            especialidad: 'geotecnia-mecanica-suelos-rocas',
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}: Fallo en la comunicación con IA`);
      }

      const data = await res.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.mensaje || 'Respuesta recibida sin contenido.',
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Ocurrió un problema:** ${err.message || 'No fue posible conectar con el Asistente IA.'}\n\nPor favor intenta nuevamente en unos momentos.`,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (confirm('¿Deseas reiniciar la conversación con el asistente?')) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content:
            '¡Conversación reiniciada! ¿En qué puedo asistirte técnicamente hoy? Pregúntame sobre normativas, ensayos de suelos o rocas, o acreditación LE-304.',
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  // Renderizador simple de markdown para negritas, listas y saltos de línea
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="space-y-1.5 text-xs leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) {
            return <div key={idx} className="h-1.5" />;
          }

          // Bullets
          if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
            const textAfterBullet = line.trim().substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-2">
                <span className="text-indigo-500 font-bold leading-tight mt-0.5">•</span>
                <span dangerouslySetInnerHTML={{ __html: parseBold(textAfterBullet) }} />
              </div>
            );
          }

          // Regular lines
          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: parseBold(line) }} />
          );
        })}
      </div>
    );
  };

  // Helper para convertir **texto** a <strong>texto</strong>
  const parseBold = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-slate-200/60 px-1 py-0.5 rounded font-mono text-[11px]">$1</code>');
  };

  return (
    <div className="space-y-4">
      {/* Quick Prompts Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Consultas Técnicas Frecuentes (Acceso Rápido)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">Haz clic para consultar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {QUICK_PROMPTS.map((qp, idx) => {
            const Icon = qp.icon;
            return (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp.prompt)}
                disabled={loading}
                className="flex flex-col text-left p-3 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 transition-all text-xs group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center gap-2 text-indigo-700 font-semibold mb-1">
                  <Icon className="w-3.5 h-3.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="line-clamp-1">{qp.title}</span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug">
                  {qp.prompt}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Chat Box */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-[600px]">
        {/* Chat Header */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/60 border border-indigo-400/30 flex items-center justify-center text-white">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wide">Asistente Geotécnico DGL</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold px-2 py-0.2 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Gemini Online
                </span>
              </div>
              <p className="text-[10px] text-slate-300 font-normal">
                Normativas NCh, ASTM, MOP & Acreditación LE-304
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Reiniciar conversación"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-white text-xs ${
                    isUser
                      ? 'bg-slate-700'
                      : 'bg-gradient-to-br from-indigo-600 to-purple-600 shadow-xs'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl p-4 shadow-2xs group relative ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isUser ? 'text-indigo-200' : 'text-indigo-700'
                      }`}
                    >
                      {isUser ? 'Tú (Ejecutivo DGL)' : 'Asistente IA Técnico'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] ${
                          isUser ? 'text-indigo-200' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </span>
                      {!isUser && (
                        <button
                          onClick={() => handleCopy(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-indigo-600"
                          title="Copiar respuesta"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser ? (
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  ) : (
                    renderFormattedContent(msg.content)
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 max-w-xl">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-medium">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Consultando base de conocimientos y normativas...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu consulta técnica o comercial... (ej: '¿Qué ensayos aplican para suelos colapsables?')"
                rows={2}
                className="w-full resize-none px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-800 placeholder:text-slate-400"
              />
              <span className="absolute right-2.5 bottom-2 text-[10px] text-slate-400 hidden sm:inline">
                Enter para enviar · Shift+Enter para nueva línea
              </span>
            </div>

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

