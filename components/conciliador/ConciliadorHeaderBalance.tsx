'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  RefreshCw,
  Upload,
  Database,
  FileSpreadsheet,
  ShoppingCart,
  ArrowLeftRight,
  Ban,
  CheckCircle2,
  Building2,
  Scale,
  TrendingUp,
} from 'lucide-react';
import {
  ConciliacionResumen,
  FiltroCuentaComercial,
} from '@/lib/conciliador-types';

const MESES = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const DIVISIONES = ['DGL', 'DCH', 'DSCA', 'DIE', 'DIPC', 'DIM'];

export function formatClp(val: number): string {
  const abs = Math.abs(Math.round(val));
  const formatted = abs.toLocaleString('es-CL');
  return val < 0 ? `-$${formatted}` : `$${formatted}`;
}

interface ConciliadorHeaderBalanceProps {
  mes: number;
  anio: number;
  division: string;
  sourceMode: 'excel' | 'salesforce';
  filtroCuentaComercial: FiltroCuentaComercial;
  incluirTraspasosInternos: boolean;
  loading: boolean;
  resumen: ConciliacionResumen | null;
  stagingCount: number;
  customFileName?: string | null;
  onChangeMes: (mes: number) => void;
  onChangeAnio: (anio: number) => void;
  onChangeDivision: (div: string) => void;
  onChangeSourceMode: (mode: 'excel' | 'salesforce') => void;
  onChangeFiltroCuentaComercial: (filtro: FiltroCuentaComercial) => void;
  onToggleTraspasosInternos: (incluir: boolean) => void;
  onRefresh: () => void;
  onOpenUploadModal: () => void;
  onOpenStagingModal: () => void;
}

