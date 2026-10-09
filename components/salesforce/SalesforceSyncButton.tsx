'use client';

import React, { useState } from 'react';
import { Cotizacion } from '@/lib/types';
import { Cloud, CloudUpload, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

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

  const isSynced = Boolean(cotizacion.salesforceOpportunityId || cotizacion.salesforceQuoteId);
  const isDraft = cotizacion.status === 'Borrador';
  const targetUrl = cotizacion.salesforceQuoteUrl || cotizacion.salesforceOpportunityUrl;

  const handleSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (loading) return;

    // 1. Validación: Si es borrador, no permitir la carga
    if (isDraft) {
      alert(
        `No es posible enviar borradores a Salesforce.\n\nPor favor cambie el estado de la cotización "${cotizacion.code}" a "Finalizada" antes de sincronizar.`
      );
      return;
    }

    // 2. Confirmación según sea creación o actualización
    const confirmMessage = isSynced
      ? `¿Deseas actualizar la cotización existente en Salesforce?\n\n` +
        `• Código propuesta: ${cotizacion.code}\n` +
        `• Oportunidad ID: ${cotizacion.salesforceOpportunityId}\n` +
        `• Nuevo Monto: ${cotizacion.totalUf} UF (CLP calculado por Salesforce)\n` +
        `• Archivo: Se adjuntará el nuevo PDF de esta versión\n\n` +
        `Esta acción sobreescribirá la Oportunidad y Cotización existente sin duplicar registros.`
      : `¿Deseas cargar la cotización ${cotizacion.code} a Salesforce IDIEM?\n\n` +
        `• Cliente: ${cotizacion.clientName}\n` +
        `• Proyecto: ${cotizacion.projectName || 'Sin especificar'}\n` +
        `• Sección DGL: ${cotizacion.seccion || 'Por defecto'}\n` +
        `• Centro de Costo (CC): ${cotizacion.centroCosto || '2340'}\n` +
        `• Sector Proyecto: ${cotizacion.sectorProyecto || 'Inmobiliario'}\n` +
        `• Subsector Proyecto: ${cotizacion.subsectorProyecto || 'No Aplica'}\n` +
        `• Zona Proyecto: ${cotizacion.zonaProyecto || 'Región Metropolitana'}\n\n` +
        `Se creará la Oportunidad, la Cotización (Quote) oficial con su servicio y se adjuntará el documento PDF definitivo.`;

    const confirmed = confirm(confirmMessage);
    if (!confirmed) return;

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

      // Si el servidor devolvió data con IDs, actualizar cotización localmente
      if (data.data) {
        const updatedCotizacion: Cotizacion = {
          ...cotizacion,
          status: cotizacion.status === 'Finalizada' ? 'Enviada' : cotizacion.status,
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

      alert(
        isSynced
          ? `¡Cotización y Oportunidad actualizadas con éxito en Salesforce!\nOportunidad ID: ${cotizacion.salesforceOpportunityId}`
          : `¡Cotización cargada con éxito en Salesforce!\nOportunidad ID: ${data.data?.opportunityId || 'Registrada'}`
      );
    } catch (err: any) {
      const msg = err?.message || 'Error de red o servidor al comunicar con Salesforce.';
      setErrorMsg(msg);
      alert(`Error al sincronizar: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // CASO 1: Ya sincronizada -> Botón enlace directo + Botón Actualizar
  if (isSynced) {
    if (variant === 'button') {
      return (
        <div className="inline-flex items-center gap-1.5 flex-wrap">
          <a
            href={targetUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            title={`Cotización ya cargada en Salesforce (${cotizacion.salesforceOpportunityId || 'ID'}). Clic para abrir.`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Cloud className="w-3.5 h-3.5 text-sky-600 fill-sky-200" />
            <span>En Salesforce</span>
            <ExternalLink className="w-3 h-3 text-sky-500" />
          </a>

          <button
            type="button"
            onClick={handleSync}
            disabled={loading}
            title="Actualizar registro existente en Salesforce con la nueva versión, monto UF y nuevo PDF"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
            )}
            <span>{loading ? 'Actualizando...' : 'Actualizar en Salesforce'}</span>
          </button>
        </div>
      );
    }

    return (
      <div className="relative inline-flex items-center gap-1">
        <a
          href={targetUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          title={`Cargada en Salesforce (${cotizacion.salesforceOpportunityId || 'ID'}). Clic para abrir en Salesforce.`}
          className="p-1 text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer inline-flex items-center relative group"
        >
          <Cloud className="w-3.5 h-3.5 fill-sky-100 stroke-sky-600" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-0.5 right-0.5" title="Sincronizada"></span>
        </a>
        <button
          type="button"
          onClick={handleSync}
          disabled={loading}
          title="Actualizar Oportunidad y servicio en Salesforce"
          className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer inline-flex items-center"
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-sky-600" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </button>
      </div>
    );
  }

  // CASO 2: Es borrador -> Bloqueado con tooltip explicativo
  if (isDraft) {
    if (variant === 'button') {
      return (
        <button
          type="button"
          onClick={() => alert(`No es posible cargar borradores en Salesforce.\nDebe finalizar la cotización "${cotizacion.code}" antes de enviarla.`)}
          title="No disponible para Borradores. Cambie el estado a Finalizada para cargar en Salesforce."
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-80"
        >
          <CloudUpload className="w-4 h-4 text-slate-400" />
          <span>Salesforce (Solo Finalizadas)</span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => alert(`No es posible cargar borradores en Salesforce.\nDebe finalizar la cotización "${cotizacion.code}" antes de enviarla.`)}
        title="No disponible para Borradores. Cambie el estado a Finalizada para cargar en Salesforce."
        className="p-1 rounded-md text-slate-300 hover:text-slate-400 cursor-not-allowed inline-flex items-center opacity-60"
      >
        <CloudUpload className="w-3.5 h-3.5" />
      </button>
    );
  }

  // CASO 3: Cotización Finalizada y aún no sincronizada -> Botón activo para cargar 1 vez
  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        title="Cargar cotización finalizada en Salesforce (crea Oportunidad, Presupuesto y adjunta PDF oficial)"
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

  // Modo 'table-action'
  return (
    <button
      type="button"
      onClick={handleSync}
      disabled={loading}
      title="Cargar cotización finalizada en Salesforce (crea Oportunidad, Presupuesto y adjunta PDF)"
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

