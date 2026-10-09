'use client';

import React, { useState } from 'react';
import {
  Cotizacion,
  SECCIONES_DGL,
  SeccionDGL,
  DGL_UNIDADES,
  SECTORES_PROYECTO,
  SectorProyecto,
  SUBSECTORES_PROYECTO,
  SubsectorProyecto,
  ZONAS_PROYECTO,
  ZonaProyecto,
  getDGLInfoByCC,
} from '@/lib/types';
import {
  Cloud,
  CloudUpload,
  Loader2,
  ExternalLink,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Building2,
  Layers,
  MapPin,
  Tag,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'confirm' | 'draft-warning' | 'success' | 'error'>('confirm');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<any>(null);

  const isSynced = Boolean(cotizacion.salesforceOpportunityId || cotizacion.salesforceQuoteId);
  const isDraft = cotizacion.status === 'Borrador';
  const targetUrl = cotizacion.salesforceQuoteUrl || cotizacion.salesforceOpportunityUrl;

  // Form values editable in modal
  const defaultDgl = getDGLInfoByCC(cotizacion.centroCosto || cotizacion.code || '2340');
  const [seccion, setSeccion] = useState<string>(cotizacion.seccion || defaultDgl.seccion);
  const [centroCosto, setCentroCosto] = useState<string>(cotizacion.centroCosto || defaultDgl.unitCode);
  const [sectorProyecto, setSectorProyecto] = useState<string>(cotizacion.sectorProyecto || 'Inmobiliario');
  const [subsectorProyecto, setSubsectorProyecto] = useState<string>(cotizacion.subsectorProyecto || 'No Aplica');
  const [zonaProyecto, setZonaProyecto] = useState<string>(cotizacion.zonaProyecto || 'Región Metropolitana');

  const handleOpenModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (isDraft) {
      setModalStep('draft-warning');
      setIsModalOpen(true);
      return;
    }

    // Refresh default values based on current quote
    const dgl = getDGLInfoByCC(cotizacion.centroCosto || cotizacion.code || '2340');
    setSeccion(cotizacion.seccion || dgl.seccion);
    setCentroCosto(cotizacion.centroCosto || dgl.unitCode);
    setSectorProyecto(cotizacion.sectorProyecto || 'Inmobiliario');
    setSubsectorProyecto(cotizacion.subsectorProyecto || 'No Aplica');
    setZonaProyecto(cotizacion.zonaProyecto || 'Región Metropolitana');
    setErrorMsg(null);
    setModalStep('confirm');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (loading) return;
    setIsModalOpen(false);
    setErrorMsg(null);
  };

  const handleSeccionChange = (newSec: string) => {
    setSeccion(newSec);
    const matchingUnit = DGL_UNIDADES.find((u) => u.seccion === newSec);
    if (matchingUnit) {
      setCentroCosto(matchingUnit.code);
    }
  };

  const handleUnitChange = (newCode: string) => {
    setCentroCosto(newCode);
    const unitObj = DGL_UNIDADES.find((u) => u.code === newCode);
    if (unitObj) {
      setSeccion(unitObj.seccion);
    }
  };

  const handleConfirmSync = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/salesforce/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cotizacionId: cotizacion.id,
          seccion,
          centroCosto,
          sectorProyecto,
          subsectorProyecto,
          zonaProyecto,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo sincronizar la propuesta con Salesforce.');
      }

      const updatedCotizacion: Cotizacion = {
        ...cotizacion,
        seccion,
        centroCosto,
        sectorProyecto,
        subsectorProyecto,
        zonaProyecto,
        status: cotizacion.status === 'Finalizada' ? 'Enviada' : cotizacion.status,
        salesforceOpportunityId: data.data?.opportunityId || cotizacion.salesforceOpportunityId,
        salesforceOpportunityUrl: data.data?.opportunityUrl || cotizacion.salesforceOpportunityUrl,
        salesforceQuoteId: data.data?.quoteId || cotizacion.salesforceQuoteId,
        salesforceQuoteUrl: data.data?.quoteUrl || cotizacion.salesforceQuoteUrl,
        salesforceSyncedAt: new Date().toISOString(),
      };

      if (onSynced) {
        onSynced(updatedCotizacion);
      }

      setSuccessInfo(data.data);
      setModalStep('success');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error inesperado al conectar con el servidor de Salesforce.');
      setModalStep('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Botones de activación en la interfaz */}
      {isSynced ? (
        variant === 'button' ? (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <a
              href={targetUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              title={`Cotización vinculada a Salesforce (${cotizacion.salesforceOpportunityId || 'ID'}). Clic para abrir en Salesforce.`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-300 transition-colors shadow-2xs cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5 text-sky-600 fill-sky-200" />
              <span>En Salesforce</span>
              <ExternalLink className="w-3 h-3 text-sky-500" />
            </a>

            <button
              type="button"
              onClick={handleOpenModal}
              title="Verificar clasificación y actualizar registro en Salesforce"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition-colors shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-sky-600" />
              <span>Actualizar en Salesforce</span>
            </button>
          </div>
        ) : (
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
              onClick={handleOpenModal}
              title="Verificar clasificación y actualizar en Salesforce"
              className="p-1 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors cursor-pointer inline-flex items-center"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        )
      ) : isDraft ? (
        variant === 'button' ? (
          <button
            type="button"
            onClick={handleOpenModal}
            title="No disponible para Borradores. Cambie el estado a Finalizada para cargar en Salesforce."
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-400 border border-slate-200 cursor-pointer"
          >
            <CloudUpload className="w-4 h-4 text-slate-400" />
            <span>Salesforce (Solo Finalizadas)</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpenModal}
            title="No disponible para Borradores. Cambie el estado a Finalizada para cargar en Salesforce."
            className="p-1 rounded-md text-slate-300 hover:text-slate-400 cursor-pointer inline-flex items-center opacity-70"
          >
            <CloudUpload className="w-3.5 h-3.5" />
          </button>
        )
      ) : variant === 'button' ? (
        <button
          type="button"
          onClick={handleOpenModal}
          title="Verificar clasificación y cargar cotización finalizada a Salesforce"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-700 hover:text-sky-700 hover:bg-sky-50 border border-slate-200 hover:border-sky-300 transition-all shadow-2xs cursor-pointer"
        >
          <CloudUpload className="w-4 h-4 text-sky-600" />
          <span>Cargar en Salesforce</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpenModal}
          title="Verificar clasificación y cargar cotización a Salesforce"
          className="p-1 rounded-md text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer inline-flex items-center"
        >
          <CloudUpload className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Modal Personalizado en Formato de la Plataforma */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget && !loading) handleCloseModal();
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* ESTADO 1: ADVERTENCIA DE BORRADOR */}
            {modalStep === 'draft-warning' && (
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center mb-4">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  Cotización en Estado Borrador
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed mb-6">
                  La propuesta <strong className="font-mono text-slate-800">{cotizacion.code}</strong> aún se encuentra en borrador. En Salesforce IDIEM solo es posible registrar cotizaciones oficiales emitidas en estado <strong>Finalizada</strong>.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Entendido
                  </button>
                </div>
              </div>
            )}

            {/* ESTADO 2: CONFIRMACIÓN Y EDICIÓN DE CLASIFICACIÓN EN DESPLEGABLES */}
            {modalStep === 'confirm' && (
              <div>
                {/* Cabecera del Modal */}
                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
                      <Cloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold tracking-tight">
                        {isSynced ? 'Actualizar Cotización en Salesforce' : 'Cargar Cotización a Salesforce'}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {isSynced
                          ? 'Modifica o valida los datos de la propuesta antes de actualizar la oportunidad oficial.'
                          : 'Revisa y ajusta la clasificación DGL y del Proyecto antes de crear la oportunidad.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCloseModal}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                  {/* Resumen de la Cotización */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {cotizacion.code}
                      </span>
                      <span className="font-mono font-bold text-slate-800 text-sm">
                        {cotizacion.totalUf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} UF
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400">Cliente:</span>{' '}
                        <strong className="text-slate-800">{cotizacion.clientName}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400">Proyecto:</span>{' '}
                        <strong className="text-slate-800">{cotizacion.projectName || 'Sin especificar'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Formulario Editable de Clasificación */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                      <span>Clasificación Oficial DGL y Salesforce</span>
                    </div>

                    {/* Fila 1: Sección DGL */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Sección DGL:
                      </label>
                      <select
                        value={seccion}
                        onChange={(e) => handleSeccionChange(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {SECCIONES_DGL.map((sec) => (
                          <option key={sec} value={sec}>
                            {sec}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fila 2: Centro de Costo / Unidad */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Centro de Costo (CC) / Unidad DGL:
                      </label>
                      <select
                        value={centroCosto}
                        onChange={(e) => handleUnitChange(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                      >
                        {DGL_UNIDADES.map((u) => (
                          <option key={u.code} value={u.code}>
                            {u.code} - {u.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Fila 3: Sector y Subsector Proyecto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Sector del Proyecto:
                        </label>
                        <select
                          value={sectorProyecto}
                          onChange={(e) => setSectorProyecto(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {SECTORES_PROYECTO.map((sec) => (
                            <option key={sec} value={sec}>
                              {sec}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Subsector del Proyecto:
                        </label>
                        <select
                          value={subsectorProyecto}
                          onChange={(e) => setSubsectorProyecto(e.target.value)}
                          className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          {SUBSECTORES_PROYECTO.map((subsec) => (
                            <option key={subsec} value={subsec}>
                              {subsec}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Fila 4: Zona del Proyecto */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Zona del Proyecto:
                      </label>
                      <select
                        value={zonaProyecto}
                        onChange={(e) => setZonaProyecto(e.target.value)}
                        className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {ZONAS_PROYECTO.map((zona) => (
                          <option key={zona} value={zona}>
                            {zona}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Nota informativa amigable */}
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3 text-[11px] text-blue-900 flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">ℹ</span>
                    <span>
                      Si modificas cualquiera de estos valores en los desplegables, se guardarán automáticamente en la plataforma y se enviarán sincronizados a Salesforce.
                    </span>
                  </div>
                </div>

                {/* Pie del Modal */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirmSync}
                    className="flex items-center gap-2 bg-[#E20000] hover:bg-[#C20000] text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Sincronizando con Salesforce...</span>
                      </>
                    ) : isSynced ? (
                      <>
                        <RefreshCw className="w-4 h-4 text-white" />
                        <span>Confirmar y Actualizar</span>
                      </>
                    ) : (
                      <>
                        <CloudUpload className="w-4 h-4 text-white" />
                        <span>Confirmar y Enviar a Salesforce</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ESTADO 3: MENSAJE AMIGABLE DE ÉXITO */}
            {modalStep === 'success' && (
              <div className="p-7 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center mb-4 ring-8 ring-emerald-50">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  {isSynced ? '¡Cotización Actualizada en Salesforce!' : '¡Cotización Cargada con Éxito!'}
                </h3>

                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed mb-5">
                  La propuesta comercial <strong className="font-mono text-slate-900">{cotizacion.code}</strong> para{' '}
                  <strong className="text-slate-900">{cotizacion.clientName}</strong> ha sido{' '}
                  {isSynced ? 'actualizada' : 'registrada'} exitosamente en Salesforce IDIEM con su Oportunidad, Presupuesto oficial (Quote) y el PDF correspondiente.
                </p>

                {/* Resumen amigable */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 max-w-sm mx-auto text-left text-xs mb-6 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Monto del Servicio:</span>
                    <strong className="text-slate-800 font-mono">{cotizacion.totalUf} UF</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Unidad DGL:</span>
                    <strong className="text-slate-800 font-mono">{centroCosto}</strong>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Clasificación:</span>
                    <strong className="text-slate-800">{sectorProyecto} • {zonaProyecto}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {(successInfo?.quoteUrl || successInfo?.opportunityUrl || targetUrl) && (
                    <a
                      href={successInfo?.quoteUrl || successInfo?.opportunityUrl || targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                    >
                      <Cloud className="w-4 h-4 fill-sky-200" />
                      <span>Abrir en Salesforce</span>
                      <ExternalLink className="w-3.5 h-3.5 text-sky-200" />
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Listo, Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* ESTADO 4: ERROR CON REINTENTO */}
            {modalStep === 'error' && (
              <div className="p-7 text-center">
                <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center mb-4 ring-8 ring-red-50">
                  <AlertTriangle className="w-8 h-8" />
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  No se pudo sincronizar con Salesforce
                </h3>

                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3.5 max-w-md mx-auto leading-relaxed mb-6 font-medium">
                  {errorMsg || 'Ocurrió un error inesperado al procesar la solicitud con Salesforce.'}
                </p>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModalStep('confirm')}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#E20000] hover:bg-[#C20000] text-white transition-colors cursor-pointer"
                  >
                    Reintentar
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
