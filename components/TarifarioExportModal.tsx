'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CENTROS_DE_COSTO, TarifarioItem, TarifarioCategoryStructure } from '@/lib/types';
import {
  FileSpreadsheet,
  Download,
  X,
  ChevronRight,
  ChevronDown,
  CheckSquare,
  Square,
  MinusSquare,
  Search,
  Layers,
  FolderTree,
  Building,
  Check,
  AlertCircle,
} from 'lucide-react';

// Natural Roman Numeral & hierarchical sort
function parseRomanOrNum(str: string): number[] {
  const romanMap: Record<string, number> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
    XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20,
  };

  const match = str.trim().match(/^([IVXLCDM]+|\d+)(?:\.([IVXLCDM]+|\d+))?(?:\.([IVXLCDM]+|\d+))?/i);
  if (!match) return [999];

  return match.slice(1).filter(Boolean).map((part) => {
    const upper = part.toUpperCase();
    if (romanMap[upper]) return romanMap[upper];
    const n = parseInt(part, 10);
    return isNaN(n) ? 999 : n;
  });
}

function compareHierarchical(a: string, b: string): number {
  const partsA = parseRomanOrNum(a);
  const partsB = parseRomanOrNum(b);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
}

interface TarifarioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems?: TarifarioItem[];
}

