'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Cotizacion,
  CuotaFacturacionDetalle,
  MOTIVOS_RECHAZO_SALESFORCE,
  MotivoRechazoSalesforce,
} from '@/lib/types';
import {
  X,
  Trophy,
  XCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  Check,
} from 'lucide-react';

interface CierreOportunidadModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotizacion: Cotizacion;
  onSuccess: (updatedCotizacion: Cotizacion) => void;
}

export default function CierreOportunidadModal({
  isOpen,
  onClose,
  cotizacion,
  onSuccess,
}: CierreOportunidadModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<'ganada' | 'perdida'>('ganada');

  // Valores de Cierre Ganada
  const ufVal = cotizacion.ufValue || 38000;
  const originalUf = cotizacion.totalUf || 0;
  const originalClp = cotizacion.totalClp || Math.round(originalUf * ufVal);

  const [closingUf, setClosingUf] = useState<number>(originalUf);
  const [closingClp, setClosingClp] = useState<number>(originalClp);
  const [fechaCierre, setFechaCierre] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [cantidadCuotas, setCantidadCuotas] = useState<number>(() => (originalUf > 50 ? 2 : 1));
  const [fechaPrimeraFacturacion, setFechaPrimeraFacturacion] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });

  const [cuotas, setCuotas] = useState<CuotaFacturacionDetalle[]>([]);

  // Valores de Cierre Perdida
  const [motivoRechazo, setMotivoRechazo] = useState<string>('Competencia: Precio');
  const [observacionesPerdida, setObservacionesPerdida] = useState<string>('');

  // Estado de envío / resultado
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Al abrir el modal o cambiar cotizacion, inicializar campos
  useEffect(() => {
    if (isOpen && cotizacion) {
      const prevCierre = cotizacion.cierreNegocio;
      const initialUf = prevCierre?.montoCierreUf ?? cotizacion.totalUf ?? 0;
      const initialClp = prevCierre?.montoCierreClp ?? cotizacion.totalClp ?? Math.round(initialUf * ufVal);

      setClosingUf(initialUf);
      setClosingClp(initialClp);
      setFechaCierre(prevCierre?.fechaCierre || new Date().toISOString().split('T')[0]);
      
      const numCuotas = prevCierre?.cuotasFacturacion ?? (initialUf > 50 ? 2 : 1);
      setCantidadCuotas(numCuotas);
      
      const startFact = prevCierre?.fechaPrimeraFacturacion || (() => {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        return d.toISOString().split('T')[0];
      })();
      setFechaPrimeraFacturacion(startFact);

      if (prevCierre?.cuotasDetalle && prevCierre.cuotasDetalle.length > 0) {
        setCuotas(prevCierre.cuotasDetalle);
      } else {
        generarDistribucionCuotas(numCuotas, initialUf, initialClp, startFact);
      }

      if (prevCierre?.estado === 'Perdida') {
        setTab('perdida');
        setMotivoRechazo(prevCierre.motivoRechazo || 'Competencia: Precio');
        setObservacionesPerdida(prevCierre.observaciones || '');
      } else {
        setTab('ganada');
      }

      setErrorMessage(null);
      setSuccessResult(null);
    }
  }, [isOpen, cotizacion]);

  // Generador inteligente de propuesta de cuotas
  const generarDistribucionCuotas = (
    num: number,
    totalUfVal: number,
    totalClpVal: number,
    startDateStr: string
  ) => {
    const list: CuotaFacturacionDetalle[] = [];
    const baseDate = new Date(startDateStr || new Date().toISOString().split('T')[0]);
    const basePct = Number((100 / num).toFixed(2));
    const baseUf = Number((totalUfVal / num).toFixed(2));
    const baseClp = Math.floor(totalClpVal / num);

    let acumPct = 0;
    let acumUf = 0;
    let acumClp = 0;

    for (let i = 1; i <= num; i++) {
      const d = new Date(baseDate);
      d.setMonth(d.getMonth() + (i - 1));
      const fechaStr = d.toISOString().split('T')[0];

      const isLast = i === num;
      const pct = isLast ? Number((100 - acumPct).toFixed(2)) : basePct;
      const uf = isLast ? Number((totalUfVal - acumUf).toFixed(2)) : baseUf;
      const clp = isLast ? totalClpVal - acumClp : baseClp;

      acumPct += pct;
      acumUf += uf;
      acumClp += clp;

      list.push({
        numero: i,
        fecha: fechaStr,
        porcentaje: pct,
        montoUf: uf,
        montoClp: clp,
      });
    }

    setCuotas(list);
  };

  // Manejar cambio en monto de cierre UF
  const handleClosingUfChange = (newUf: number) => {
    setClosingUf(newUf);
    const newClp = Math.round(newUf * ufVal);
    setClosingClp(newClp);
    generarDistribucionCuotas(cantidadCuotas, newUf, newClp, fechaPrimeraFacturacion);
  };

  // Manejar cambio en monto de cierre CLP
  const handleClosingClpChange = (newClp: number) => {
    setClosingClp(newClp);
    const newUf = Number((newClp / ufVal).toFixed(2));
    setClosingUf(newUf);
    generarDistribucionCuotas(cantidadCuotas, newUf, newClp, fechaPrimeraFacturacion);
  };

  // Manejar cambio en cantidad de cuotas
  const handleCantidadCuotasChange = (num: number) => {
    setCantidadCuotas(num);
    generarDistribucionCuotas(num, closingUf, closingClp, fechaPrimeraFacturacion);
  };

  // Manejar cambio en fecha primera facturación
  const handleFechaInicioChange = (dateStr: string) => {
    setFechaPrimeraFacturacion(dateStr);
    // Reajustar fechas de las cuotas proporcionalmente
    const baseDate = new Date(dateStr);
    setCuotas((prev) =>
      prev.map((c, idx) => {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + idx);
        return {
          ...c,
          fecha: d.toISOString().split('T')[0],
        };
      })
    );
  };

  // Actualizar una cuota específica individualmente
  const handleUpdateCuotaField = (
    index: number,
    field: 'fecha' | 'porcentaje' | 'montoUf' | 'montoClp',
    value: any
  ) => {
    setCuotas((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'fecha') {
        target.fecha = value;
      } else if (field === 'porcentaje') {
        const pct = Math.max(0, Math.min(100, Number(value) || 0));
        target.porcentaje = pct;
        target.montoUf = Number(((closingUf * pct) / 100).toFixed(2));
        target.montoClp = Math.round((closingClp * pct) / 100);
      } else if (field === 'montoUf') {
        const uf = Math.max(0, Number(value) || 0);
        target.montoUf = uf;
        target.porcentaje = closingUf > 0 ? Number(((uf / closingUf) * 100).toFixed(2)) : 0;
        target.montoClp = Math.round(uf * ufVal);
      } else if (field === 'montoClp') {
        const clp = Math.max(0, Math.round(Number(value) || 0));
        target.montoClp = clp;
        target.montoUf = Number((clp / ufVal).toFixed(2));
        target.porcentaje = closingClp > 0 ? Number(((clp / closingClp) * 100).toFixed(2)) : 0;
      }

      copy[index] = target;
      return copy;
    });
  };

  // Botón para auto-cuadrar la última cuota con la diferencia restante
  const handleAutoAjustarUltimaCuota = () => {
    if (cuotas.length === 0) return;
    const n = cuotas.length;
    let sumUfExceptLast = 0;
    let sumClpExceptLast = 0;
    let sumPctExceptLast = 0;

    for (let i = 0; i < n - 1; i++) {
      sumUfExceptLast += cuotas[i].montoUf;
      sumClpExceptLast += cuotas[i].montoClp;
      sumPctExceptLast += cuotas[i].porcentaje;
    }

    const restUf = Number((closingUf - sumUfExceptLast).toFixed(2));
    const restClp = Math.round(closingClp - sumClpExceptLast);
    const restPct = Number((100 - sumPctExceptLast).toFixed(2));

    setCuotas((prev) => {
      const copy = [...prev];
      copy[n - 1] = {
        ...copy[n - 1],
        montoUf: Math.max(0, restUf),
        montoClp: Math.max(0, restClp),
        porcentaje: Math.max(0, restPct),
      };
      return copy;
    });
  };

  // Cálculos de balance
  const balance = useMemo(() => {
    const sumUf = cuotas.reduce((acc, c) => acc + (c.montoUf || 0), 0);
    const sumClp = cuotas.reduce((acc, c) => acc + (c.montoClp || 0), 0);
    const sumPct = cuotas.reduce((acc, c) => acc + (c.porcentaje || 0), 0);

    const diffUf = Number((closingUf - sumUf).toFixed(2));
    const diffClp = Math.round(closingClp - sumClp);
    const diffPct = Number((100 - sumPct).toFixed(2));

    const isCuadrado = Math.abs(diffUf) <= 0.05 && Math.abs(diffClp) <= 200 && Math.abs(diffPct) <= 0.1;

    return {
      sumUf: Number(sumUf.toFixed(2)),
      sumClp,
      sumPct: Number(sumPct.toFixed(2)),
      diffUf,
      diffClp,
      diffPct,
      isCuadrado,
    };
  }, [cuotas, closingUf, closingClp]);

  // Comparativa con cotización original
  const diffOriginalUf = Number((closingUf - originalUf).toFixed(2));
  const diffOriginalPct = originalUf > 0 ? Number(((diffOriginalUf / originalUf) * 100).toFixed(1)) : 0;

  // Enviar Cierre a Salesforce
  const handleSubmit = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      if (tab === 'ganada') {
        if (!balance.isCuadrado) {
          // Ajustar automáticamente antes de enviar para garantizar integridad
          handleAutoAjustarUltimaCuota();
        }

        const res = await fetch('/api/salesforce/cierre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'ganada',
            cotizacionId: cotizacion.id,
            closingUf,
            closingClp,
            fechaCierre,
            cantidadCuotas,
            fechaPrimeraFacturacion,
            cuotas,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Error registrando cierre en Salesforce.');
        }

        setSuccessResult(data.data);
        if (data.data?.cotizacion) {
          onSuccess(data.data.cotizacion);
        }
      } else {
        // Cierre Perdida
        const res = await fetch('/api/salesforce/cierre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'perdida',
            cotizacionId: cotizacion.id,
            fechaCierre,
            motivoRechazo,
            observaciones: observacionesPerdida,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Error registrando cierre de pérdida en Salesforce.');
        }

        setSuccessResult(data.data);
        if (data.data?.cotizacion) {
          onSuccess(data.data.cotizacion);
        }
      }
    } catch (err: any) {
      console.error('Error en cierre:', err);
      setErrorMessage(err?.message || 'Error de conexión con Salesforce.');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Ejecutiva */}
        <div className="px-6 py-4 border-b border-slate-100 bg-linear-to-r from-slate-50 via-white to-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-200/50">
              <Trophy className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Cierre Comercial de Oportunidad</h3>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70">
                  {cotizacion.code}
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-xl">
                {cotizacion.clientName} {cotizacion.projectName ? `• ${cotizacion.projectName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pantalla de Éxito */}
        {successResult ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              tab === 'ganada' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
            }`}>
              {tab === 'ganada' ? <Trophy className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            </div>
            <h4 className="text-xl font-bold text-slate-900">
              {tab === 'ganada' ? '¡Venta Cerrada y Cuotas Proyectadas con Éxito!' : 'Oportunidad Registrada como Perdida'}
            </h4>
            <p className="text-sm text-slate-600 max-w-md">
              {successResult.message}
            </p>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left w-full max-w-md space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Estado en Salesforce:</span>
                <span className={`font-bold ${tab === 'ganada' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {tab === 'ganada' ? 'Cerrada ganada' : 'Cerrada perdida'}
                </span>
              </div>
              {tab === 'ganada' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Monto Total de Cierre:</span>
                    <span className="font-bold text-slate-900 font-mono">
                      {closingUf} UF (~${closingClp.toLocaleString('es-CL')} CLP)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Cuotas Generadas en SF:</span>
                    <span className="font-bold text-blue-700 font-mono">
                      {cantidadCuotas} cuota(s) programada(s)
                    </span>
                  </div>
                </>
              )}
              {tab === 'perdida' && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Motivo del Rechazo:</span>
                  <span className="font-semibold text-rose-700">{motivoRechazo}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              {successResult.opportunityUrl && (
                <a
                  href={successResult.opportunityUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver Oportunidad en Salesforce</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Selector de Modo / Tabs */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTab('ganada')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    tab === 'ganada'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>🏆 Cerrada Ganada (Venta Adjudicada)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTab('perdida')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    tab === 'perdida'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>❌ Cerrada Perdida (No Adjudicada)</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-medium hidden sm:flex items-center gap-1">
                <span>Valor UF actual:</span>
                <span className="font-mono font-bold text-slate-700">${ufVal.toLocaleString('es-CL')}</span>
              </div>
            </div>

            {/* Contenido Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Error en la operación</p>
                    <p>{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* MODO 1: CERRADA GANADA */}
              {tab === 'ganada' && (
                <>
                  {/* SECCIÓN 1: MONTO DE CIERRE DE VENTA */}
                  <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          1. Monto Total de Cierre de Venta
                        </h4>
                      </div>
                      {diffOriginalUf === 0 ? (
                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                          Mismo monto cotizado (100%)
                        </span>
                      ) : diffOriginalUf < 0 ? (
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-amber-600" />
                          Descuento comercial ({diffOriginalUf} UF / {diffOriginalPct}%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                          Negociación al alza (+{diffOriginalUf} UF / +{diffOriginalPct}%)
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Si el cliente negoció o cerró por un monto distinto al de la propuesta original, ajuste el valor aquí. Se actualizará el <span className="font-semibold text-slate-700">Amount</span> y <span className="font-semibold text-slate-700">Monto_a_Facturar_UF__c</span> en Salesforce.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      {/* Referencia original */}
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex flex-col justify-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Cotización Original</span>
                        <span className="text-sm font-bold font-mono text-slate-700 mt-0.5">
                          {originalUf} UF
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          ~${originalClp.toLocaleString('es-CL')} CLP
                        </span>
                      </div>

                      {/* Monto de Cierre UF */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>Monto Cierre (UF) *</span>
                          <span className="text-[10px] font-normal text-slate-400">Editable</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={closingUf}
                            onChange={(e) => handleClosingUfChange(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">UF</span>
                        </div>
                      </div>

                      {/* Monto de Cierre CLP */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span>Monto Cierre (CLP) *</span>
                          <span className="text-[10px] font-normal text-slate-400">Editable</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="1000"
                            min="0"
                            value={closingClp}
                            onChange={(e) => handleClosingClpChange(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <span className="absolute right-3 top-2 text-[11px] font-bold text-slate-400">CLP</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2: PARÁMETROS DE CUOTAS */}
                  <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          2. Proyección de Facturación en Cuotas
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => generarDistribucionCuotas(cantidadCuotas, closingUf, closingClp, fechaPrimeraFacturacion)}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Restablecer cuotas a distribución equitativa"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Regenerar equitativamente</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Fecha de Cierre del Negocio */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Fecha Cierre de Negocio *</label>
                        <input
                          type="date"
                          value={fechaCierre}
                          onChange={(e) => setFechaCierre(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>

                      {/* Cantidad de Cuotas */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Cantidad de Cuotas *</label>
                        <select
                          value={cantidadCuotas}
                          onChange={(e) => handleCantidadCuotasChange(parseInt(e.target.value, 10))}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                        >
                          <option value="1">1 cuota (Pago único / 100%)</option>
                          <option value="2">2 cuotas (50% / 50%)</option>
                          <option value="3">3 cuotas (Mensuales)</option>
                          <option value="4">4 cuotas (Mensuales)</option>
                          <option value="5">5 cuotas (Mensuales)</option>
                          <option value="6">6 cuotas (Mensuales)</option>
                          <option value="8">8 cuotas (Mensuales)</option>
                          <option value="10">10 cuotas (Mensuales)</option>
                          <option value="12">12 cuotas (1 año)</option>
                        </select>
                      </div>

                      {/* Inicio de Pago (1ª Facturación) */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">1ª Facturación (Inicio) *</label>
                        <input
                          type="date"
                          value={fechaPrimeraFacturacion}
                          onChange={(e) => handleFechaInicioChange(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 3: TABLA DE CUOTAS EDITABLE Y VALIDACIÓN */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        3. Detalle de Cuotas a Ingresar en Salesforce (Cuota_de_facturacion__c)
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Puedes ajustar la fecha, porcentaje o montos de cada cuota
                      </span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[10px] uppercase">
                          <tr>
                            <th className="py-2 px-3 text-left w-16"># Cuota</th>
                            <th className="py-2 px-3 text-left">Fecha Estimada</th>
                            <th className="py-2 px-3 text-center w-28">% Distribución</th>
                            <th className="py-2 px-3 text-right w-36">Monto UF</th>
                            <th className="py-2 px-3 text-right w-44">Monto CLP</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {cuotas.map((c, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-2 px-3 font-mono font-bold text-slate-700">
                                Cuota {c.numero}
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="date"
                                  value={c.fecha}
                                  onChange={(e) => handleUpdateCuotaField(idx, 'fecha', e.target.value)}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={c.porcentaje}
                                    onChange={(e) => handleUpdateCuotaField(idx, 'porcentaje', e.target.value)}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-center text-slate-800 focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-bold">%</span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="relative">
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={c.montoUf}
                                    onChange={(e) => handleUpdateCuotaField(idx, 'montoUf', e.target.value)}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right text-slate-800 focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-bold">UF</span>
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <div className="relative">
                                  <span className="absolute left-2 top-1 text-[10px] text-slate-400 font-bold">$</span>
                                  <input
                                    type="number"
                                    step="100"
                                    min="0"
                                    value={c.montoClp}
                                    onChange={(e) => handleUpdateCuotaField(idx, 'montoClp', e.target.value)}
                                    className="w-full pl-5 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right text-slate-800 focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Fila de Totales y Balance */}
                        <tfoot className="bg-slate-50/90 border-t border-slate-200 font-bold text-xs">
                          <tr>
                            <td colSpan={2} className="py-2 px-3 text-slate-700">
                              Total Suma de Cuotas:
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              <span className={balance.sumPct === 100 ? 'text-emerald-700' : 'text-amber-700'}>
                                {balance.sumPct}%
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">
                              {balance.sumUf} UF
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-800">
                              ${balance.sumClp.toLocaleString('es-CL')}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Barra de Validación de Balance */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      balance.isCuadrado
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50/90 border-amber-200 text-amber-800'
                    }`}>
                      <div className="flex items-center gap-2 text-xs">
                        {balance.isCuadrado ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-semibold">
                              ✓ Balance Perfecto: Las cuotas suman exactamente el 100% del monto de cierre ({closingUf} UF / ${closingClp.toLocaleString('es-CL')} CLP).
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                            <div>
                              <span className="font-bold">Diferencia pendiente: </span>
                              <span className="font-mono">
                                {balance.diffUf > 0 ? `Faltan +${balance.diffUf} UF` : `Sobran ${balance.diffUf} UF`} (~${balance.diffClp.toLocaleString('es-CL')} CLP)
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {!balance.isCuadrado && (
                        <button
                          type="button"
                          onClick={handleAutoAjustarUltimaCuota}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition-colors shrink-0"
                        >
                          Ajustar en última cuota
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* MODO 2: CERRADA PERDIDA */}
              {tab === 'perdida' && (
                <div className="bg-rose-50/40 rounded-2xl p-5 border border-rose-200/80 space-y-4">
                  <div className="flex items-center gap-2 text-rose-800">
                    <XCircle className="w-5 h-5 text-rose-600" />
                    <h4 className="text-sm font-bold">
                      Registro de Pérdida u Oferta Desestimada en Salesforce
                    </h4>
                  </div>

                  <p className="text-xs text-slate-600">
                    Esta acción actualizará la Oportunidad en Salesforce a estado <span className="font-semibold text-rose-700">"Cerrada perdida"</span> y registrará el motivo oficial de rechazo para las estadísticas comerciales del IDIEM.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Fecha de Cierre */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">Fecha Cierre de Negocio *</label>
                      <input
                        type="date"
                        value={fechaCierre}
                        onChange={(e) => setFechaCierre(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                      />
                    </div>

                    {/* Motivo de Rechazo (Picklist Salesforce) */}
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">
                        Motivo del Rechazo (Salesforce) *
                      </label>
                      <select
                        value={motivoRechazo}
                        onChange={(e) => setMotivoRechazo(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                      >
                        {MOTIVOS_RECHAZO_SALESFORCE.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Observaciones Comerciales */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      Observaciones Comerciales / Comentarios del Cliente (Opcional)
                    </label>
                    <textarea
                      rows={3}
                      value={observacionesPerdida}
                      onChange={(e) => setObservacionesPerdida(e.target.value)}
                      placeholder="Ej. El cliente adjudicó a empresa competidora por menor plazo de entrega (5 días vs 10 días). Se mantiene contacto para fase 2."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pie con Acciones */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 transition-colors"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
                  tab === 'ganada'
                    ? 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
                    : 'bg-rose-600 hover:bg-rose-700 disabled:opacity-50'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sincronizando con Salesforce...</span>
                  </>
                ) : tab === 'ganada' ? (
                  <>
                    <Trophy className="w-4 h-4" />
                    <span>Confirmar y Cerrar Venta Ganada en Salesforce</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    <span>Confirmar Cierre Perdida en Salesforce</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

