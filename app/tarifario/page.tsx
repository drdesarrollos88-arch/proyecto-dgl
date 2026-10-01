'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import TarifarioExportModal from '@/components/TarifarioExportModal';
import { TarifarioItem, SessionUser, CENTROS_DE_COSTO, TarifarioCategoryStructure, SubcategoryItem } from '@/lib/types';
import { hasPermission } from '@/lib/permissions';
import {
  Search,
  Download,
  Upload,
  Edit2,
  Plus,
  Filter,
  X,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown,
  Layers,
  CheckSquare,
  Square,
  PlusCircle,
  FolderTree,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Tag,
  Calculator,
  FolderArchive,
  Lock,
  Check,
  Save,
} from 'lucide-react';

const romanMap: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
  XI: 11, XII: 12, XIII: 13, XIV: 14, XV: 15, XVI: 16, XVII: 17, XVIII: 18, XIX: 19, XX: 20,
};

function parseHierarchicalKey(str: string) {
  if (!str) return { romanVal: 999, numbers: [] as number[], raw: '' };
  const trimmed = str.trim();
  const match = trimmed.match(/^([IVXLCDM]+)(?:\.([\d.]+))?/i);
  if (match) {
    const roman = match[1].toUpperCase();
    const romanVal = romanMap[roman] || 999;
    const numbers = match[2] ? match[2].split('.').filter(Boolean).map(Number) : [];
    return { romanVal, numbers, raw: trimmed };
  }
  return { romanVal: 999, numbers: [] as number[], raw: trimmed };
}

function compareHierarchical(a: string, b: string): number {
  const pA = parseHierarchicalKey(a);
  const pB = parseHierarchicalKey(b);
  if (pA.romanVal !== pB.romanVal) {
    return pA.romanVal - pB.romanVal;
  }
  const maxLen = Math.max(pA.numbers.length, pB.numbers.length);
  for (let i = 0; i < maxLen; i++) {
    const numA = pA.numbers[i] !== undefined ? pA.numbers[i] : -1;
    const numB = pB.numbers[i] !== undefined ? pB.numbers[i] : -1;
    if (numA !== numB) return numA - numB;
  }
  return (a || '').localeCompare(b || '', 'es', { numeric: true, sensitivity: 'base' });
}

function normalizeSub(sub: string | SubcategoryItem): { name: string; children: string[] } {
  if (typeof sub === 'string') return { name: sub.trim(), children: [] };
  return {
    name: (sub?.name || '').trim(),
    children: Array.isArray(sub?.children)
      ? sub.children.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
      : [],
  };
}

function TarifarioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<TarifarioItem[]>([]);
  const [structure, setStructure] = useState<TarifarioCategoryStructure[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedCC, setSelectedCC] = useState('ALL');
  const [selectedSubcategory, setSelectedSubcategory] = useState('ALL');
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState('ALL');
  const [sortColumn, setSortColumn] = useState<string>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Estado para edición de ítem
  const [editingItem, setEditingItem] = useState<TarifarioItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editNorm, setEditNorm] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editCC, setEditCC] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editSubSubcategory, setEditSubSubcategory] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [isCreatingSubSubcategory, setIsCreatingSubSubcategory] = useState(false);
  const [newSubSubcategoryName, setNewSubSubcategoryName] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editMinWeightKg, setEditMinWeightKg] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Estado para nuevo ítem
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItem, setNewItem] = useState({
    code: '',
    category: 'I - ENSAYOS BASICOS',
    subcategory: 'I.1 Caracterización de suelos',
    subSubcategory: '',
    designation: '',
    norm: '',
    minWeightKg: '0',
    unit: 'c/u',
    ufPrice: '',
    sku: '',
    cc: '1817 - Ensayos Básicos',
  });
  const [isCreatingNewCat, setIsCreatingNewCat] = useState(false);
  const [customNewCat, setCustomNewCat] = useState('');
  const [isCreatingNewSubcat, setIsCreatingNewSubcat] = useState(false);
  const [customNewSubcat, setCustomNewSubcat] = useState('');
  const [isCreatingNewSubSubcat, setIsCreatingNewSubSubcat] = useState(false);
  const [customNewSubSubcat, setCustomNewSubSubcat] = useState('');

  // Modal de personalización de exportación
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelectedCcs, setExportSelectedCcs] = useState<string[]>([...CENTROS_DE_COSTO]);
  const [exportSeparateSheets, setExportSeparateSheets] = useState(false);

  // Estado de carga de archivo Excel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Menú desplegable compacto
  const [actionsDropdownOpen, setActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Estados para modo de edición rápida de precios en la tabla
  const [quickPriceEditMode, setQuickPriceEditMode] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [savingPrices, setSavingPrices] = useState(false);
  const [priceToast, setPriceToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Edición rápida individual (clic directo en celda de precio)
  const [singleInlineEditId, setSingleInlineEditId] = useState<string | null>(null);
  const [singleInlinePrice, setSingleInlinePrice] = useState('');
  const [savingSinglePriceId, setSavingSinglePriceId] = useState<string | null>(null);

  // Precios pendientes de guardar calculados
  const pendingPriceChanges = useMemo(() => {
    const changes: Array<{ id: string; oldPrice: number; newPrice: number }> = [];
    for (const [id, valStr] of Object.entries(editedPrices)) {
      const num = parseFloat(valStr);
      if (!isNaN(num) && num >= 0) {
        const item = items.find((it) => it.id === id);
        if (item && Math.abs(item.ufPrice - num) > 0.0001) {
          changes.push({ id, oldPrice: item.ufPrice, newPrice: num });
        }
      }
    }
    return changes;
  }, [editedPrices, items]);

  const handlePriceChange = (id: string, val: string) => {
    setEditedPrices((prev) => ({
      ...prev,
      [id]: val,
    }));
  };

  const handleRevertPrice = (id: string) => {
    setEditedPrices((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDiscardAllPrices = () => {
    setEditedPrices({});
    setSingleInlineEditId(null);
  };

  const handleSaveAllPrices = async () => {
    if (pendingPriceChanges.length === 0) return;
    setSavingPrices(true);
    setPriceToast(null);

    try {
      const payload = {
        action: 'batchUpdatePrices',
        updates: pendingPriceChanges.map((c) => ({
          id: c.id,
          ufPrice: c.newPrice,
        })),
      };

      const res = await fetch('/api/tarifario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const count = pendingPriceChanges.length;
        setItems((prev) =>
          prev.map((it) => {
            const ch = pendingPriceChanges.find((p) => p.id === it.id);
            return ch ? { ...it, ufPrice: ch.newPrice } : it;
          })
        );
        setEditedPrices({});
        setSingleInlineEditId(null);
        setPriceToast({
          type: 'success',
          message: `¡${count} precio${count > 1 ? 's' : ''} actualizado${count > 1 ? 's' : ''} exitosamente!`,
        });
        setTimeout(() => setPriceToast(null), 4000);
      } else {
        setPriceToast({
          type: 'error',
          message: data.error || 'Error al guardar los precios modificados.',
        });
      }
    } catch {
      setPriceToast({
        type: 'error',
        message: 'Error de conexión al guardar los precios.',
      });
    } finally {
      setSavingPrices(false);
    }
  };

  const handleStartSingleInlineEdit = (item: TarifarioItem) => {
    setSingleInlineEditId(item.id);
    setSingleInlinePrice(item.ufPrice.toString());
  };

  const handleSaveSingleInlinePrice = async (item: TarifarioItem) => {
    const num = parseFloat(singleInlinePrice);
    if (isNaN(num) || num < 0) {
      alert('Debe ingresar un valor numérico válido mayor o igual a 0.');
      return;
    }
    if (Math.abs(item.ufPrice - num) < 0.0001) {
      setSingleInlineEditId(null);
      return;
    }

    setSavingSinglePriceId(item.id);
    try {
      const res = await fetch('/api/tarifario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batchUpdatePrices',
          updates: [{ id: item.id, ufPrice: num }],
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, ufPrice: num } : it)));
        setSingleInlineEditId(null);
        setPriceToast({
          type: 'success',
          message: `Precio de [${item.code || item.designation.slice(0, 20)}] actualizado a UF ${num.toFixed(2)}.`,
        });
        setTimeout(() => setPriceToast(null), 3000);
      } else {
        alert(data.error || 'Error al actualizar precio.');
      }
    } catch {
      alert('Error de conexión al actualizar precio.');
    } finally {
      setSavingSinglePriceId(null);
    }
  };

  // Helper para obtener sub-subcategorías disponibles para una categoría y subcategoría dada
  const getChildrenForSubcat = (category: string, subcat: string): string[] => {
    const set = new Set<string>();
    const catObj = structure.find((s) => s.category === category);
    if (catObj && catObj.subcategories) {
      const subObj = catObj.subcategories.map(normalizeSub).find((s) => s.name === subcat);
      if (subObj && subObj.children) {
        subObj.children.forEach((c) => set.add(c));
      }
    }
    items.forEach((it) => {
      if (it.category === category && it.subcategory === subcat && it.subSubcategory) {
        set.add(it.subSubcategory);
      }
    });
    return Array.from(set).sort(compareHierarchical);
  };

  useEffect(() => {
    // Obtener usuario actual
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      });

    // Cargar catálogo y estructura del tarifario
    fetch('/api/tarifario/estructura')
      .then((res) => res.json())
      .then((d) => {
        if (d.items) setItems(d.items);
        if (d.structure) setStructure(d.structure);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    // Cierre por clic fuera del elemento
    const handleOutside = (e: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setActionsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Procesar parámetro de acción desde el menú de navegación
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new') {
      setShowAddModal(true);
      router.replace('/tarifario');
    } else if (action === 'upload') {
      fileInputRef.current?.click();
      router.replace('/tarifario');
    }
  }, [searchParams, router]);

  // Categorías únicas ordenadas jerárquicamente
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort(compareHierarchical);
  }, [items]);

  // Subcategorías por categoría ordenadas jerárquicamente
  const subcategoriesByCategory = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    items.forEach((it) => {
      if (it.category) {
        if (!map[it.category]) map[it.category] = new Set();
        if (it.subcategory) map[it.category].add(it.subcategory);
      }
    });
    const result: Record<string, string[]> = {};
    for (const cat in map) {
      result[cat] = Array.from(map[cat]).sort(compareHierarchical);
    }
    return result;
  }, [items]);

  // Todas las subcategorías únicas ordenadas jerárquicamente
  const allSubcategories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.subcategory) set.add(it.subcategory);
    });
    return Array.from(set).sort(compareHierarchical);
  }, [items]);

  // Counts per Centro de Costo
  const ccCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CENTROS_DE_COSTO.forEach((cc) => {
      counts[cc] = 0;
    });
    items.forEach((it) => {
      if (counts[it.cc] !== undefined) {
        counts[it.cc]++;
      }
    });
    return counts;
  }, [items]);

  // Categories dependent on selectedCC (hierarchically sorted with counts)
  const availableCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((it) => {
      if (selectedCC === 'ALL' || it.cc === selectedCC) {
        if (it.category) {
          counts[it.category] = (counts[it.category] || 0) + 1;
        }
      }
    });
    const list = Object.keys(counts).sort(compareHierarchical);
    return { list, counts };
  }, [items, selectedCC]);

  // Subcategories dependent on selectedCC and selectedCategory (hierarchically sorted with counts)
  const availableSubcategories = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((it) => {
      const matchCC = selectedCC === 'ALL' || it.cc === selectedCC;
      const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      if (matchCC && matchCat) {
        if (it.subcategory) {
          counts[it.subcategory] = (counts[it.subcategory] || 0) + 1;
        }
      }
    });
    const list = Object.keys(counts).sort(compareHierarchical);
    return { list, counts };
  }, [items, selectedCC, selectedCategory]);

  // Sub-subcategories dependent on selectedCC, selectedCategory, and selectedSubcategory
  const availableSubSubcategories = useMemo(() => {
    const counts: Record<string, number> = {};
    items.forEach((it) => {
      const matchCC = selectedCC === 'ALL' || it.cc === selectedCC;
      const matchCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      const matchSub = selectedSubcategory === 'ALL' || it.subcategory === selectedSubcategory;
      if (matchCC && matchCat && matchSub && it.subSubcategory) {
        counts[it.subSubcategory] = (counts[it.subSubcategory] || 0) + 1;
      }
    });
    const list = Object.keys(counts).sort(compareHierarchical);
    return { list, counts };
  }, [items, selectedCC, selectedCategory, selectedSubcategory]);

  // Filter handlers with cascading dependency resets
  const handleSelectCC = (newCC: string) => {
    setSelectedCC(newCC);
    if (newCC !== 'ALL') {
      const validCats = new Set(items.filter((i) => i.cc === newCC).map((i) => i.category));
      if (selectedCategory !== 'ALL' && !validCats.has(selectedCategory)) {
        setSelectedCategory('ALL');
      }
      const validSubcats = new Set(items.filter((i) => i.cc === newCC).map((i) => i.subcategory));
      if (selectedSubcategory !== 'ALL' && !validSubcats.has(selectedSubcategory)) {
        setSelectedSubcategory('ALL');
      }
      setSelectedSubSubcategory('ALL');
    }
  };

  const handleSelectCategory = (newCat: string) => {
    setSelectedCategory(newCat);
    if (newCat !== 'ALL') {
      const validSubcats = new Set(
        items
          .filter((i) => (selectedCC === 'ALL' || i.cc === selectedCC) && i.category === newCat)
          .map((i) => i.subcategory)
      );
      if (selectedSubcategory !== 'ALL' && !validSubcats.has(selectedSubcategory)) {
        setSelectedSubcategory('ALL');
      }
      setSelectedSubSubcategory('ALL');
    }
  };

  const handleSelectSubcategory = (newSubcat: string) => {
    setSelectedSubcategory(newSubcat);
    setSelectedSubSubcategory('ALL');
  };

  const handleSelectSubSubcategory = (newSubSubcat: string) => {
    setSelectedSubSubcategory(newSubSubcat);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedCC('ALL');
    setSelectedCategory('ALL');
    setSelectedSubcategory('ALL');
    setSelectedSubSubcategory('ALL');
    setSortColumn('default');
    setSortDirection('asc');
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn('default');
        setSortDirection('asc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    const q = search.toLowerCase().trim();
    const result = items.filter((it) => {
      const matchesCC = selectedCC === 'ALL' || it.cc === selectedCC;
      const matchesCat = selectedCategory === 'ALL' || it.category === selectedCategory;
      const matchesSubcat = selectedSubcategory === 'ALL' || it.subcategory === selectedSubcategory;
      const matchesSubSubcat =
        selectedSubSubcategory === 'ALL' ||
        (it.subSubcategory && it.subSubcategory.trim() === selectedSubSubcategory.trim());
      if (!matchesCC || !matchesCat || !matchesSubcat || !matchesSubSubcat) return false;

      if (!q) return true;
      return (
        (it.code && it.code.toLowerCase().includes(q)) ||
        (it.designation && it.designation.toLowerCase().includes(q)) ||
        (it.norm && it.norm.toLowerCase().includes(q)) ||
        (it.sku && it.sku.toLowerCase().includes(q)) ||
        (it.cc && it.cc.toLowerCase().includes(q)) ||
        (it.category && it.category.toLowerCase().includes(q)) ||
        (it.subcategory && it.subcategory.toLowerCase().includes(q)) ||
        (it.subSubcategory && it.subSubcategory.toLowerCase().includes(q))
      );
    });

    // Sorting
    result.sort((a, b) => {
      if (sortColumn === 'code') {
        const cmp = (a.code || '').localeCompare(b.code || '', 'es', { numeric: true, sensitivity: 'base' });
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortColumn === 'designation') {
        const cmp = (a.designation || '').localeCompare(b.designation || '', 'es');
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortColumn === 'category') {
        const cmp = compareHierarchical(a.category, b.category);
        if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
        const subCmp = compareHierarchical(a.subcategory, b.subcategory);
        return sortDirection === 'asc' ? subCmp : -subCmp;
      }
      if (sortColumn === 'price') {
        const cmp = a.ufPrice - b.ufPrice;
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortColumn === 'weight') {
        const wA = typeof a.minWeightKg === 'number' ? a.minWeightKg : parseFloat(String(a.minWeightKg)) || 0;
        const wB = typeof b.minWeightKg === 'number' ? b.minWeightKg : parseFloat(String(b.minWeightKg)) || 0;
        const cmp = wA - wB;
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      if (sortColumn === 'cc') {
        const cmp = (a.cc || '').localeCompare(b.cc || '', 'es');
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      // Default: Hierarchical order by category -> subcategory -> subSubcategory -> code
      const catCmp = compareHierarchical(a.category, b.category);
      if (catCmp !== 0) return catCmp;
      const subCmp = compareHierarchical(a.subcategory, b.subcategory);
      if (subCmp !== 0) return subCmp;
      const subSubCmp = compareHierarchical(a.subSubcategory || '', b.subSubcategory || '');
      if (subSubCmp !== 0) return subSubCmp;
      return (a.code || '').localeCompare(b.code || '', 'es', { numeric: true, sensitivity: 'base' });
    });

    return result;
  }, [items, search, selectedCategory, selectedCC, selectedSubcategory, selectedSubSubcategory, sortColumn, sortDirection]);

  const handleStartEdit = (item: TarifarioItem) => {
    setEditingItem(item);
    setEditPrice(item.ufPrice.toString());
    setEditNorm(item.norm);
    setEditDesignation(item.designation);
    setEditCC(item.cc || '1817 - Ensayos Básicos');
    setEditCategory(item.category || categories[0] || 'I - ENSAYOS BASICOS');
    setEditSubcategory(item.subcategory || item.category || '');
    setEditSubSubcategory(item.subSubcategory || '');
    setEditCode(item.code || '');
    setEditSku(item.sku || '');
    setEditMinWeightKg(String(item.minWeightKg || 0));
    setEditUnit(item.unit || 'c/u');
    setIsCreatingCategory(false);
    setNewCategoryName('');
    setIsCreatingSubcategory(false);
    setNewSubcategoryName('');
    setIsCreatingSubSubcategory(false);
    setNewSubSubcategoryName('');
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    setSavingEdit(true);

    const finalCategory = isCreatingCategory
      ? newCategoryName.trim() || editCategory
      : editCategory;
    const finalSubcategory = isCreatingSubcategory
      ? newSubcategoryName.trim() || editSubcategory
      : editSubcategory || finalCategory;
    const finalSubSubcategory = isCreatingSubSubcategory
      ? newSubSubcategoryName.trim()
      : editSubSubcategory.trim();

    try {
      const res = await fetch('/api/tarifario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingItem.id,
          updates: {
            code: editCode,
            designation: editDesignation,
            norm: editNorm,
            category: finalCategory,
            subcategory: finalSubcategory,
            subSubcategory: finalSubSubcategory,
            cc: editCC,
            sku: editSku,
            minWeightKg: parseFloat(editMinWeightKg) || 0,
            unit: editUnit,
            ufPrice: parseFloat(editPrice) || editingItem.ufPrice,
          },
        }),
      });

      const d = await res.json();
      if (res.ok && d.item) {
        setItems((prev) => prev.map((it) => (it.id === editingItem.id ? d.item : it)));
        setEditingItem(null);
      } else {
        alert(d.error || 'Error al guardar cambios');
      }
    } catch {
      alert('Error de conexión al guardar cambios.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.designation || !newItem.ufPrice) {
      alert('Designación y Valor UF son obligatorios.');
      return;
    }

    const finalCat = isCreatingNewCat
      ? customNewCat.trim() || newItem.category
      : newItem.category;
    const finalSubcat = isCreatingNewSubcat
      ? customNewSubcat.trim() || newItem.subcategory
      : newItem.subcategory || finalCat;
    const finalSubSubcat = isCreatingNewSubSubcat
      ? customNewSubSubcat.trim()
      : newItem.subSubcategory.trim();

    try {
      const res = await fetch('/api/tarifario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newItem,
          category: finalCat,
          subcategory: finalSubcat,
          subSubcategory: finalSubSubcat,
          ufPrice: parseFloat(newItem.ufPrice),
          minWeightKg: parseFloat(newItem.minWeightKg) || 0,
        }),
      });

      const d = await res.json();
      if (res.ok && d.item) {
        setItems((prev) => [d.item, ...prev]);
        setShowAddModal(false);
        setNewItem({
          code: '',
          category: 'I - ENSAYOS BASICOS',
          subcategory: 'I.1 Caracterización de suelos',
          subSubcategory: '',
          designation: '',
          norm: '',
          minWeightKg: '0',
          unit: 'c/u',
          ufPrice: '',
          sku: '',
          cc: '1817 - Ensayos Básicos',
        });
        setIsCreatingNewCat(false);
        setCustomNewCat('');
        setIsCreatingNewSubcat(false);
        setCustomNewSubcat('');
        setIsCreatingNewSubSubcat(false);
        setCustomNewSubSubcat('');
      } else {
        alert(d.error || 'Error al crear el nuevo ítem');
      }
    } catch {
      alert('Error de conexión al crear el nuevo ítem.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingExcel(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/tarifario/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadMessage({ type: 'success', text: data.message });
        const resItems = await fetch('/api/tarifario');
        const d = await resItems.json();
        if (d.items) setItems(d.items);
      } else {
        setUploadMessage({ type: 'error', text: data.error || 'Error al procesar el archivo.' });
      }
    } catch {
      setUploadMessage({ type: 'error', text: 'Error al comunicarse con el servidor.' });
    } finally {
      setUploadingExcel(false);
      e.target.value = '';
    }
  };

  // Toggle selection for export
  const toggleExportCc = (cc: string) => {
    setExportSelectedCcs((prev) =>
      prev.includes(cc) ? prev.filter((c) => c !== cc) : [...prev, cc]
    );
  };

  // Execute download with selected options
  const handleDownloadCustomExcel = () => {
    if (exportSelectedCcs.length === 0) {
      alert('Debes seleccionar al menos un Centro de Costo para descargar.');
      return;
    }

    const ccsEncoded = exportSelectedCcs.map((c) => encodeURIComponent(c)).join(',');
    const url = `/api/tarifario/export?ccs=${ccsEncoded}&separateSheets=${exportSeparateSheets}`;
    window.location.href = url;
    setShowExportModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex-1 flex flex-col">
        {/* Hidden file input for Excel upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".xlsx,.xls"
          disabled={uploadingExcel}
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Compact Header & Action Bar */}
        <div className="bg-white rounded-xl px-4 py-2.5 border border-slate-200 shadow-2xs mb-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              Tarifario Oficial
            </h1>
            <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {filteredItems.length} de {items.length} ensayos
            </span>
          </div>

          {/* Action Buttons with Download Customizer */}
          <div className="flex items-center gap-2 flex-wrap" ref={actionsDropdownRef}>
            <Link
              href="/cotizaciones"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 transition-colors shadow-2xs"
              title="Ir al Resumen Comercial y Registro de Cotizaciones"
            >
              <FolderArchive className="w-3.5 h-3.5" />
              <span>Historial</span>
            </Link>

            <Link
              href="/cotizador"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs"
              title="Crear nueva cotización oficial"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>Ir al Cotizador</span>
            </Link>

            {/* Descargar Excel con validación de permiso */}
            {hasPermission(user, 'tarifario.descargar') ? (
              <button
                onClick={() => setShowExportModal(true)}
                className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Descargar Excel con selección personalizada de Centros de Costo"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Descargar Excel...</span>
              </button>
            ) : (
              <button
                disabled
                className="flex items-center gap-1.5 bg-slate-200 text-slate-400 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-not-allowed border border-slate-300"
                title="Tu perfil no tiene permisos para descargar el tarifario completo"
              >
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>Descarga Restringida</span>
              </button>
            )}

            {/* Botón de Edición Rápida de Precios en Lista (Permiso tarifario.editar) */}
            {hasPermission(user, 'tarifario.editar') && (
              <button
                onClick={() => {
                  if (quickPriceEditMode && pendingPriceChanges.length > 0) {
                    if (confirm('Tienes cambios de precios sin guardar. ¿Deseas descartarlos al salir del modo edición?')) {
                      handleDiscardAllPrices();
                      setQuickPriceEditMode(false);
                    }
                  } else {
                    setQuickPriceEditMode((prev) => !prev);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-all cursor-pointer border ${
                  quickPriceEditMode
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold border-amber-600 ring-2 ring-amber-300'
                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 hover:border-amber-400'
                }`}
                title={
                  quickPriceEditMode
                    ? 'Salir del modo edición de precios'
                    : 'Habilitar edición rápida de precios directamente en la tabla'
                }
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-800" />
                <span>{quickPriceEditMode ? '✓ Modo Edición Precios' : 'Editar Precios en Lista'}</span>
                {pendingPriceChanges.length > 0 && (
                  <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                    {pendingPriceChanges.length}
                  </span>
                )}
              </button>
            )}

            {/* Opciones de edición y carga de Excel (Solo con permiso tarifario.editar) */}
            {hasPermission(user, 'tarifario.editar') && (
              <div className="relative">
                <button
                  onClick={() => setActionsDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <span>Opciones</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {actionsDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 divide-y divide-slate-100">
                    <button
                      onClick={() => {
                        setActionsDropdownOpen(false);
                        setQuickPriceEditMode((prev) => !prev);
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>{quickPriceEditMode ? 'Desactivar Edición Precios' : 'Editar Precios en Lista'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setActionsDropdownOpen(false);
                        setShowAddModal(true);
                      }}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Nuevo Ensayo</span>
                    </button>
                    <button
                      onClick={() => {
                        setActionsDropdownOpen(false);
                        fileInputRef.current?.click();
                      }}
                      disabled={uploadingExcel}
                      className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingExcel ? 'Cargando...' : 'Cargar Nuevo Excel'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notificación de actualización de precios */}
        {priceToast && (
          <div
            className={`mb-3 p-3 rounded-xl flex items-center justify-between gap-2.5 border text-xs animate-in fade-in slide-in-from-top-2 duration-150 ${
              priceToast.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {priceToast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span className="font-semibold">{priceToast.message}</span>
            </div>
            <button
              onClick={() => setPriceToast(null)}
              className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Upload feedback alert */}
        {uploadMessage && (
          <div
            className={`mb-3 p-3 rounded-xl flex items-center gap-2.5 border text-xs ${
              uploadMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {uploadMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            )}
            <span>{uploadMessage.text}</span>
            <button
              onClick={() => setUploadMessage(null)}
              className="ml-auto text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Triple Dependent Filter Bar */}
        <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs mb-3 space-y-2.5">
          <div className="flex flex-col lg:flex-row gap-2.5 items-stretch lg:items-center justify-between">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, código, norma, SKU, categoría o subcategoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Borrar búsqueda"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* 3 Dependent Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Centro de Costo */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[200px]">
                <Layers className="w-3.5 h-3.5 text-blue-700 flex-shrink-0" />
                <select
                  value={selectedCC}
                  onChange={(e) => handleSelectCC(e.target.value)}
                  className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer ${
                    selectedCC !== 'ALL'
                      ? 'border-blue-400 bg-blue-50/50 text-blue-900 font-semibold'
                      : 'border-slate-300 bg-white text-slate-800 font-medium'
                  }`}
                  title="Filtrar por Centro de Costo"
                >
                  <option value="ALL">Todos los Centros de Costo ({items.length})</option>
                  {CENTROS_DE_COSTO.map((cc) => (
                    <option key={cc} value={cc}>
                      {cc} ({ccCounts[cc] || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Categoría (Dependiente de CC) */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[210px]">
                <Filter className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                <select
                  value={selectedCategory}
                  onChange={(e) => handleSelectCategory(e.target.value)}
                  className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer ${
                    selectedCategory !== 'ALL'
                      ? 'border-indigo-400 bg-indigo-50/50 text-indigo-900 font-semibold'
                      : 'border-slate-300 bg-white text-slate-700 font-normal'
                  }`}
                  title="Filtrar por Categoría (dependiente del Centro de Costo)"
                >
                  <option value="ALL">
                    {selectedCC === 'ALL'
                      ? `Todas las Categorías (${availableCategories.list.length})`
                      : `Categorías de ${selectedCC.split('-')[0].trim()} (${availableCategories.list.length})`}
                  </option>
                  {availableCategories.list.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} ({availableCategories.counts[cat] || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Subcategoría (Dependiente de CC y Categoría) */}
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[210px]">
                <FolderTree className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <select
                  value={selectedSubcategory}
                  onChange={(e) => handleSelectSubcategory(e.target.value)}
                  className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer ${
                    selectedSubcategory !== 'ALL'
                      ? 'border-emerald-400 bg-emerald-50/50 text-emerald-900 font-semibold'
                      : 'border-slate-300 bg-white text-slate-700 font-normal'
                  }`}
                  title="Filtrar por Subcategoría (dependiente de Categoría y Centro de Costo)"
                >
                  <option value="ALL">
                    {selectedCategory !== 'ALL'
                      ? `Todas las Subcategorías (${availableSubcategories.list.length})`
                      : selectedCC !== 'ALL'
                      ? `Subcategorías de ${selectedCC.split('-')[0].trim()} (${availableSubcategories.list.length})`
                      : `Todas las Subcategorías (${availableSubcategories.list.length})`}
                  </option>
                  {availableSubcategories.list.map((subcat) => (
                    <option key={subcat} value={subcat}>
                      {subcat} ({availableSubcategories.counts[subcat] || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* 4. Sub-subcategoría / Sub-tipo (Dependiente de Subcategoría) */}
              {availableSubSubcategories.list.length > 0 && (
                <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[210px]">
                  <Layers className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                  <select
                    value={selectedSubSubcategory}
                    onChange={(e) => handleSelectSubSubcategory(e.target.value)}
                    className={`w-full py-1.5 px-2 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-red-600 cursor-pointer ${
                      selectedSubSubcategory !== 'ALL'
                        ? 'border-red-400 bg-red-50/50 text-red-900 font-semibold'
                        : 'border-slate-300 bg-white text-slate-700 font-normal'
                    }`}
                    title="Filtrar por Sub-tipo de ensayo"
                  >
                    <option value="ALL">
                      Todos los Sub-tipos ({availableSubSubcategories.list.length})
                    </option>
                    {availableSubSubcategories.list.map((subSub) => (
                      <option key={subSub} value={subSub}>
                        {subSub} ({availableSubSubcategories.counts[subSub] || 0})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Limpiar Filtros button */}
              {(selectedCC !== 'ALL' ||
                selectedCategory !== 'ALL' ||
                selectedSubcategory !== 'ALL' ||
                selectedSubSubcategory !== 'ALL' ||
                search.trim() !== '' ||
                sortColumn !== 'default') && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 hover:border-red-300 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-700 text-xs font-medium transition-colors cursor-pointer"
                  title="Restablecer todos los filtros y búsqueda"
                >
                  <RotateCcw className="w-3 h-3 text-slate-400 hover:text-red-600" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Filter Badges & Results Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-slate-700">
                Mostrando <strong className="text-blue-700 font-bold">{filteredItems.length}</strong> de{' '}
                {items.length} ensayos
              </span>

              {selectedCC !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 font-medium">
                  CC: {selectedCC.split('-')[0].trim()}
                  <button
                    onClick={() => handleSelectCC('ALL')}
                    className="hover:text-blue-950 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedCategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-medium">
                  Cat: {selectedCategory.length > 28 ? selectedCategory.substring(0, 28) + '...' : selectedCategory}
                  <button
                    onClick={() => handleSelectCategory('ALL')}
                    className="hover:text-indigo-950 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedSubcategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                  Subcat: {selectedSubcategory.length > 28 ? selectedSubcategory.substring(0, 28) + '...' : selectedSubcategory}
                  <button
                    onClick={() => handleSelectSubcategory('ALL')}
                    className="hover:text-emerald-950 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              )}

              {selectedSubSubcategory !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-800 border border-red-200 font-medium">
                  Sub-tipo: {selectedSubSubcategory.length > 28 ? selectedSubSubcategory.substring(0, 28) + '...' : selectedSubSubcategory}
                  <button
                    onClick={() => handleSelectSubSubcategory('ALL')}
                    className="hover:text-red-950 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              )}

              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                  "{search}"
                  <button
                    onClick={() => setSearch('')}
                    className="hover:text-amber-950 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              )}

              {sortColumn !== 'default' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  Orden: {sortColumn} ({sortDirection === 'asc' ? 'asc' : 'desc'})
                  <button
                    onClick={() => {
                      setSortColumn('default');
                      setSortDirection('asc');
                    }}
                    className="hover:text-slate-900 ml-0.5 cursor-pointer font-bold"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>

            <div className="text-[10px] text-slate-400 hidden sm:block">
              Orden jerárquico romano activo (I, II, III...)
            </div>
          </div>
        </div>

        {/* Table Container with Sticky Headers */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="max-h-[calc(100vh-215px)] overflow-y-auto overflow-x-auto relative">
            <table className="w-full min-w-[1100px] text-left text-xs text-slate-700 relative border-collapse">
              {/* Sticky Table Header with interactive sorting */}
              <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-200 text-[11px] uppercase tracking-wider shadow-2xs select-none">
                <tr>
                  <th
                    onClick={() => handleSort('code')}
                    className="py-2.5 px-3 w-16 text-center bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clic para ordenar por Código"
                  >
                    <div className="inline-flex items-center justify-center gap-1 w-full">
                      <span>Cód.</span>
                      {sortColumn === 'code' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('designation')}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clic para ordenar por Designación"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Designación / Ensayo</span>
                      {sortColumn === 'designation' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('category')}
                    className="py-2.5 px-3 w-52 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clic para ordenar por Categoría y Subcategoría"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Categoría & Subcategoría</span>
                      {sortColumn === 'category' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th className="py-2.5 px-3 w-44 bg-slate-100">Norma o Procedimiento</th>

                  <th
                    onClick={() => handleSort('weight')}
                    className="py-2.5 px-2 w-16 text-center bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                    title="Clic para ordenar por Masa"
                  >
                    <div className="inline-flex items-center justify-center gap-1 w-full">
                      <span>Masa (kg)</span>
                      {sortColumn === 'weight' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th className="py-2.5 px-2 w-14 text-center bg-slate-100">Unidad</th>

                  <th
                    onClick={() => handleSort('price')}
                    className={`py-2.5 px-3 w-32 text-right transition-colors cursor-pointer ${
                      quickPriceEditMode
                        ? 'bg-amber-100/90 text-amber-950 border-b-2 border-amber-500 font-bold'
                        : 'bg-slate-100 hover:bg-slate-200'
                    }`}
                    title="Clic para ordenar por Tarifa UF"
                  >
                    <div className="inline-flex items-center justify-end gap-1.5 w-full">
                      {quickPriceEditMode && (
                        <span className="text-[9px] bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded shadow-2xs">
                          EDITABLE
                        </span>
                      )}
                      <span>Tarifa (UF)</span>
                      {sortColumn === 'price' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-slate-400 opacity-40 hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('cc')}
                    className="py-2.5 px-3 w-48 bg-blue-50/70 text-blue-900 border-x border-slate-200 hover:bg-blue-100 transition-colors cursor-pointer"
                    title="Clic para ordenar por Centro de Costo"
                  >
                    <div className="inline-flex items-center gap-1">
                      <span>Centro de Costo</span>
                      {sortColumn === 'cc' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-blue-600" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-blue-600" />
                        )
                      ) : (
                        <ArrowUpDown className="w-2.5 h-2.5 text-blue-400 opacity-60 hover:opacity-100" />
                      )}
                    </div>
                  </th>

                  <th className="py-2.5 px-2 w-20 text-center bg-slate-100">SKU</th>
                  {hasPermission(user, 'tarifario.editar') && (
                    <th className="py-2.5 px-2 w-14 text-center bg-slate-100">Acción</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Cargando tarifario oficial...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      No se encontraron ensayos con los criterios de búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Code */}
                      <td className="py-2 px-3 font-mono font-semibold text-center text-slate-500 bg-slate-50/50">
                        {item.code || '-'}
                      </td>

                      {/* Designation */}
                      <td className="py-2 px-4 min-w-[260px]">
                        <div className="font-semibold text-slate-900 whitespace-pre-line leading-tight break-words">
                          {item.designation}
                        </div>
                      </td>

                      {/* Categoría & Subcategoría */}
                      <td className="py-2 px-3 text-[11px]">
                        <div className="font-medium text-slate-800 leading-tight">
                          {item.category}
                        </div>
                        {item.subcategory && item.subcategory !== item.category && (
                          <div className="text-[10px] text-blue-700 mt-0.5 font-medium">
                            ↳ {item.subcategory}
                          </div>
                        )}
                        {item.subSubcategory && (
                          <div className="text-[10px] text-red-700 mt-0.5 font-semibold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            <span>{item.subSubcategory}</span>
                          </div>
                        )}
                      </td>

                      {/* Norm */}
                      <td className="py-2 px-3 text-slate-600 whitespace-pre-line leading-relaxed text-[11px] break-words">
                        {item.norm || <span className="text-slate-400 italic">-</span>}
                      </td>

                      {/* Weight */}
                      <td className="py-2 px-2 text-center font-mono text-slate-600">
                        {item.minWeightKg ? `${item.minWeightKg} kg` : '-'}
                      </td>

                      {/* Unit */}
                      <td className="py-2 px-2 text-center font-semibold text-slate-600">
                        {item.unit}
                      </td>

                      {/* Price UF (Edición rápida directa en lista) */}
                      {quickPriceEditMode && hasPermission(user, 'tarifario.editar') ? (
                        <td
                          className={`py-1 px-2 text-right font-mono transition-colors ${
                            editedPrices[item.id] !== undefined &&
                            parseFloat(editedPrices[item.id]) !== item.ufPrice &&
                            !isNaN(parseFloat(editedPrices[item.id]))
                              ? 'bg-amber-100/80 border-l-2 border-amber-500'
                              : 'bg-amber-50/25'
                          }`}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={
                                editedPrices[item.id] !== undefined
                                  ? editedPrices[item.id]
                                  : item.ufPrice
                              }
                              onChange={(e) => handlePriceChange(item.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  (e.target as HTMLElement).blur();
                                }
                              }}
                              className={`w-20 text-right font-mono font-bold text-xs py-1 px-1.5 rounded border focus:outline-none transition-all ${
                                editedPrices[item.id] !== undefined &&
                                parseFloat(editedPrices[item.id]) !== item.ufPrice &&
                                !isNaN(parseFloat(editedPrices[item.id]))
                                  ? 'bg-white text-amber-900 border-amber-400 ring-2 ring-amber-300 shadow-xs'
                                  : 'bg-white text-slate-900 border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-400'
                              }`}
                              placeholder="0.00"
                            />
                            {editedPrices[item.id] !== undefined &&
                              parseFloat(editedPrices[item.id]) !== item.ufPrice && (
                                <button
                                  onClick={() => handleRevertPrice(item.id)}
                                  title={`Revertir a UF ${item.ufPrice.toFixed(2)}`}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </button>
                              )}
                          </div>
                          {editedPrices[item.id] !== undefined &&
                            parseFloat(editedPrices[item.id]) !== item.ufPrice &&
                            !isNaN(parseFloat(editedPrices[item.id])) && (
                              <div className="text-[9px] text-amber-800 font-semibold text-right pr-1 mt-0.5">
                                Ant: UF {item.ufPrice.toFixed(2)}
                              </div>
                            )}
                        </td>
                      ) : singleInlineEditId === item.id ? (
                        <td className="py-1 px-2 text-right font-mono bg-blue-50/80 border-2 border-blue-400 rounded">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              autoFocus
                              value={singleInlinePrice}
                              onChange={(e) => setSingleInlinePrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveSingleInlinePrice(item);
                                if (e.key === 'Escape') setSingleInlineEditId(null);
                              }}
                              className="w-20 text-right font-mono font-bold text-xs py-1 px-1.5 bg-white text-slate-900 border border-blue-500 rounded focus:outline-none ring-2 ring-blue-200"
                            />
                            <button
                              onClick={() => handleSaveSingleInlinePrice(item)}
                              disabled={savingSinglePriceId === item.id}
                              title="Guardar precio (Enter)"
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer transition-colors shadow-2xs"
                            >
                              {savingSinglePriceId === item.id ? (
                                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              onClick={() => setSingleInlineEditId(null)}
                              title="Cancelar (Esc)"
                              className="p-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded cursor-pointer transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                      ) : (
                        <td
                          className="py-2 px-3 text-right font-bold text-slate-900 font-mono group/price relative"
                          onDoubleClick={() =>
                            hasPermission(user, 'tarifario.editar') && handleStartSingleInlineEdit(item)
                          }
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            <span>{item.ufPrice.toFixed(2)}</span>
                            {hasPermission(user, 'tarifario.editar') && (
                              <button
                                onClick={() => handleStartSingleInlineEdit(item)}
                                title="Editar precio rápidamente (Doble clic o clic aquí)"
                                className="opacity-0 group-hover/price:opacity-100 text-slate-400 hover:text-amber-600 hover:bg-amber-50 p-1 rounded transition-all cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Centro de Costo (Visualización estática, limpia, sin dropdowns en la celda) */}
                      <td className="py-2 px-3 border-x border-slate-100 bg-blue-50/20">
                        <span className="inline-block text-[11px] font-medium text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                          {item.cc || 'Sin CC'}
                        </span>
                      </td>

                      {/* SKU */}
                      <td className="py-2 px-2 text-center font-mono text-slate-400 text-[11px]">
                        {item.sku || '-'}
                      </td>

                      {/* Acción de edición (restringida a usuarios con permiso tarifario.editar) */}
                      {hasPermission(user, 'tarifario.editar') && (
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => handleStartEdit(item)}
                            title="Modificar ensayo (Centro de Costo, Categoría, Tarifa, etc.)"
                            className="p-1.5 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Barra flotante para guardar cambios masivos de precio */}
        {pendingPriceChanges.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
              </span>
              <span className="text-xs font-semibold text-slate-100">
                <strong className="text-amber-400 font-bold">{pendingPriceChanges.length}</strong>{' '}
                {pendingPriceChanges.length === 1 ? 'precio modificado' : 'precios modificados'} pendiente
                {pendingPriceChanges.length > 1 ? 's' : ''} de guardar
              </span>
            </div>

            <div className="h-4 w-[1px] bg-slate-700"></div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardAllPrices}
                disabled={savingPrices}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Descartar
              </button>
              <button
                onClick={handleSaveAllPrices}
                disabled={savingPrices}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 transition-all shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
              >
                {savingPrices ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Guardar {pendingPriceChanges.length}{' '}
                      {pendingPriceChanges.length === 1 ? 'Precio' : 'Precios'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Modal Custom Download Excel */}
      <TarifarioExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        initialItems={items}
      />

      {/* Modal Edit Item (Con Lápiz: Categoría, Subcategoría y CC por lista desplegable con opción de crear) */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Modificar Ensayo Oficial</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              {/* Centro de Costo (Lista Desplegable) */}
              <div>
                <label className="block text-xs font-semibold text-blue-900 uppercase mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-700" />
                  Centro de Costo (CC) *
                </label>
                <select
                  value={editCC}
                  onChange={(e) => setEditCC(e.target.value)}
                  className="w-full p-2 border border-blue-300 bg-blue-50/30 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                >
                  {CENTROS_DE_COSTO.map((cc) => (
                    <option key={cc} value={cc}>
                      {cc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría (Lista Desplegable con opción de crear nueva) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase flex items-center gap-1">
                    <FolderTree className="w-3.5 h-3.5 text-slate-500" />
                    Categoría *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCategory(!isCreatingCategory);
                      if (!isCreatingCategory) setNewCategoryName('');
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    {isCreatingCategory ? '✕ Volver a lista' : '+ Nueva categoría'}
                  </button>
                </div>

                {isCreatingCategory ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nombre de la nueva categoría..."
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full p-2 border-2 border-blue-400 bg-blue-50/20 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingCategory(false)}
                      className="px-2 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={editCategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingCategory(true);
                        setNewCategoryName('');
                      } else {
                        setEditCategory(e.target.value);
                        const available = subcategoriesByCategory[e.target.value] || [];
                        if (available.length > 0 && !available.includes(editSubcategory)) {
                          setEditSubcategory(available[0]);
                        }
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-blue-700 font-bold">
                      + Crear nueva categoría...
                    </option>
                  </select>
                )}
              </div>

              {/* Subcategoría (Lista Desplegable con opción de crear nueva) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Subcategoría *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingSubcategory(!isCreatingSubcategory);
                      if (!isCreatingSubcategory) setNewSubcategoryName('');
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    {isCreatingSubcategory ? '✕ Volver a lista' : '+ Nueva subcategoría'}
                  </button>
                </div>

                {isCreatingSubcategory ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nombre de la nueva subcategoría..."
                      value={newSubcategoryName}
                      onChange={(e) => setNewSubcategoryName(e.target.value)}
                      className="w-full p-2 border-2 border-blue-400 bg-blue-50/20 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubcategory(false)}
                      className="px-2 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={editSubcategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingSubcategory(true);
                        setNewSubcategoryName('');
                      } else {
                        setEditSubcategory(e.target.value);
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                  >
                    {((subcategoriesByCategory[editCategory] && subcategoriesByCategory[editCategory].length > 0)
                      ? subcategoriesByCategory[editCategory]
                      : allSubcategories
                    ).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-blue-700 font-bold">
                      + Crear nueva subcategoría...
                    </option>
                  </select>
                )}
              </div>

              {/* Sub-subcategoría (Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Sub-tipo / Sub-subcategoría <span className="text-slate-400 font-normal normal-case">(Opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingSubSubcategory(!isCreatingSubSubcategory);
                      if (!isCreatingSubSubcategory) setNewSubSubcategoryName('');
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    {isCreatingSubSubcategory ? '✕ Volver a lista' : '+ Nuevo sub-tipo'}
                  </button>
                </div>

                {isCreatingSubSubcategory ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nombre del nuevo sub-tipo..."
                      value={newSubSubcategoryName}
                      onChange={(e) => setNewSubSubcategoryName(e.target.value)}
                      className="w-full p-2 border-2 border-blue-400 bg-blue-50/20 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingSubSubcategory(false)}
                      className="px-2 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={editSubSubcategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingSubSubcategory(true);
                        setNewSubSubcategoryName('');
                      } else {
                        setEditSubSubcategory(e.target.value);
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none cursor-pointer"
                  >
                    <option value="">(Ninguno / Subcategoría general)</option>
                    {getChildrenForSubcat(editCategory, editSubcategory).map((subSub) => (
                      <option key={subSub} value={subSub}>
                        {subSub}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-blue-700 font-bold">
                      + Crear nuevo sub-tipo...
                    </option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Designación del Ensayo *
                </label>
                <textarea
                  rows={2}
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Norma o Procedimiento
                </label>
                <textarea
                  rows={2}
                  value={editNorm}
                  onChange={(e) => setEditNorm(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Masa (kg)
                  </label>
                  <input
                    type="number"
                    value={editMinWeightKg}
                    onChange={(e) => setEditMinWeightKg(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Tarifa Oficial (UF) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                {savingEdit ? 'Guardando...' : 'Guardar Cambios Oficiales'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add New Item */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Agregar Nuevo Ensayo</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Código
                  </label>
                  <input
                    type="text"
                    value={newItem.code}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    placeholder="ej. 359"
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    SKU
                  </label>
                  <input
                    type="text"
                    value={newItem.sku}
                    onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })}
                    placeholder="ej. 23400199"
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-blue-900 uppercase mb-1 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-700" />
                  Centro de Costo (CC) *
                </label>
                <select
                  value={newItem.cc}
                  onChange={(e) => setNewItem({ ...newItem, cc: e.target.value })}
                  className="w-full p-2 border border-blue-300 bg-blue-50/30 rounded-lg text-xs font-semibold text-slate-800"
                >
                  {CENTROS_DE_COSTO.map((cc) => (
                    <option key={cc} value={cc}>
                      {cc}
                    </option>
                  ))}
                </select>
              </div>

              {/* Categoría */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Categoría *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewCat(!isCreatingNewCat);
                      if (!isCreatingNewCat) setCustomNewCat('');
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    {isCreatingNewCat ? '✕ Volver a lista' : '+ Nueva categoría'}
                  </button>
                </div>

                {isCreatingNewCat ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nombre de la nueva categoría..."
                      value={customNewCat}
                      onChange={(e) => setCustomNewCat(e.target.value)}
                      className="w-full p-2 border-2 border-blue-400 bg-blue-50/20 rounded-lg text-xs font-semibold focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewCat(false)}
                      className="px-2 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={newItem.category}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingNewCat(true);
                        setCustomNewCat('');
                      } else {
                        setNewItem({ ...newItem, category: e.target.value });
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-blue-700 font-bold">
                      + Crear nueva categoría...
                    </option>
                  </select>
                )}
              </div>

              {/* Subcategoría */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Subcategoría *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewSubcat(!isCreatingNewSubcat);
                      if (!isCreatingNewSubcat) setCustomNewSubcat('');
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    {isCreatingNewSubcat ? '✕ Volver a lista' : '+ Nueva subcategoría'}
                  </button>
                </div>

                {isCreatingNewSubcat ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nombre de la nueva subcategoría..."
                      value={customNewSubcat}
                      onChange={(e) => setCustomNewSubcat(e.target.value)}
                      className="w-full p-2 border-2 border-blue-400 bg-blue-50/20 rounded-lg text-xs font-semibold focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSubcat(false)}
                      className="px-2 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={newItem.subcategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingNewSubcat(true);
                        setCustomNewSubcat('');
                      } else {
                        setNewItem({ ...newItem, subcategory: e.target.value });
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    {((subcategoriesByCategory[newItem.category] && subcategoriesByCategory[newItem.category].length > 0)
                      ? subcategoriesByCategory[newItem.category]
                      : allSubcategories
                    ).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-blue-700 font-bold">
                      + Crear nueva subcategoría...
                    </option>
                  </select>
                )}
              </div>

              {/* Sub-subcategoría (Opcional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase">
                    Sub-tipo / Sub-subcategoría <span className="text-slate-400 font-normal normal-case">(Opcional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNewSubSubcat(!isCreatingNewSubSubcat);
                      if (!isCreatingNewSubSubcat) setCustomNewSubSubcat('');
                    }}
                    className="text-[11px] text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    {isCreatingNewSubSubcat ? '✕ Volver a lista' : '+ Nuevo sub-tipo'}
                  </button>
                </div>

                {isCreatingNewSubSubcat ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nombre del nuevo sub-tipo..."
                      value={customNewSubSubcat}
                      onChange={(e) => setCustomNewSubSubcat(e.target.value)}
                      className="w-full p-2 border-2 border-blue-400 bg-blue-50/20 rounded-lg text-xs font-semibold focus:outline-none"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSubSubcat(false)}
                      className="px-2 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={newItem.subSubcategory}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') {
                        setIsCreatingNewSubSubcat(true);
                        setCustomNewSubSubcat('');
                      } else {
                        setNewItem({ ...newItem, subSubcategory: e.target.value });
                      }
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="">(Ninguno / Subcategoría general)</option>
                    {getChildrenForSubcat(newItem.category, newItem.subcategory).map((subSub) => (
                      <option key={subSub} value={subSub}>
                        {subSub}
                      </option>
                    ))}
                    <option value="__NEW__" className="text-blue-700 font-bold">
                      + Crear nuevo sub-tipo...
                    </option>
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Designación del Ensayo *
                </label>
                <textarea
                  required
                  rows={2}
                  value={newItem.designation}
                  onChange={(e) => setNewItem({ ...newItem, designation: e.target.value })}
                  placeholder="Nombre técnico completo..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                  Norma o Procedimiento
                </label>
                <input
                  type="text"
                  value={newItem.norm}
                  onChange={(e) => setNewItem({ ...newItem, norm: e.target.value })}
                  placeholder="ej. ASTM D2487-17 / NCh 1517"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Masa (kg)
                  </label>
                  <input
                    type="number"
                    value={newItem.minWeightKg}
                    onChange={(e) => setNewItem({ ...newItem, minWeightKg: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Unidad
                  </label>
                  <input
                    type="text"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">
                    Valor UF *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItem.ufPrice}
                    onChange={(e) => setNewItem({ ...newItem, ufPrice: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-sm cursor-pointer"
                >
                  Crear Ensayo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TarifarioPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando tarifario...</div>}>
      <TarifarioContent />
    </Suspense>
  );
}