export default function ConciliadorHeaderBalance({
  mes,
  anio,
  division,
  sourceMode,
  filtroCuentaComercial,
  incluirTraspasosInternos,
  loading,
  resumen,
  stagingCount,
  customFileName,
  onChangeMes,
  onChangeAnio,
  onChangeDivision,
  onChangeSourceMode,
  onChangeFiltroCuentaComercial,
  onToggleTraspasosInternos,
  onRefresh,
  onOpenUploadModal,
  onOpenStagingModal,
}: ConciliadorHeaderBalanceProps) {
  const mesLabel = MESES.find((m) => m.value === mes)?.label || `Mes ${mes}`;

  // Totales según si se incluyen o aíslan Traspasos Internos (TI)
  const tiEerrClp = resumen?.montoTraspasosInternosClp ?? 0;
  const tiSfClp = resumen?.montoTraspasosInternosSfClp ?? 0;

  const totalEerrClp = resumen
    ? incluirTraspasosInternos
      ? (resumen.totalEerrVentaExternaClp ?? resumen.totalEerrClp) + tiEerrClp
      : (resumen.totalEerrVentaExternaClp ?? resumen.totalEerrClp)
    : 0;

  const totalSfClp = resumen
    ? incluirTraspasosInternos
      ? (resumen.totalSfVentaExternaClp ?? resumen.totalSalesforceClp) + tiSfClp
      : (resumen.totalSfVentaExternaClp ?? resumen.totalSalesforceClp)
    : 0;

  const brechaClp = totalEerrClp - totalSfClp;
  const brechaUf = Math.round((brechaClp / 38500) * 100) / 100;
  const pctCuadratura = resumen?.porcentajeCuadratura ?? 0;

  const maxBar = Math.max(totalEerrClp, totalSfClp, 1);
  const eerrBarWidth = Math.min(100, Math.round((totalEerrClp / maxBar) * 100));
  const sfBarWidth = Math.min(100, Math.round((totalSfClp / maxBar) * 100));

  return (
    <div className="space-y-4">
      {/* Barra superior de navegación y selectores de contexto */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <Link
              href="/ventas"
              className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shrink-0"
              title="Volver al Hub Comercial"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                  Conciliador EERR vs Salesforce
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                  Motor v2.0 N:M
                </span>
                {customFileName && (
                  <span className="px-2 py-0.5 text-[11px] font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 truncate max-w-[220px]">
                    {customFileName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cruce multicriterio determinista, resolución Subset-Sum, aislamiento de TI/NC y escritura auditable en Salesforce
              </p>
            </div>
          </div>

          {/* Controles de Período, División, Fuente y Carrito */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector División */}
            <select
              value={division}
              onChange={(e) => onChangeDivision(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DIVISIONES.map((d) => (
                <option key={d} value={d}>
                  División {d}
                </option>
              ))}
            </select>

            {/* Selector Mes */}
            <select
              value={mes}
              onChange={(e) => onChangeMes(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Selector Año */}
            <select
              value={anio}
              onChange={(e) => onChangeAnio(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            {/* Toggle Fuente: Excel vs Salesforce Live */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
              <button
                type="button"
                onClick={() => onChangeSourceMode('excel')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  sourceMode === 'excel'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Planilla
              </button>
              <button
                type="button"
                onClick={() => onChangeSourceMode('salesforce')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  sourceMode === 'salesforce'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-blue-600" />
                SF Live
              </button>
            </div>

            {/* Subir Excel */}
            <button
              type="button"
              onClick={onOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Cargar Excel
            </button>

            {/* Refrescar */}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-50 transition-colors"
              title="Recalcular cruce"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Botón Carrito de Cambios (Staging Cart) */}
            <button
              type="button"
              onClick={onOpenStagingModal}
              className={`relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-xs ${
                stagingCount > 0
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Staging SF</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[11px] font-bold ${
                  stagingCount > 0
                    ? 'bg-white text-blue-700'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {stagingCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Balance Dual + Indicadores de Aislamiento Contable */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Col 1-4: Total Contable EERR */}
          <div className="md:col-span-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Facturación Contable EERR ({mesLabel} {anio})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {incluirTraspasosInternos ? 'Venta Externa + TI' : 'Venta Externa Neta'}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {formatClp(totalEerrClp)}
              </span>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                ~{(totalEerrClp / 38500).toFixed(1)} UF
              </span>
            </div>
            <div className="mt-2 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${eerrBarWidth}%` }}
              />
            </div>
          </div>

          {/* Col 5-8: Total Proyectado Salesforce */}
          <div className="md:col-span-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Forecast Proyectado Salesforce ({division})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                Cuotas del Período
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                {formatClp(totalSfClp)}
              </span>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                ~{(totalSfClp / 38500).toFixed(1)} UF
              </span>
            </div>
            <div className="mt-2 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${sfBarWidth}%` }}
              />
            </div>
          </div>

          {/* Col 9-12: Brecha Neta y Progreso de Conciliación */}
          <div className="md:col-span-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                Brecha Neta (EERR - SF)
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  Math.abs(brechaClp) <= 2000
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : brechaClp > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                {pctCuadratura}% Conciliado
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span
                className={`text-xl sm:text-2xl font-bold tabular-nums ${
                  Math.abs(brechaClp) <= 2000
                    ? 'text-emerald-600'
                    : brechaClp > 0
                    ? 'text-amber-600'
                    : 'text-rose-600'
                }`}
              >
                {brechaClp > 0 ? `+${formatClp(brechaClp)}` : formatClp(brechaClp)}
              </span>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {brechaUf > 0 ? `+${brechaUf}` : brechaUf} UF
              </span>
            </div>
            <div className="mt-2 w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  pctCuadratura >= 80
                    ? 'bg-emerald-600'
                    : pctCuadratura >= 50
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, pctCuadratura))}%` }}
              />
            </div>
          </div>
        </div>

        {/* Barra inferior de higiene contable: Switch TI, Badge NC y Filtro Cuentas Comerciales */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Switch Traspasos Internos (TI) */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={incluirTraspasosInternos}
                onChange={(e) => onToggleTraspasosInternos(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <ArrowLeftRight className="w-3.5 h-3.5 text-purple-600" />
              <span className="font-medium text-slate-700">
                Incluir Traspasos Internos (TI):
              </span>
              <span className="font-bold text-slate-900 tabular-nums">
                {resumen?.conteoTraspasosInternos ?? 0} reg. ({formatClp(tiEerrClp)})
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold">
                {incluirTraspasosInternos ? 'Incluidos' : 'Aislados de KPIs'}
              </span>
            </label>

            {/* Badge informativo de Facturas Anuladas por NC */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700">
              <Ban className="w-3.5 h-3.5 text-rose-500" />
              <span className="font-medium">Neteo Facturas + NC:</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {resumen?.conteoAnuladosNc ?? 0} grupos
              </span>
              {Boolean(resumen?.montoAnuladosNcClp) && (
                <span className="text-slate-500 tabular-nums">
                  ({formatClp(resumen?.montoAnuladosNcClp ?? 0)} bruto → Efecto $0)
                </span>
              )}
            </div>
          </div>

          {/* Filtro Cuentas Comerciales (Corporativas vs Regulares) */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              Cuentas Corporativas:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
              {(
                [
                  { id: 'todas', label: 'Todas' },
                  { id: 'excluir', label: 'Sin C. Comerciales' },
                  { id: 'solo', label: 'Solo C. Comerciales' },
                ] as { id: FiltroCuentaComercial; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeFiltroCuentaComercial(opt.id)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all ${
                    filtroCuentaComercial === opt.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