export default function TarifarioExportModal({
  isOpen,
  onClose,
  initialItems,
}: TarifarioExportModalProps) {
  const [items, setItems] = useState<TarifarioItem[]>(initialItems || []);
  const [structure, setStructure] = useState<TarifarioCategoryStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Set of selected leaf keys: `${cc}:::${category}:::${subcategory}`
  const [selectedLeaves, setSelectedLeaves] = useState<Set<string>>(new Set());

  // Expand/collapse states
  const [expandedCcs, setExpandedCcs] = useState<Record<string, boolean>>({
    [CENTROS_DE_COSTO[0]]: true, // first CC expanded by default
  });
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});

  // Search filter inside modal
  const [filterText, setFilterText] = useState('');

  // Option: Separate sheets per CC
  const [separateSheets, setSeparateSheets] = useState(false);

  // Load items and structure
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const promises: [Promise<any>, Promise<any>] = [
          initialItems && initialItems.length > 0
            ? Promise.resolve({ items: initialItems })
            : fetch('/api/tarifario').then((r) => r.json()),
          fetch('/api/tarifario/estructura').then((r) => r.json()),
        ];

        const [itemsData, structData] = await Promise.all(promises);

        const loadedItems: TarifarioItem[] = itemsData.items || [];
        setItems(loadedItems);

        const loadedStruct: TarifarioCategoryStructure[] = structData.structure || [];
        setStructure(loadedStruct);

        // Collect all leaf keys
        const allLeaves = new Set<string>();

        // From structure
        loadedStruct.forEach((s) => {
          if (s.subcategories && s.subcategories.length > 0) {
            s.subcategories.forEach((sub) => {
              allLeaves.add(`${s.cc}:::${s.category}:::${sub}`);
            });
          } else {
            allLeaves.add(`${s.cc}:::${s.category}:::`);
          }
        });

        // From items (to make sure no item is missed)
        loadedItems.forEach((it) => {
          if (it.cc && it.category) {
            allLeaves.add(`${it.cc}:::${it.category}:::${it.subcategory || ''}`);
          }
        });

        // Default: Select all leaves
        setSelectedLeaves(allLeaves);
      } catch (err) {
        console.error('Error cargando estructura para exportación:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, initialItems]);

  // Build the hierarchical tree model
  const tree = useMemo(() => {
    // Map: CC -> Map<Category, Set<Subcategory>>
    const ccMap = new Map<string, Map<string, Set<string>>>();

    CENTROS_DE_COSTO.forEach((cc) => {
      ccMap.set(cc, new Map<string, Set<string>>());
    });

    // Populate from structure
    structure.forEach((s) => {
      if (!ccMap.has(s.cc)) ccMap.set(s.cc, new Map<string, Set<string>>());
      const catMap = ccMap.get(s.cc)!;
      if (!catMap.has(s.category)) catMap.set(s.category, new Set<string>());
      const subSet = catMap.get(s.category)!;
      (s.subcategories || []).forEach((sub) => subSet.add(typeof sub === 'string' ? sub : sub.name));
    });

    // Populate from items
    items.forEach((it) => {
      if (!ccMap.has(it.cc)) ccMap.set(it.cc, new Map<string, Set<string>>());
      const catMap = ccMap.get(it.cc)!;
      if (!catMap.has(it.category)) catMap.set(it.category, new Set<string>());
      if (it.subcategory) {
        catMap.get(it.category)!.add(it.subcategory);
      }
    });

    // Compute item counts per leaf, category, CC
    const leafCounts = new Map<string, number>();
    const catCounts = new Map<string, number>();
    const ccCounts = new Map<string, number>();

    items.forEach((it) => {
      const leafKey = `${it.cc}:::${it.category}:::${it.subcategory || ''}`;
      leafCounts.set(leafKey, (leafCounts.get(leafKey) || 0) + 1);

      const catKey = `${it.cc}:::${it.category}`;
      catCounts.set(catKey, (catCounts.get(catKey) || 0) + 1);

      ccCounts.set(it.cc, (ccCounts.get(it.cc) || 0) + 1);
    });

    // Format tree
    const result = CENTROS_DE_COSTO.map((cc) => {
      const catMap = ccMap.get(cc) || new Map<string, Set<string>>();
      const categories = Array.from(catMap.keys())
        .sort(compareHierarchical)
        .map((category) => {
          const subcategories = Array.from(catMap.get(category) || []).sort(compareHierarchical);
          return {
            category,
            subcategories,
            count: catCounts.get(`${cc}:::${category}`) || 0,
          };
        });

      return {
        cc,
        categories,
        count: ccCounts.get(cc) || 0,
      };
    });

    return { nodes: result, leafCounts };
  }, [structure, items]);

  // Leaf keys helper
  const getAllLeavesForCategory = (cc: string, category: string, subcategories: string[]) => {
    if (subcategories.length === 0) {
      return [`${cc}:::${category}:::`];
    }
    return subcategories.map((sub) => `${cc}:::${category}:::${sub}`);
  };

  const getAllLeavesForCc = (ccNode: { cc: string; categories: { category: string; subcategories: string[] }[] }) => {
    const leaves: string[] = [];
    ccNode.categories.forEach((cat) => {
      leaves.push(...getAllLeavesForCategory(ccNode.cc, cat.category, cat.subcategories));
    });
    return leaves;
  };

  // State checks: 'all' | 'some' | 'none'
  const getCategoryState = (cc: string, category: string, subcategories: string[]) => {
    const leaves = getAllLeavesForCategory(cc, category, subcategories);
    if (leaves.length === 0) return 'none';
    const selectedCount = leaves.filter((l) => selectedLeaves.has(l)).length;
    if (selectedCount === leaves.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  };

  const getCcState = (ccNode: { cc: string; categories: { category: string; subcategories: string[] }[] }) => {
    const leaves = getAllLeavesForCc(ccNode);
    if (leaves.length === 0) return 'none';
    const selectedCount = leaves.filter((l) => selectedLeaves.has(l)).length;
    if (selectedCount === leaves.length) return 'all';
    if (selectedCount > 0) return 'some';
    return 'none';
  };

  // Toggle handlers
  const handleToggleLeaf = (leafKey: string) => {
    setSelectedLeaves((prev) => {
      const next = new Set(prev);
      if (next.has(leafKey)) {
        next.delete(leafKey);
      } else {
        next.add(leafKey);
      }
      return next;
    });
  };

  const handleToggleCategory = (cc: string, category: string, subcategories: string[]) => {
    const leaves = getAllLeavesForCategory(cc, category, subcategories);
    const currentState = getCategoryState(cc, category, subcategories);

    setSelectedLeaves((prev) => {
      const next = new Set(prev);
      if (currentState === 'all') {
        leaves.forEach((l) => next.delete(l));
      } else {
        leaves.forEach((l) => next.add(l));
      }
      return next;
    });
  };

  const handleToggleCc = (ccNode: { cc: string; categories: { category: string; subcategories: string[] }[] }) => {
    const leaves = getAllLeavesForCc(ccNode);
    const currentState = getCcState(ccNode);

    setSelectedLeaves((prev) => {
      const next = new Set(prev);
      if (currentState === 'all') {
        leaves.forEach((l) => next.delete(l));
      } else {
        leaves.forEach((l) => next.add(l));
      }
      return next;
    });
  };

  // Select all / none
  const handleSelectAll = () => {
    const all = new Set<string>();
    tree.nodes.forEach((ccNode) => {
      getAllLeavesForCc(ccNode).forEach((l) => all.add(l));
    });
    setSelectedLeaves(all);
  };

  const handleDeselectAll = () => {
    setSelectedLeaves(new Set());
  };

  // Expand / collapse all
  const handleExpandAll = () => {
    const ccs: Record<string, boolean> = {};
    const cats: Record<string, boolean> = {};
    tree.nodes.forEach((ccNode) => {
      ccs[ccNode.cc] = true;
      ccNode.categories.forEach((cat) => {
        cats[`${ccNode.cc}:::${cat.category}`] = true;
      });
    });
    setExpandedCcs(ccs);
    setExpandedCats(cats);
  };

  const handleCollapseAll = () => {
    setExpandedCcs({});
    setExpandedCats({});
  };

  // Total matching essays to export
  const matchingEssaysCount = useMemo(() => {
    return items.filter((it) =>
      selectedLeaves.has(`${it.cc}:::${it.category}:::${it.subcategory || ''}`)
    ).length;
  }, [items, selectedLeaves]);

  // Execute export download
  const handleExportDownload = async () => {
    if (matchingEssaysCount === 0) {
      alert('No hay ensayos seleccionados para descargar.');
      return;
    }

    setDownloading(true);
    try {
      // Build selected combinations
      const selectedCombinations = Array.from(selectedLeaves).map((leafKey) => {
        const [cc, category, subcategory] = leafKey.split(':::');
        return {
          cc,
          category,
          subcategory: subcategory || undefined,
        };
      });

      const res = await fetch('/api/tarifario/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedCombinations,
          separateSheets,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al exportar la planilla Excel.');
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get('content-disposition');
      let filename = 'TARIFADO_OFICIAL_DGL.xlsx';

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Trigger browser download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      onClose();
    } catch (err: any) {
      console.error('Export error:', err);
      alert(err.message || 'Error al descargar el archivo Excel.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Descarga Personalizada de Tarifario en Excel
              </h3>
              <p className="text-[11px] text-slate-500">
                Selecciona con precisión los Centros de Costo, Categorías y Subcategorías que deseas incluir
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="px-6 py-3 border-b border-slate-100 bg-white space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search within tree */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Filtrar categorías o subcategorías en el árbol..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent"
              />
              {filterText && (
                <button
                  onClick={() => setFilterText('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Selection quick actions */}
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 shrink-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="hover:text-emerald-700 hover:underline cursor-pointer"
              >
                Seleccionar Todo
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="hover:text-red-700 hover:underline cursor-pointer"
              >
                Deseleccionar Todo
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleExpandAll}
                className="hover:text-blue-700 hover:underline cursor-pointer"
              >
                Expandir
              </button>
              <span className="text-slate-300">/</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="hover:text-blue-700 hover:underline cursor-pointer"
              >
                Colapsar
              </button>
            </div>
          </div>
        </div>

        {/* Tree Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 scrollbar-thin">
          {loading ? (
            <div className="py-12 text-center">
              <div className="inline-block w-7 h-7 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs text-slate-500">Cargando árbol de selección...</p>
            </div>
          ) : (
            tree.nodes.map((ccNode) => {
              const ccState = getCcState(ccNode);
              const isCcExpanded = !!expandedCcs[ccNode.cc];

              // Filter check
              const filteredCategories = ccNode.categories.filter((cat) => {
                if (!filterText.trim()) return true;
                const q = filterText.toLowerCase();
                return (
                  cat.category.toLowerCase().includes(q) ||
                  cat.subcategories.some((s) => s.toLowerCase().includes(q)) ||
                  ccNode.cc.toLowerCase().includes(q)
                );
              });

              if (filteredCategories.length === 0 && filterText.trim()) {
                return null;
              }

              return (
                <div
                  key={ccNode.cc}
                  className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-2xs transition-all"
                >
                  {/* CC Node Header */}
                  <div className="bg-slate-50/90 px-3.5 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100 select-none">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Expand toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCcs((prev) => ({ ...prev, [ccNode.cc]: !prev[ccNode.cc] }))
                        }
                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      >
                        {isCcExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>

                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleCc(ccNode)}
                        className="flex items-center gap-2 text-left"
                      >
                        {ccState === 'all' ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : ccState === 'some' ? (
                          <MinusSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-slate-800 tracking-tight truncate">
                          {ccNode.cc}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] bg-slate-200/70 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                        {ccNode.categories.length} cat. · {ccNode.count} ensayos
                      </span>
                    </div>
                  </div>

                  {/* Categories inside CC */}
                  {isCcExpanded && (
                    <div className="p-3 pl-8 space-y-2 border-slate-100 bg-white">
                      {filteredCategories.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic py-1">
                          Sin categorías asignadas en este centro de costo.
                        </p>
                      ) : (
                        filteredCategories.map((cat) => {
                          const catKey = `${ccNode.cc}:::${cat.category}`;
                          const catState = getCategoryState(ccNode.cc, cat.category, cat.subcategories);
                          const isCatExpanded = !!expandedCats[catKey];

                          const filteredSubcats = cat.subcategories.filter((sub) => {
                            if (!filterText.trim()) return true;
                            const q = filterText.toLowerCase();
                            return (
                              sub.toLowerCase().includes(q) ||
                              cat.category.toLowerCase().includes(q) ||
                              ccNode.cc.toLowerCase().includes(q)
                            );
                          });

                          return (
                            <div
                              key={catKey}
                              className="rounded-lg border border-slate-150 bg-slate-50/40 overflow-hidden"
                            >
                              {/* Category Row */}
                              <div className="px-3 py-2 flex items-center justify-between gap-2 select-none hover:bg-slate-100/50 transition-colors">
                                <div className="flex items-center gap-2 min-w-0">
                                  {cat.subcategories.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedCats((prev) => ({
                                          ...prev,
                                          [catKey]: !prev[catKey],
                                        }))
                                      }
                                      className="p-0.5 text-slate-400 hover:text-slate-700 rounded transition-colors"
                                    >
                                      {isCatExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  ) : (
                                    <div className="w-4" />
                                  )}

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleCategory(
                                        ccNode.cc,
                                        cat.category,
                                        cat.subcategories
                                      )
                                    }
                                    className="flex items-center gap-2 text-left min-w-0"
                                  >
                                    {catState === 'all' ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : catState === 'some' ? (
                                      <MinusSquare className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    )}
                                    <span className="text-xs font-semibold text-slate-800 truncate">
                                      {cat.category}
                                    </span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-slate-500 font-medium">
                                  <span>{cat.count} ensayos</span>
                                </div>
                              </div>

                              {/* Subcategories List */}
                              {isCatExpanded && cat.subcategories.length > 0 && (
                                <div className="py-1.5 pl-10 pr-3 space-y-1 bg-white border-t border-slate-100">
                                  {filteredSubcats.map((sub) => {
                                    const leafKey = `${ccNode.cc}:::${cat.category}:::${sub}`;
                                    const isSelected = selectedLeaves.has(leafKey);
                                    const count = tree.leafCounts.get(leafKey) || 0;

                                    return (
                                      <div
                                        key={leafKey}
                                        onClick={() => handleToggleLeaf(leafKey)}
                                        className="flex items-center justify-between gap-2 p-1.5 rounded-md hover:bg-slate-50 cursor-pointer select-none transition-colors"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isSelected ? (
                                            <CheckSquare className="w-3 h-3 text-emerald-600 shrink-0" />
                                          ) : (
                                            <Square className="w-3 h-3 text-slate-300 shrink-0" />
                                          )}
                                          <span
                                            className={`text-[11px] truncate ${
                                              isSelected
                                                ? 'text-slate-800 font-medium'
                                                : 'text-slate-500'
                                            }`}
                                          >
                                            {sub}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                                          {count} {count === 1 ? 'ensayo' : 'ensayos'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Options & Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={separateSheets}
                onChange={(e) => setSeparateSheets(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="font-medium">
                Separar cada Centro de Costo en pestañas (hojas) independientes del Excel
              </span>
            </label>

            <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full border border-emerald-200">
              {matchingEssaysCount} ensayo(s) a descargar
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleExportDownload}
              disabled={downloading || matchingEssaysCount === 0}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Generando Excel...' : `Descargar Planilla (${matchingEssaysCount})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

