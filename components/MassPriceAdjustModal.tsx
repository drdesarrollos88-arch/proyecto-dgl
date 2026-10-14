'use client';

import React, { useState, useMemo } from 'react';
import { TarifarioItem } from '@/lib/types';
import {
  X,
  Percent,
  Calculator,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  Sliders,
  RotateCcw,
} from 'lucide-react';

interface MassPriceAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: TarifarioItem[];
  onApplyDraft: (updates: Record<string, string>) => void;
  onSaveDirectly: (updates: Array<{ id: string; ufPrice: number }>, percentSummary: string) => Promise<boolean>;
}

export default function MassPriceAdjustModal({
  isOpen,
  onClose,
  selectedItems,
  onApplyDraft,
  onSaveDirectly,
}: MassPriceAdjustModalProps) {
  // Mode: increase (+) or decrease (-)
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [percentValue, setPercentValue] = useState<string>('5');
  const [roundingMode, setRoundingMode] = useState<'2dec' | '0dec' | '3dec' | '4dec'>('2dec');
  const [previewSearch, setPreviewSearch] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Common quick presets
  const presets = [
    { label: '+3%', val: 3, dir: 'increase' as const },
    { label: '+5%', val: 5, dir: 'increase' as const },
    { label: '+7%', val: 7, dir: 'increase' as const },
    { label: '+8%', val: 8, dir: 'increase' as const },
    { label: '+10%', val: 10, dir: 'increase' as const },
    { label: '+12%', val: 12, dir: 'increase' as const },
    { label: '+15%', val: 15, dir: 'increase' as const },
    { label: '-3%', val: 3, dir: 'decrease' as const },
    { label: '-5%', val: 5, dir: 'decrease' as const },
    { label: '-10%', val: 10, dir: 'decrease' as const },
  ];

  // Calculated percentage numeric
  const numericPercent = useMemo(() => {
    const parsed = parseFloat(percentValue.replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) return 0;
    return parsed;
  }, [percentValue]);

  // Rounding helper
  const roundPrice = (val: number): number => {
    switch (roundingMode) {
      case '0dec':
        return Math.round(val);
      case '3dec':
        return Math.round(val * 1000) / 1000;
      case '4dec':
        return Math.round(val * 10000) / 10000;
      case '2dec':
      default:
        return Math.round(val * 100) / 100;
    }
  };

  // Compute calculated changes for each selected item
  const calculations = useMemo(() => {
    const factor = direction === 'increase' ? 1 + numericPercent / 100 : Math.max(0, 1 - numericPercent / 100);

    return selectedItems.map((item) => {
      const oldPrice = item.ufPrice;
      const rawNewPrice = oldPrice * factor;
      const newPrice = roundPrice(rawNewPrice);
      const diff = newPrice - oldPrice;
      const actualPct = oldPrice > 0 ? (diff / oldPrice) * 100 : 0;

      return {
        item,
        oldPrice,
        newPrice,
        diff,
        actualPct,
      };
    });
  }, [selectedItems, direction, numericPercent, roundingMode]);

  // Summary statistics
  const stats = useMemo(() => {
    if (calculations.length === 0) {
      return { totalOld: 0, totalNew: 0, avgOld: 0, avgNew: 0, diffTotal: 0 };
    }
    const totalOld = calculations.reduce((acc, c) => acc + c.oldPrice, 0);
    const totalNew = calculations.reduce((acc, c) => acc + c.newPrice, 0);
    const avgOld = totalOld / calculations.length;
    const avgNew = totalNew / calculations.length;
    const diffTotal = totalNew - totalOld;

    return { totalOld, totalNew, avgOld, avgNew, diffTotal };
  }, [calculations]);

  // Filtered preview items
  const filteredPreview = useMemo(() => {
    const q = previewSearch.toLowerCase().trim();
    if (!q) return calculations;
    return calculations.filter(
      (c) =>
        (c.item.code && c.item.code.toLowerCase().includes(q)) ||
        (c.item.designation && c.item.designation.toLowerCase().includes(q)) ||
        (c.item.category && c.item.category.toLowerCase().includes(q)) ||
        (c.item.cc && c.item.cc.toLowerCase().includes(q))
    );
  }, [calculations, previewSearch]);

  if (!isOpen) return null;

  // Handle Preset Selection
  const applyPreset = (preset: typeof presets[0]) => {
    setDirection(preset.dir);
    setPercentValue(preset.val.toString());
  };

  // Apply to Draft
  const handleApplyDraft = () => {
    const updates: Record<string, string> = {};
    calculations.forEach((c) => {
      updates[c.item.id] = c.newPrice.toString();
    });
    onApplyDraft(updates);
    onClose();
  };

  // Direct Save
  const handleDirectSave = async () => {
    if (calculations.length === 0) return;
    setIsSaving(true);
    setSaveError(null);

    const sign = direction === 'increase' ? '+' : '-';
    const percentSummary = `${sign}${numericPercent}%`;

    const updates = calculations.map((c) => ({
      id: c.item.id,
      ufPrice: c.newPrice,
    }));

    try {
      const ok = await onSaveDirectly(updates, percentSummary);
      if (ok) {
        onClose();
      } else {
        setSaveError('No se pudieron guardar los precios. Por favor intenta de nuevo.');
      }
    } catch (err: any) {
      setSaveError(err.message || 'Error de conexión al guardar los precios.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-xs border border-white/20">
              <Percent className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                Ajuste Masivo de Precios por Porcentaje
                <span className="text-xs bg-amber-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full">
                  {selectedItems.length} {selectedItems.length === 1 ? 'ensayo' : 'ensayos'}
                </span>
              </h2>
              <p className="text-xs text-blue-200">
                Aplica un porcentaje de incremento o descuento a los ensayos seleccionados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700 flex-1">
          {/* Top Controls Box: Percentage, Direction, Presets, Rounding */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3.5">
            {/* Direction & Percentage Input */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Direction Toggle */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Tipo de Reajuste
                </label>
                <div className="grid grid-cols-2 p-1 bg-white border border-slate-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDirection('increase')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                      direction === 'increase'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Aumento (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('decrease')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                      direction === 'decrease'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Rebaja (-)</span>
                  </button>
                </div>
              </div>

              {/* Percentage Input */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Porcentaje (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1000"
                    value={percentValue}
                    onChange={(e) => setPercentValue(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-sm font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                    placeholder="5.0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                    %
                  </span>
                </div>
              </div>

              {/* Rounding Mode */}
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-slate-500" />
                  <span>Redondeo</span>
                </label>
                <select
                  value={roundingMode}
                  onChange={(e: any) => setRoundingMode(e.target.value)}
                  className="w-full py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                >
                  <option value="2dec">2 decimales (Estándar UF, ej: 3.45)</option>
                  <option value="0dec">Sin decimales (Entero, ej: 3.00)</option>
                  <option value="3dec">3 decimales (ej: 3.456)</option>
                  <option value="4dec">4 decimales (ej: 3.4560)</option>
                </select>
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">
                Porcentajes rápidos predefinidos:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {presets.map((p) => {
                  const isSelected = direction === p.dir && numericPercent === p.val;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? p.dir === 'increase'
                            ? 'bg-emerald-600 text-white shadow-xs scale-105'
                            : 'bg-red-600 text-white shadow-xs scale-105'
                          : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-blue-700">Ensayos Seleccionados</div>
              <div className="text-lg font-black text-blue-950 mt-0.5">{selectedItems.length}</div>
              <div className="text-[10px] text-blue-600 font-medium">a modificar</div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-slate-500">Tarifa Promedio Actual</div>
              <div className="text-lg font-mono font-bold text-slate-800 mt-0.5">
                UF {stats.avgOld.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Total: UF {stats.totalOld.toFixed(2)}</div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="text-[10px] uppercase font-bold text-emerald-800">Nueva Tarifa Promedio</div>
              <div className="text-lg font-mono font-black text-emerald-900 mt-0.5">
                UF {stats.avgNew.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-700 font-mono">Total: UF {stats.totalNew.toFixed(2)}</div>
            </div>

            <div
              className={`p-3 border rounded-xl ${
                stats.diffTotal >= 0
                  ? 'bg-emerald-50/40 border-emerald-300 text-emerald-900'
                  : 'bg-red-50/40 border-red-300 text-red-900'
              }`}
            >
              <div className="text-[10px] uppercase font-bold">Variación Neta</div>
              <div className="text-lg font-mono font-black mt-0.5 flex items-center gap-1">
                <span>{stats.diffTotal >= 0 ? '+' : ''}{stats.diffTotal.toFixed(2)} UF</span>
              </div>
              <div className="text-[10px] font-bold">
                {direction === 'increase' ? '+' : '-'}{numericPercent}% aplicado
              </div>
            </div>
          </div>

          {/* Live Preview Section */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <div className="px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-bold text-slate-800 text-xs">
                  Vista Previa de Precios ({calculations.length} ítems)
                </span>
              </div>
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar en la vista previa..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="max-h-[220px] overflow-y-auto overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 w-16 text-center">Cód.</th>
                    <th className="py-2 px-3">Ensayo / Designación</th>
                    <th className="py-2 px-3 w-28">Centro de Costo</th>
                    <th className="py-2 px-3 w-24 text-right">Precio Actual</th>
                    <th className="py-2 px-3 w-28 text-right bg-emerald-50/50">Nuevo Precio</th>
                    <th className="py-2 px-3 w-24 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No hay ensayos que coincidan con el filtro en la vista previa.
                      </td>
                    </tr>
                  ) : (
                    filteredPreview.map((c) => (
                      <tr key={c.item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-1.5 px-3 font-mono font-semibold text-center text-slate-500">
                          {c.item.code || '-'}
                        </td>
                        <td className="py-1.5 px-3 font-medium text-slate-900 truncate max-w-[260px]">
                          {c.item.designation}
                        </td>
                        <td className="py-1.5 px-3 text-[10px] text-slate-500 truncate max-w-[120px]">
                          {c.item.cc?.split('-')[0]?.trim() || '-'}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-500">
                          UF {c.oldPrice.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                          UF {c.newPrice.toFixed(roundingMode === '0dec' ? 0 : 2)}
                        </td>
                        <td
                          className={`py-1.5 px-3 text-right font-mono text-[11px] font-bold ${
                            c.diff >= 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {c.diff >= 0 ? '+' : ''}
                          {c.diff.toFixed(2)} UF
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Error Message if any */}
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{saveError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {/* Option 1: Load to Draft / Edit Mode in Table */}
            <button
              type="button"
              onClick={handleApplyDraft}
              disabled={isSaving || calculations.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="Carga los nuevos precios en la tabla para revisarlos antes de confirmar"
            >
              <span>Revisar en Tabla (Modo Edición)</span>
            </button>

            {/* Option 2: Direct Save */}
            <button
              type="button"
              onClick={handleDirectSave}
              disabled={isSaving || calculations.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando precios...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Guardar Oficialmente ({direction === 'increase' ? '+' : '-'}{numericPercent}%)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

