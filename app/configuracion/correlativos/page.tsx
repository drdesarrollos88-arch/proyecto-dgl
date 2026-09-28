'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { CENTROS_DE_COSTO, CorrelativoConfig, SessionUser } from '@/lib/types';
import {
  Hash,
  Save,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Settings,
  HelpCircle,
  Building,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

export default function CorrelativosPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<CorrelativoConfig>({
    defaultInitialNumber: 598,
    sequences: {
      '2339': 598,
      '1817': 579,
      '2340': 100,
      '2341': 588,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});

    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/configuracion/correlativos');
      if (res.ok) {
        const data = await res.json();
        if (data?.config) {
          setConfig(data.config);
        }
      }
    } catch (err) {
      console.error('Error loading correlativo config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/configuracion/correlativos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al guardar la configuración.');
      }

      setStatusMessage({
        type: 'success',
        text: '¡Configuración de correlativos actualizada exitosamente! Las próximas cotizaciones iniciarán con la nueva secuencia.',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Error al guardar la configuración.',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSequence = (ccNum: string, val: number) => {
    setConfig((prev) => ({
      ...prev,
      sequences: {
        ...prev.sequences,
        [ccNum]: Math.max(1, isNaN(val) ? 1 : val),
      },
    }));
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 sm:px-6">
        {/* Header Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <Link href="/configuracion/tarifario" className="hover:text-red-700 transition-colors flex items-center gap-1">
                <Settings className="w-3.5 h-3.5" />
                <span>Configuración</span>
              </Link>
              <span>/</span>
              <span className="text-red-700">Correlativos Oficiales DGL</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <Hash className="w-6 h-6 text-red-700" />
              <span>Correlativos y Numeración de Cotizaciones</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Controla la numeración consecutiva oficial de propuestas comerciales por Centro de Costo (CC) y año calendario.
              Permite sincronizar con el número actual del sistema manual externo (ej. <span className="font-semibold text-slate-700">0598</span>).
            </p>
          </div>

          <Link
            href="/cotizaciones"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver a Cotizaciones</span>
          </Link>
        </div>

        {/* Status Message Alert */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        )}

        {/* Informative Callout */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-900 flex items-start gap-3">
          <HelpCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">
              Regla de Correlatividad Administrativa IDIEM:
            </p>
            <p className="text-amber-800">
              Cada propuesta generada se codifica como <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono font-bold">PR.DGL.[CC].[AÑO].[NÚMERO]</code>.
              Al guardar una nueva cotización oficial, el sistema incrementa automáticamente el correlativo para que nunca existan números repetidos ni saltos involuntarios.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-red-600 mb-2" />
            <p className="text-xs">Cargando configuración de correlativos...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Main Config Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building className="w-4 h-4 text-red-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Siguiente Correlativo por Centro de Costo (Año {currentYear})
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Valores activos en base de datos
                </span>
              </div>

              <div className="p-6 divide-y divide-slate-100">
                {CENTROS_DE_COSTO.map((cc) => {
                  const match = cc.match(/^(\d{4})/);
                  const ccNum = match ? match[1] : '2339';
                  const currentVal = config.sequences[ccNum] !== undefined
                    ? config.sequences[ccNum]
                    : config.defaultInitialNumber || 598;
                  const formattedNum = String(currentVal).padStart(4, '0');
                  const previewCode = `PR.DGL.${ccNum}.${currentYear}.${formattedNum}`;

                  return (
                    <div
                      key={cc}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800">
                            {cc}
                          </span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-1.5 py-0.5 rounded border border-slate-200">
                            CC {ccNum}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <span>Próximo código oficial:</span>
                          <code className="text-xs font-mono font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                            {previewCode}
                          </code>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="text-xs text-slate-600 whitespace-nowrap">
                          Siguiente N°:
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99999}
                          value={currentVal}
                          onChange={(e) => updateSequence(ccNum, parseInt(e.target.value, 10))}
                          className="w-28 text-center text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-slate-50 focus:bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Default Global Starting Number */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Número Inicial por Defecto (Fallback global)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Se utiliza si en el futuro se crea un nuevo Centro de Costo no configurado previamente.
                  </p>
                </div>
                <input
                  type="number"
                  min={1}
                  max={99999}
                  value={config.defaultInitialNumber}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      defaultInitialNumber: Math.max(1, parseInt(e.target.value, 10) || 1),
                    }))
                  }
                  className="w-28 text-center text-xs font-bold font-mono px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Save Button Row */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando cambios...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Configuración de Correlativos</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

