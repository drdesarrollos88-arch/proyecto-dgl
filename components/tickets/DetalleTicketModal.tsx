'use client';

import React, { useState } from 'react';
import {
  X,
  Bug,
  Sparkles,
  HelpCircle,
  AlertTriangle,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Maximize2,
  Save,
  MessageSquare,
  Wrench,
} from 'lucide-react';
import { TicketItem, TicketEstado, TicketPrioridad } from '@/lib/tickets-types';
import { SessionUser } from '@/lib/types';
import { isSuperAdminRole, isAdminRole } from '@/lib/permissions';

interface DetalleTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketItem | null;
  currentUser?: SessionUser | null;
  onTicketUpdated?: () => void;
  onTicketDeleted?: () => void;
}

export default function DetalleTicketModal({
  isOpen,
  onClose,
  ticket,
  currentUser,
  onTicketUpdated,
  onTicketDeleted,
}: DetalleTicketModalProps) {
  if (!isOpen || !ticket) return null;

  const isSuperadmin = isSuperAdminRole(currentUser?.role) || isAdminRole(currentUser?.role);

  const [estado, setEstado] = useState<TicketEstado>(ticket.estado);
  const [prioridad, setPrioridad] = useState<TicketPrioridad>(ticket.prioridad);
  const [notasAdmin, setNotasAdmin] = useState<string>(ticket.notasAdmin || '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<boolean>(false);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado,
          prioridad,
          notasAdmin: notasAdmin.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar ticket');

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onTicketUpdated?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error guardando cambios');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar el ticket ${ticket.id}? Esta acción no se puede deshacer.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al eliminar');

      onTicketDeleted?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-red-600/90 text-white tracking-wider">
              {ticket.id}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                  {ticket.modulo}
                </span>
              </div>
              <h2 className="text-base font-bold text-white max-w-md truncate" title={ticket.titulo}>
                {ticket.titulo}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Ficha Resumen del Solicitante */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Solicitado Por
              </span>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span>{ticket.usuarioNombre}</span>
                <span className="text-[10px] font-normal text-slate-500">({ticket.usuarioRol})</span>
              </div>
              <div className="text-[11px] text-slate-500">{ticket.usuarioEmail}</div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Fecha y Hora de Creación
              </span>
              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{ticket.fechaFormateada}</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Última actualización: {new Date(ticket.updatedAt).toLocaleTimeString('es-CL')}
              </div>
            </div>
          </div>

          {/* Badges de Tipo, Prioridad y Estado */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                ticket.tipo === 'error'
                  ? 'bg-rose-100 text-rose-800'
                  : ticket.tipo === 'mejora'
                  ? 'bg-purple-100 text-purple-800'
                  : ticket.tipo === 'urgente'
                  ? 'bg-red-100 text-red-900 ring-1 ring-red-500 font-black'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {ticket.tipo === 'error'
                ? '🐛 Error / Bug'
                : ticket.tipo === 'mejora'
                ? '✨ Mejora'
                : ticket.tipo === 'urgente'
                ? '🚨 Urgente'
                : '❓ Consulta'}
            </span>

            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                ticket.prioridad === 'critica'
                  ? 'bg-rose-600 text-white'
                  : ticket.prioridad === 'alta'
                  ? 'bg-amber-100 text-amber-800'
                  : ticket.prioridad === 'media'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              Prioridad: {ticket.prioridad.toUpperCase()}
            </span>

            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                ticket.estado === 'resuelto'
                  ? 'bg-emerald-100 text-emerald-800'
                  : ticket.estado === 'en_desarrollo'
                  ? 'bg-indigo-100 text-indigo-800'
                  : ticket.estado === 'en_revision'
                  ? 'bg-amber-100 text-amber-800'
                  : ticket.estado === 'cerrado'
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              Estado: {ticket.estado.toUpperCase().replace('_', ' ')}
            </span>
          </div>

          {/* Descripción */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
              Descripción del Problema o Solicitud
            </span>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
              {ticket.descripcion}
            </div>
          </div>

          {/* Captura de Pantalla si existe */}
          {ticket.capturaPantalla && (
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Captura de Pantalla Adjunta
              </span>
              <div
                onClick={() => setZoomImage(true)}
                className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black cursor-pointer group max-h-64 flex items-center justify-center shadow-xs"
              >
                <img
                  src={ticket.capturaPantalla}
                  alt="Captura del ticket"
                  className="max-h-64 object-contain group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-xs gap-2">
                  <Maximize2 className="w-4 h-4" />
                  <span>Haz clic para ampliar captura</span>
                </div>
              </div>
            </div>
          )}

          {/* SECCIÓN SUPERADMIN: GESTIÓN DE ESTADO Y PARCHES */}
          {isSuperadmin ? (
            <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Gestión del Superadmin (Parches & Estado)</span>
                </span>
                {saveSuccess && (
                  <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    ¡Actualizado con éxito!
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cambiar Estado */}
                <div>
                  <label className="block text-[11px] font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                    Estado del Ticket
                  </label>
                  <select
                    value={estado}
                    onChange={(e) => setEstado(e.target.value as TicketEstado)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="abierto">Abierto (Pendiente)</option>
                    <option value="en_revision">En Revisión por Soporte</option>
                    <option value="en_desarrollo">En Desarrollo / Creando Parche</option>
                    <option value="resuelto">Resuelto / Parche Aplicado</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                </div>

                {/* Cambiar Prioridad */}
                <div>
                  <label className="block text-[11px] font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                    Ajustar Prioridad
                  </label>
                  <select
                    value={prioridad}
                    onChange={(e) => setPrioridad(e.target.value as TicketPrioridad)}
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="critica">Crítica</option>
                  </select>
                </div>
              </div>

              {/* Notas de resolución / parche */}
              <div>
                <label className="block text-[11px] font-bold text-indigo-950 dark:text-indigo-200 mb-1">
                  Notas de Parche / Respuesta Técnica al Usuario
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalla la solución aplicada, versión de despliegue o indicaciones para el usuario..."
                  value={notasAdmin}
                  onChange={(e) => setNotasAdmin(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-300 dark:border-rose-800 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Ticket</span>
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-transform hover:scale-102"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </div>
          ) : (
            // Vista solo lectura de notas de resolución para usuario regular
            ticket.notasAdmin && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Respuesta del Administrador / Parche Aplicado</span>
                </span>
                <p className="text-xs text-emerald-950 dark:text-emerald-200 whitespace-pre-wrap">
                  {ticket.notasAdmin}
                </p>
                {ticket.resueltoPor && (
                  <p className="text-[10px] text-slate-500 pt-1">
                    Atendido por {ticket.resueltoPor} ({ticket.resueltoEn})
                  </p>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Modal Zoom de Imagen */}
      {zoomImage && ticket.capturaPantalla && (
        <div
          onClick={() => setZoomImage(false)}
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <img src={ticket.capturaPantalla} alt="Captura ampliada" className="max-w-full max-h-[88vh] rounded-xl shadow-2xl object-contain" />
            <button
              onClick={() => setZoomImage(false)}
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

