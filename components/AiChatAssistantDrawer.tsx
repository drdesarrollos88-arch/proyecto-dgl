'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CotizacionItem, TarifarioItem } from '@/lib/types';
import { AiChatAction, AiChatMessage, AiChatResponse } from '@/lib/ai-service';
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
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface AiChatAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentItems: CotizacionItem[];
  onApplyActions: (acciones: AiChatAction[], itemsCompletos: TarifarioItem[]) => void;
  contexto: {
    clientName?: string;
    projectName?: string;
    centroCosto?: string;
    currency?: string;
  };
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  acciones?: AiChatAction[];
  timestamp: string;
}

const SUGGESTIONS = [
  'Agregale a este presupuesto 3 Clasificaciones Completas y 3 Consolidaciones de 20 cm sin permeabilidad',
  'Cambia el ensayo de corte directo a 7 muestras',
  'Elimina los ensayos de cono de arena',
  'Aplica un 10% de descuento (factor 0.9) a todos los ensayos',
  '¿Qué ensayos se recomiendan para un estudio de fundación en gravas?',
];

export default function AiChatAssistantDrawer({
  isOpen,
  onClose,
  currentItems,
  onApplyActions,
  contexto,
}: AiChatAssistantDrawerProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! Soy tu **Asistente IA Técnico-Comercial DGL IDIEM**. Puedes pedirme que agregue ensayos, cambie cantidades, aplique descuentos o responda consultas técnicas sobre la normativa y los 358 ensayos de nuestro tarifario.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll al final del chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Preparar historial para la API
      const historial: AiChatMessage[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Preparar ítems actuales en formato ligero
      const itemsPayload = currentItems.map((it) => ({
        code: it.code,
        designation: it.designation,
        quantity: it.quantity,
        factor: it.factor,
        ufPrice: it.ufPrice,
      }));

      const res = await fetch('/api/ai/chat-asistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje: text,
          historial,
          itemsActuales: itemsPayload,
          contexto,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al conectar con el asistente de IA');
      }

      const data: AiChatResponse = await res.json();

      const assistantMsg: DisplayMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: data.mensaje || 'He procesado tu solicitud.',
        acciones: data.acciones,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Ejecutar automáticamente las acciones en el cotizador si existen
      if (Array.isArray(data.acciones) && data.acciones.length > 0) {
        onApplyActions(data.acciones, data.itemsAgregadosCompletos || []);

        // Retroalimentación automática (Feedback Loop - Opción B)
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
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Disculpa, ocurrió un inconveniente al procesar tu solicitud: ${errorText}. Por favor intenta nuevamente.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('¿Deseas reiniciar la conversación con el asistente?')) {
      setMessages([
        {
          id: 'welcome-reset',
          role: 'assistant',
          content:
            'Conversación reiniciada. ¿En qué puedo ayudarte para configurar o ajustar tu cotización?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
      {/* Cabecera del Asistente */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-inner">
            <Bot className="w-5 h-5 text-blue-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight">Asistente IA DGL</h2>
              <span className="text-[10px] bg-blue-500/30 text-blue-200 px-1.5 py-0.5 rounded border border-blue-400/30 font-semibold">
                Técnico-Comercial
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Manipulación conversacional de ensayos y cotizaciones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleClearHistory}
            title="Reiniciar conversación"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            title="Cerrar panel (Esc)"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Franja de contexto del presupuesto actual */}
      <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
        <div className="truncate">
          <span className="font-semibold text-slate-700">Ensayos en propuesta:</span>{' '}
          <span className="font-bold text-blue-700 font-mono">{currentItems.length}</span>{' '}
          {currentItems.length === 1 ? 'ítem' : 'ítems'}
        </div>
        <div className="truncate text-slate-500">
          {contexto.clientName ? `Cliente: ${contexto.clientName}` : 'Borrador en edición'}
        </div>
      </div>

      {/* Contenedor de Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/60">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                m.role === 'user'
                  ? 'bg-blue-700 text-white rounded-br-xs'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
              }`}
            >
              {/* Contenido del mensaje */}
              <div className="whitespace-pre-wrap">{m.content}</div>

              {/* Detalle visual de acciones aplicadas por la IA */}
              {m.acciones && m.acciones.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{m.acciones.length} cambio(s) aplicados en el presupuesto:</span>
                  </div>
                  <ul className="space-y-1 text-[11px] text-slate-600">
                    {m.acciones.map((act, i) => (
                      <li
                        key={i}
                        className="bg-emerald-50/70 border border-emerald-200/80 rounded px-2 py-1 flex items-center gap-1.5"
                      >
                        {act.tipo === 'AGREGAR' && (
                          <>
                            <span className="font-bold text-emerald-800">+ {act.cantidad || 1}x</span>
                            <span className="font-mono text-[10px] text-emerald-900 bg-emerald-100 px-1 rounded">
                              Cód. {act.codigo}
                            </span>
                            <span className="truncate">{act.descripcion || 'Ensayo'}</span>
                          </>
                        )}
                        {act.tipo === 'MODIFICAR_CANTIDAD' && (
                          <>
                            <span className="font-bold text-blue-800">✎ Cantidad:</span>
                            <span className="font-mono text-[10px] text-blue-900 bg-blue-100 px-1 rounded">
                              Cód. {act.codigo}
                            </span>
                            <span>a {act.cantidad} muestra(s)</span>
                          </>
                        )}
                        {act.tipo === 'ELIMINAR' && (
                          <>
                            <span className="font-bold text-red-700">✕ Eliminado:</span>
                            <span className="font-mono text-[10px] text-red-900 bg-red-100 px-1 rounded">
                              Cód. {act.codigo}
                            </span>
                          </>
                        )}
                        {act.tipo === 'APLICAR_FACTOR' && (
                          <>
                            <span className="font-bold text-purple-700">% Factor ajustado:</span>
                            <span>{act.factor}</span>
                            {act.codigo && <span className="font-mono text-[10px]">(Cód. {act.codigo})</span>}
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-400 mt-1 px-1">{m.timestamp}</span>
          </div>
        ))}

        {loading && (
          <div className="flex items-start gap-2">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-xs px-4 py-3 text-xs text-slate-600 shadow-xs flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span>Analizando catálogo DGL y aplicando cambios...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Sugerencias Rápidas */}
      <div className="px-4 py-2 bg-slate-100 border-t border-slate-200">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
          Sugerencias Rápidas:
        </span>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {SUGGESTIONS.map((sug, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSendMessage(sug)}
              disabled={loading}
              className="text-[10px] text-left bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 rounded-lg px-2 py-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Campo de Entrada de Texto */}
      <div className="p-3 bg-white border-t border-slate-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Escribe una instrucción (ej. Agrega 3 cortes directos 30x30)..."
            className="flex-1 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bg-blue-700 hover:bg-blue-800 text-white p-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
            title="Enviar instrucción (Enter)"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[10px] text-slate-400 mt-1.5 text-center">
          Opera con los 358 ensayos oficiales del tarifario DGL bajo política Zero Data Training.
        </p>
      </div>
    </div>
  );
}

