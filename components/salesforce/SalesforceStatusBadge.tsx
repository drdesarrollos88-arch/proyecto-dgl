'use client';

import React, { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, AlertCircle, Loader2, LogOut, ExternalLink, RefreshCw } from 'lucide-react';

interface SalesforceStatus {
  connected: boolean;
  userName?: string;
  userEmail?: string;
  instanceUrl?: string;
  updatedAt?: string;
}

export default function SalesforceStatusBadge({ onStatusChange }: { onStatusChange?: (connected: boolean) => void }) {
  const [status, setStatus] = useState<SalesforceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/auth/salesforce/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (onStatusChange) onStatusChange(Boolean(data.connected));
      } else {
        setStatus({ connected: false });
        if (onStatusChange) onStatusChange(false);
      }
    } catch {
      setStatus({ connected: false });
      if (onStatusChange) onStatusChange(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Escuchar mensaje del popup OAuth cuando finalice la autorización
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SALESFORCE_AUTH_SUCCESS') {
        fetchStatus();
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, []);

  const handleConnect = () => {
    const width = 600;
    const height = 720;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;

    window.open(
      '/api/auth/salesforce/login',
      'SalesforceAuthWindow',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );
  };

  const handleDisconnect = async () => {
    if (!confirm('¿Deseas desconectar tu sesión de Salesforce?')) return;
    setIsDisconnecting(true);
    try {
      const res = await fetch('/api/auth/salesforce/disconnect', { method: 'POST' });
      if (res.ok) {
        setStatus({ connected: false });
        setShowDropdown(false);
        if (onStatusChange) onStatusChange(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
        <span className="hidden sm:inline">Salesforce...</span>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        title="Vincular cuenta de Salesforce IDIEM con OAuth 2.0"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-sky-50 text-sky-700 hover:text-sky-800 border border-sky-200/90 shadow-2xs hover:border-sky-300 transition-all cursor-pointer"
      >
        <Cloud className="w-3.5 h-3.5 text-sky-600" />
        <span>Conectar Salesforce</span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
      </button>
    );
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        title={`Conectado a Salesforce: ${status.userName || status.userEmail}`}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 hover:bg-sky-100 transition-all cursor-pointer shadow-2xs"
      >
        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span>
        <Cloud className="w-3.5 h-3.5 text-sky-600" />
        <span className="max-w-[120px] truncate">{status.userName || 'Salesforce IDIEM'}</span>
      </button>

      {showDropdown && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
          <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                  <Cloud className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 leading-tight">Salesforce Conectado</div>
                  <div className="text-[11px] text-slate-500 truncate max-w-[180px]">{status.userEmail || status.userName}</div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Activo
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-600 mb-3">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-slate-400">Instancia:</span>
                <span className="font-mono font-medium text-slate-700 truncate max-w-[140px]">
                  {status.instanceUrl?.replace('https://', '') || 'idiem.my.salesforce.com'}
                </span>
              </div>
              {status.updatedAt && (
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-slate-400">Sesión renovada:</span>
                  <span className="font-mono text-slate-600">
                    {new Date(status.updatedAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleConnect}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reconectar
              </button>

              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                {isDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                Desconectar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

