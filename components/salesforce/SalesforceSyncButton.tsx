'use client';

import React, { useState } from 'react';
import { Cotizacion } from '@/lib/types';
import { Cloud, CloudUpload, CheckCircle2, AlertCircle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

interface SalesforceSyncButtonProps {
  cotizacion: Cotizacion;
  onSynced?: (updated: Cotizacion) => void;
  variant?: 'table-action' | 'button';
}

export default function SalesforceSyncButton({
  cotizacion,
  onSynced,
  variant = 'table-action',
}: SalesforceSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState(false);

  const isSynced = Boolean(cotizacion.salesforceOpportunityId || cotizacion.salesforceQuoteId);
  const targetUrl = cotizacion.salesforceQuoteUrl || cotizacion.salesforceOpportunityUrl;

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (loading) return;

    if (isSynced && !confirm(`Esta cotización ya fue cargada en Salesforce (${cotizacion.salesforceOpportunityId}). ¿Deseas volver a crear/sincronizar una versión en Salesforce?`)) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/salesforce/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cotizacionId: cotizacion.id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const err = data.error || 'No se pudo sincronizar con Salesforce';
        setErrorMsg(err);
        alert(`Error al sincronizar con Salesforce:\n${err}`);
        return;
      }

      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 4000);

      // Si el servidor devolvió data con IDs, actualizar cotización localmente
      if (data.data) {
        const updatedCotizacion: Cotizacion = {
          ...cotizacion,
          salesforceOpportunityId: data.data.opportunityId || cotizacion.salesforceOpportunityId,
          salesforceOpportunityUrl: data.data.opportunityUrl || cotizacion.salesforceOpportunityUrl,
          salesforceQuoteId: data.data.quoteId || cotizacion.salesforceQuoteId,
          salesforceQuoteUrl: data.data.quoteUrl || cotizacion.salesforceQuoteUrl,
          salesforceSyncedAt: new Date().toISOString(),
        };
        if (onSynced) {
          onSynced(updatedCotizacion);
        }
      }
    } catch (err: any) {
      const msg = err?.message || 'Error de red o servidor al comunicar con Salesforce.';
      setErrorMsg(msg);
      alert(`Error al sincronizar: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // 1. Ya sincronizado: Botón con enlace directo a Salesforce + opción de re-sync
  if (isSynced) {
    if (variant === 'button') {
      return (
        <div className="inline-flex items-center gap-1.5">
          <a
            href={targetUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir oportunidad/cotización en Salesforce IDIEM"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 transition-colors shadow-2xs"
          >
            <Cloud className="w-4 h-4 text-sky-600" />
            <span>En Salesforce</span>
            <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
          </a>
          <button
            type="button"
            onClick={handleSync}
            disabled={loading}
            title="Volver a sincronizar / actualizar en Salesforce"
            className="p-2 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition-colors cursor-pointer"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </button>
        </div>
      );
    }

    return (
      <div className="relative inline-flex items-center">
        <a
          href={targetUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          title={`Sincronizada con Salesforce (${cotizacion.salesforceOpportunityId || 'ID'}). Clic para abrir en Salesforce.`}
          className="p-1 text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer inline-flex items-center relative group"
        >
          <Cloud className="w-3.5 h-3.5 fill-sky-100 stroke-sky-600" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-0.5 right-0.5"></span>
        </a>
      </div>
    );
  }

  // 2. No sincronizado: Botón para sincronizar
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        title="Crear Oportunidad y Cotización en Salesforce con PDF adjunto"
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition-all shadow-2xs cursor-pointer disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
        ) : (
          <CloudUpload className="w-4 h-4 text-sky-600" />
        )}
        <span>{loading ? 'Cargando en Salesforce...' : 'Cargar en Salesforce'}</span>
      </button>
    );
  }

  // Modo 'table-action' (ícono en la tabla de cotizaciones)
  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={loading}
      title="Cargar cotización en Salesforce (crea Oportunidad, Presupuesto y adjunta PDF)"
      className={`p-1 rounded-md transition-colors cursor-pointer inline-flex items-center relative ${
        loading
          ? 'text-sky-600 bg-sky-50'
          : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
      }`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
      ) : (
        <CloudUpload className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

