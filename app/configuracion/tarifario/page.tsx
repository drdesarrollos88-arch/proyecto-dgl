'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import TarifarioExportModal from '@/components/TarifarioExportModal';
import { CENTROS_DE_COSTO, SessionUser, TarifarioCategoryStructure, TarifarioItem, SubcategoryItem } from '@/lib/types';
import {
  FolderTree,
  FolderPlus,
  Plus,
  Edit2,
  Trash2,
  Search,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Layers,
  FileSpreadsheet,
  HelpCircle,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Database,
  Building,
  Tag,
  Check,
  X,
  FlaskConical,
  Filter,
  ArrowRightLeft,
  GripVertical,
  CheckSquare,
} from 'lucide-react';

// Helper to normalize subcategory items
function normalizeSub(sub: string | SubcategoryItem): { name: string; children: string[] } {
  if (typeof sub === 'string') return { name: sub.trim(), children: [] };
  return {
    name: (sub?.name || '').trim(),
    children: Array.isArray(sub?.children)
      ? sub.children.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
      : [],
  };
}

// Natural Roman Numeral and hierarchical sorting
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

function compareHierarchical(a: string | SubcategoryItem, b: string | SubcategoryItem): number {
  const strA = typeof a === 'string' ? a : a?.name || '';
  const strB = typeof b === 'string' ? b : b?.name || '';
  const partsA = parseRomanOrNum(strA);
  const partsB = parseRomanOrNum(strB);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA !== valB) {
      return valA - valB;
    }
  }
  return strA.localeCompare(strB, 'es', { numeric: true, sensitivity: 'base' });
}

function ConfiguracionTarifarioContent() {
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [structure, setStructure] = useState<TarifarioCategoryStructure[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [totalItems, setTotalItems] = useState(0);
  const [items, setItems] = useState<TarifarioItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCc, setSelectedCc] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Expand / collapse category essays & filtering state
  const [expandedCatKeys, setExpandedCatKeys] = useState<Record<string, boolean>>({});
  const [activeSubcatFilter, setActiveSubcatFilter] = useState<Record<string, string | null>>({});
  const [activeSubSubcatFilter, setActiveSubSubcatFilter] = useState<Record<string, string | null>>({});
  const [catSearchTerm, setCatSearchTerm] = useState<Record<string, string>>({});

  // Reassign / Edit Item Category Modal state
  const [reassignItem, setReassignItem] = useState<TarifarioItem | null>(null);
  const [reassignCc, setReassignCc] = useState<string>(CENTROS_DE_COSTO[0]);
  const [reassignCat, setReassignCat] = useState<string>('');
  const [isCustomCat, setIsCustomCat] = useState<boolean>(false);
  const [customCatName, setCustomCatName] = useState<string>('');
  const [reassignSubcat, setReassignSubcat] = useState<string>('');
  const [isCustomSubcat, setIsCustomSubcat] = useState<boolean>(false);
  const [customSubcatName, setCustomSubcatName] = useState<string>('');
  const [reassignSubSubcat, setReassignSubSubcat] = useState<string>('');
  const [isCustomSubSubcat, setIsCustomSubSubcat] = useState<boolean>(false);
  const [customSubSubcatName, setCustomSubSubcatName] = useState<string>('');

  // Modals state
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCreateCatModal, setShowCreateCatModal] = useState(false);
  const [newCatCc, setNewCatCc] = useState<string>(CENTROS_DE_COSTO[0]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatInitialSubcats, setNewCatInitialSubcats] = useState('');

  const [showCreateSubcatModal, setShowCreateSubcatModal] = useState(false);
  const [targetCategoryForSubcat, setTargetCategoryForSubcat] = useState<{
    cc: string;
    category: string;
    parentSubcategory?: string;
  } | null>(null);
  const [newSubcatName, setNewSubcatName] = useState('');

  const [renameCatData, setRenameCatData] = useState<{ cc: string; oldCategory: string; newCategory: string } | null>(null);
  const [renameSubcatData, setRenameSubcatData] = useState<{
    cc: string;
    category: string;
    oldSubcategory: string;
    newSubcategory: string;
    parentSubcategory?: string;
  } | null>(null);

  const [deleteConfirmData, setDeleteConfirmData] = useState<{
    type: 'category' | 'subcategory';
    cc: string;
    category: string;
    subcategory?: string;
    parentSubcategory?: string;
    count: number;
  } | null>(null);

  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Multi-selection state
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Drag & drop state
  const [draggedIds, setDraggedIds] = useState<string[] | null>(null);
  const [dragOverCatKey, setDragOverCatKey] = useState<string | null>(null);
  const [dragOverSubcatKey, setDragOverSubcatKey] = useState<string | null>(null);
  const [dragOverSubSubcatKey, setDragOverSubSubcatKey] = useState<string | null>(null);

  // Batch move state
  const [batchCc, setBatchCc] = useState<string>(CENTROS_DE_COSTO[0]);
  const [batchCat, setBatchCat] = useState<string>('');
  const [batchSubcat, setBatchSubcat] = useState<string>('');
  const [batchSubSubcat, setBatchSubSubcat] = useState<string>('');

  // Load structure & user
  const loadData = async () => {
    try {
      const [userRes, structRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/tarifario/estructura'),
      ]);

      if (userRes.ok) {
        const u = await userRes.json();
        if (u.user) setCurrentUser(u.user);
      }

      if (structRes.ok) {
        const s = await structRes.json();
        const loadedStructure = s.structure || [];
        setStructure(loadedStructure);
        setItemCounts(s.itemCounts || {});
        setTotalItems(s.totalItems || 0);
        if (s.items && Array.isArray(s.items)) {
          setItems(s.items);
        }
        if (loadedStructure.length > 0) {
          setBatchCc((prev) => prev || loadedStructure[0].cc);
          setBatchCat((prev) => prev || loadedStructure[0].category);
        }
      }
    } catch (err) {
      console.error('Error cargando estructura:', err);
      showAlert('error', 'Error al cargar la estructura del tarifario.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showAlert = (type: 'success' | 'error', text: string) => {
    setAlertMessage({ type, text });
    setTimeout(() => {
      setAlertMessage(null);
    }, 5000);
  };

  // Batch Move helpers
  const availableBatchCategories = structure.filter((s) => s.cc === batchCc);
  const availableBatchSubcategories =
    availableBatchCategories.find((s) => s.category === batchCat)?.subcategories || [];
  const selectedBatchSubObj = availableBatchSubcategories
    .map(normalizeSub)
    .find((s) => s.name === batchSubcat);
  const availableBatchSubSubcategories = selectedBatchSubObj?.children || [];

  const handleBatchCcChange = (newCc: string) => {
    setBatchCc(newCc);
    const available = structure.filter((s) => s.cc === newCc);
    if (available.length > 0) {
      setBatchCat(available[0].category);
      setBatchSubcat('');
      setBatchSubSubcat('');
    } else {
      setBatchCat('');
      setBatchSubcat('');
      setBatchSubSubcat('');
    }
  };

  const handleBatchCatChange = (newCat: string) => {
    setBatchCat(newCat);
    setBatchSubcat('');
    setBatchSubSubcat('');
  };

  const handleBatchSubcatChange = (newSub: string) => {
    setBatchSubcat(newSub);
    setBatchSubSubcat('');
  };

  // Selection toggle
  const toggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDisplayed = (displayed: TarifarioItem[]) => {
    const displayedIds = displayed.map((d) => d.id);
    const allSelected = displayedIds.length > 0 && displayedIds.every((id) => selectedItemIds.includes(id));
    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !displayedIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...displayedIds])));
    }
  };

  // Move items execution (used by Drag & Drop and Batch toolbar)
  const executeMoveItems = async (
    ids: string[],
    targetCc: string,
    targetCategory: string,
    targetSubcategory?: string,
    targetSubSubcategory?: string
  ) => {
    if (!ids || ids.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/tarifario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batchMove',
          ids,
          targetCc,
          targetCategory,
          targetSubcategory: targetSubcategory || targetCategory,
          targetSubSubcategory: targetSubSubcategory || '',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al mover los ensayos.');
      }

      const destPath = [
        targetCategory,
        targetSubcategory && targetSubcategory !== targetCategory ? targetSubcategory : null,
        targetSubSubcategory || null,
      ]
        .filter(Boolean)
        .join(' > ');

      showAlert(
        'success',
        `✓ Se movieron ${ids.length} ensayo(s) a "${destPath}" exitosamente.`
      );
      setSelectedItemIds([]);
      setDraggedIds(null);
      await loadData();
    } catch (err: any) {
      console.error('Error al mover ensayos:', err);
      showAlert('error', err.message || 'Error al mover los ensayos.');
    } finally {
      setSubmitting(false);
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, item: TarifarioItem) => {
    const idsToDrag =
      selectedItemIds.includes(item.id) && selectedItemIds.length > 1
        ? selectedItemIds
        : [item.id];
    setDraggedIds(idsToDrag);
    e.dataTransfer.setData('application/json', JSON.stringify({ ids: idsToDrag }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIds(null);
    setDragOverCatKey(null);
    setDragOverSubcatKey(null);
    setDragOverSubSubcatKey(null);
  };

  const handleCategoryDragOver = (e: React.DragEvent, catKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverCatKey !== catKey) {
      setDragOverCatKey(catKey);
    }
  };

  const handleCategoryDragLeave = (e: React.DragEvent, catKey: string) => {
    e.preventDefault();
    if (e.currentTarget === e.target) {
      setDragOverCatKey(null);
    }
  };

  const handleCategoryDrop = async (e: React.DragEvent, targetCc: string, targetCategory: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCatKey(null);
    setDragOverSubcatKey(null);
    setDragOverSubSubcatKey(null);

    let ids = draggedIds || [];
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.ids) && parsed.ids.length > 0) ids = parsed.ids;
      }
    } catch {}

    if (ids.length > 0) {
      await executeMoveItems(ids, targetCc, targetCategory);
    }
  };

  const handleSubcategoryDragOver = (e: React.DragEvent, subKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSubcatKey !== subKey) {
      setDragOverSubcatKey(subKey);
    }
  };

  const handleSubcategoryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubcatKey(null);
  };

  const handleSubcategoryDrop = async (
    e: React.DragEvent,
    targetCc: string,
    targetCategory: string,
    targetSubcategory: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCatKey(null);
    setDragOverSubcatKey(null);
    setDragOverSubSubcatKey(null);

    let ids = draggedIds || [];
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.ids) && parsed.ids.length > 0) ids = parsed.ids;
      }
    } catch {}

    if (ids.length > 0) {
      await executeMoveItems(ids, targetCc, targetCategory, targetSubcategory, '');
    }
  };

  const handleSubSubcategoryDragOver = (e: React.DragEvent, subSubKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSubSubcatKey !== subSubKey) {
      setDragOverSubSubcatKey(subSubKey);
    }
  };

  const handleSubSubcategoryDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSubSubcatKey(null);
  };

  const handleSubSubcategoryDrop = async (
    e: React.DragEvent,
    targetCc: string,
    targetCategory: string,
    targetSubcategory: string,
    targetSubSubcategory: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCatKey(null);
    setDragOverSubcatKey(null);
    setDragOverSubSubcatKey(null);

    let ids = draggedIds || [];
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.ids) && parsed.ids.length > 0) ids = parsed.ids;
      }
    } catch {}

    if (ids.length > 0) {
      await executeMoveItems(ids, targetCc, targetCategory, targetSubcategory, targetSubSubcategory);
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
  const canEdit = isAdmin || currentUser?.permissions?.includes('tarifario.editar');

  const toggleCategoryExpand = (catKey: string) => {
    setExpandedCatKeys((prev) => ({
      ...prev,
      [catKey]: !prev[catKey],
    }));
  };

  const handleSubcategoryClick = (catKey: string, subcat: string) => {
    setExpandedCatKeys((prev) => ({ ...prev, [catKey]: true }));
    setActiveSubcatFilter((prev) => {
      const isSame = prev[catKey] === subcat;
      return { ...prev, [catKey]: isSame ? null : subcat };
    });
    setActiveSubSubcatFilter((prev) => ({ ...prev, [catKey]: null }));
  };

  const handleSubSubcategoryClick = (catKey: string, subcat: string, subSubcat: string) => {
    setExpandedCatKeys((prev) => ({ ...prev, [catKey]: true }));
    setActiveSubcatFilter((prev) => ({ ...prev, [catKey]: subcat }));
    setActiveSubSubcatFilter((prev) => {
      const isSame = prev[catKey] === subSubcat;
      return { ...prev, [catKey]: isSame ? null : subSubcat };
    });
  };

  const openReassignModal = (item: TarifarioItem) => {
    setReassignItem(item);
    const itemCc = item.cc || CENTROS_DE_COSTO[0];
    setReassignCc(itemCc);
    setReassignCat(item.category || '');
    setIsCustomCat(false);
    setCustomCatName('');
    setReassignSubcat(item.subcategory || '');
    setIsCustomSubcat(false);
    setCustomSubcatName('');
    setReassignSubSubcat(item.subSubcategory || '');
    setIsCustomSubSubcat(false);
    setCustomSubSubcatName('');
  };

  const handleCcChangeInModal = (newCc: string) => {
    setReassignCc(newCc);
    const available = structure.filter((s) => s.cc === newCc);
    if (available.length > 0) {
      setReassignCat(available[0].category);
      setIsCustomCat(false);
      const subcats = available[0].subcategories || [];
      if (subcats.length > 0) {
        const firstSub = normalizeSub(subcats[0]);
        setReassignSubcat(firstSub.name);
        setIsCustomSubcat(false);
        setReassignSubSubcat('');
        setIsCustomSubSubcat(false);
      } else {
        setReassignSubcat('');
        setReassignSubSubcat('');
      }
    } else {
      setReassignCat('');
      setIsCustomCat(true);
      setCustomCatName('');
      setReassignSubcat('');
      setReassignSubSubcat('');
    }
  };

  const handleCatChangeInModal = (newCat: string) => {
    if (newCat === '__CUSTOM__') {
      setIsCustomCat(true);
      setCustomCatName('');
      setReassignSubcat('');
      setIsCustomSubcat(true);
      setCustomSubcatName('');
      setReassignSubSubcat('');
      setIsCustomSubSubcat(false);
    } else {
      setIsCustomCat(false);
      setReassignCat(newCat);
      const catObj = structure.find((s) => s.cc === reassignCc && s.category === newCat);
      const subcats = catObj?.subcategories || [];
      if (subcats.length > 0) {
        const firstSub = normalizeSub(subcats[0]);
        setReassignSubcat(firstSub.name);
        setIsCustomSubcat(false);
        setReassignSubSubcat('');
        setIsCustomSubSubcat(false);
      } else {
        setReassignSubcat('');
        setReassignSubSubcat('');
      }
    }
  };

  const handleSubcatChangeInModal = (newSub: string) => {
    if (newSub === '__CUSTOM__') {
      setIsCustomSubcat(true);
      setCustomSubcatName('');
      setReassignSubSubcat('');
      setIsCustomSubSubcat(false);
    } else {
      setIsCustomSubcat(false);
      setReassignSubcat(newSub);
      setReassignSubSubcat('');
      setIsCustomSubSubcat(false);
    }
  };

  const handleSubSubcatChangeInModal = (newSubSub: string) => {
    if (newSubSub === '__CUSTOM__') {
      setIsCustomSubSubcat(true);
      setCustomSubSubcatName('');
    } else {
      setIsCustomSubSubcat(false);
      setReassignSubSubcat(newSubSub);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignItem) return;

    const finalCategory = (isCustomCat ? customCatName : reassignCat).trim();
    const finalSubcategory = (isCustomSubcat ? customSubcatName : reassignSubcat).trim();
    const finalSubSubcategory = (isCustomSubSubcat ? customSubSubcatName : reassignSubSubcat).trim();

    if (!finalCategory) {
      showAlert('error', 'Debes seleccionar o ingresar una categoría destino.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/tarifario', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reassignItem.id,
          updates: {
            cc: reassignCc,
            category: finalCategory,
            subcategory: finalSubcategory || finalCategory,
            subSubcategory: finalSubSubcategory,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al reasignar categoría.');
      }

      showAlert(
        'success',
        `Ensayo "${reassignItem.designation.slice(0, 45)}..." reasignado con éxito a "${finalCategory}".`
      );
      setReassignItem(null);
      await loadData();
    } catch (err: any) {
      console.error('Error reasignando ensayo:', err);
      showAlert('error', err.message || 'Error al reasignar el ensayo.');
    } finally {
      setSubmitting(false);
    }
  };

  // Structure filtered by Centro de Costo and Search
  const currentCcStructure = selectedCc === 'todos' ? structure : structure.filter((s) => s.cc === selectedCc);
  const sortedCategories = [...currentCcStructure].sort((a, b) => compareHierarchical(a.category, b.category));

  const filteredCategories = sortedCategories.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchesCat = cat.category.toLowerCase().includes(q);
    const matchesSub = (cat.subcategories || []).some((s) => {
      const norm = normalizeSub(s);
      return (
        norm.name.toLowerCase().includes(q) ||
        norm.children.some((c) => c.toLowerCase().includes(q))
      );
    });
    const catItems = items.filter((it) => it.cc === cat.cc && it.category === cat.category);
    const matchesItem = catItems.some(
      (it) =>
        it.designation.toLowerCase().includes(q) ||
        (it.sku && it.sku.toLowerCase().includes(q)) ||
        (it.code && it.code.toLowerCase().includes(q)) ||
        (it.norm && it.norm.toLowerCase().includes(q)) ||
        (it.subSubcategory && it.subSubcategory.toLowerCase().includes(q))
    );
    return matchesCat || matchesSub || matchesItem;
  });

  // Calculate totals for KPI cards
  const totalCategoriesCount = structure.length;
  const totalSubcategoriesCount = structure.reduce((acc, curr) => {
    return (
      acc +
      (curr.subcategories || []).reduce((subAcc, s) => {
        const norm = normalizeSub(s);
        return subAcc + 1 + norm.children.length;
      }, 0)
    );
  }, 0);

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    setSubmitting(true);
    try {
      const subcatsList = newCatInitialSubcats
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch('/api/tarifario/estructura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          cc: newCatCc,
          category: newCatName.trim(),
          subcategories: subcatsList,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al crear la categoría.');
      }

      showAlert('success', 'Categoría creada exitosamente.');
      setShowCreateCatModal(false);
      setNewCatName('');
      setNewCatInitialSubcats('');
      setSelectedCc(newCatCc);
      await loadData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al crear la categoría.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Create Subcategory
  const handleCreateSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCategoryForSubcat || !newSubcatName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tarifario/estructura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subcategory',
          cc: targetCategoryForSubcat.cc,
          category: targetCategoryForSubcat.category,
          subcategory: newSubcatName.trim(),
          parentSubcategory: targetCategoryForSubcat.parentSubcategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al agregar la subcategoría.');
      }

      showAlert(
        'success',
        targetCategoryForSubcat.parentSubcategory
          ? 'Sub-subcategoría agregada exitosamente.'
          : 'Subcategoría agregada exitosamente.'
      );
      setShowCreateSubcatModal(false);
      setTargetCategoryForSubcat(null);
      setNewSubcatName('');
      await loadData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al crear la subcategoría.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Rename Category
  const handleRenameCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameCatData || !renameCatData.newCategory.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tarifario/estructura', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'renameCategory',
          cc: renameCatData.cc,
          oldCategory: renameCatData.oldCategory,
          newCategory: renameCatData.newCategory.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al renombrar categoría.');
      }

      showAlert('success', data.message || 'Categoría renombrada con éxito.');
      setRenameCatData(null);
      await loadData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al renombrar categoría.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Rename Subcategory
  const handleRenameSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameSubcatData || !renameSubcatData.newSubcategory.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tarifario/estructura', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'renameSubcategory',
          cc: renameSubcatData.cc,
          category: renameSubcatData.category,
          oldSubcategory: renameSubcatData.oldSubcategory,
          newSubcategory: renameSubcatData.newSubcategory.trim(),
          parentSubcategory: renameSubcatData.parentSubcategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al renombrar subcategoría.');
      }

      showAlert('success', data.message || 'Subcategoría renombrada con éxito.');
      setRenameSubcatData(null);
      await loadData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al renombrar subcategoría.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteExecute = async () => {
    if (!deleteConfirmData) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/tarifario/estructura', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deleteConfirmData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al eliminar.');
      }

      showAlert('success', data.message || 'Eliminación completada con éxito.');
      setDeleteConfirmData(null);
      await loadData();
    } catch (err: any) {
      showAlert('error', err.message || 'Error al eliminar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href="/tarifario" className="hover:text-red-700 flex items-center gap-1 font-medium transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Volver al Tarifado Oficial
            </Link>
            <span>/</span>
            <span className="text-slate-700 font-semibold">Configuración de Estructura</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Descargar Excel Personalizado
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  setNewCatCc(selectedCc);
                  setShowCreateCatModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors shadow-xs cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                + Nueva Categoría
              </button>
            )}
          </div>
        </div>

        {/* Alert Notification */}
        {alertMessage && (
          <div
            className={`mb-5 p-3.5 rounded-xl border flex items-center gap-3 text-xs shadow-xs animate-in fade-in duration-150 ${
              alertMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {alertMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span className="font-medium">{alertMessage.text}</span>
          </div>
        )}

        {/* Header Title Section */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-700">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    Configuración del Tarifario Oficial
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define, organiza y administra las categorías y subcategorías oficiales por Centro de Costo
                  </p>
                </div>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-slate-500 font-medium block">Centros de Costo</span>
                <span className="text-base font-bold text-slate-900">{CENTROS_DE_COSTO.length}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-slate-500 font-medium block">Categorías</span>
                <span className="text-base font-bold text-slate-900">{totalCategoriesCount}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-slate-500 font-medium block">Subcategorías</span>
                <span className="text-base font-bold text-slate-900">{totalSubcategoriesCount}</span>
              </div>
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2">
                <span className="text-[11px] text-slate-500 font-medium block">Ensayos en Base</span>
                <span className="text-base font-bold text-red-700">{totalItems}</span>
              </div>
            </div>
          </div>
        </div>

        {/* CC Tabs Selector */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 mb-6">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-slate-100 overflow-x-auto scrollbar-thin">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 shrink-0">
              Centro de Costo:
            </span>

            {/* Tab: Todos los CC */}
            <button
              onClick={() => setSelectedCc('todos')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCc === 'todos'
                  ? 'bg-red-700 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${selectedCc === 'todos' ? 'text-red-200' : 'text-slate-400'}`} />
              <span>Todos los CC</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  selectedCc === 'todos' ? 'bg-red-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {structure.length} cat. · {totalItems} ens.
              </span>
            </button>

            {CENTROS_DE_COSTO.map((cc) => {
              const isActive = selectedCc === cc;
              const ccEssaysCount = itemCounts[cc] || 0;
              const ccCats = structure.filter((s) => s.cc === cc);

              return (
                <button
                  key={cc}
                  onClick={() => setSelectedCc(cc)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-red-700 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <Building className={`w-3.5 h-3.5 ${isActive ? 'text-red-200' : 'text-slate-400'}`} />
                  <span>{cc}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      isActive ? 'bg-red-800 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ccCats.length} cat. · {ccEssaysCount} ens.
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search bar within current CC */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar categoría, subcategoría o ensayo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Mostrando <strong className="text-slate-800">{filteredCategories.length}</strong> categorías para{' '}
              <span className="text-red-700 font-semibold">
                {selectedCc === 'todos' ? 'Todos los Centros de Costo' : selectedCc}
              </span>
            </div>
          </div>
        </div>

        {/* Categories Tree Grid */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="inline-block w-8 h-8 border-3 border-red-700 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-slate-500 font-medium">Cargando estructura oficial...</p>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery ? 'No se encontraron coincidencias' : 'No hay categorías creadas para este Centro de Costo'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {searchQuery
                ? 'Intenta con otro término de búsqueda o limpia el filtro.'
                : 'Puedes crear la primera categoría para organizar los ensayos de este centro de costo.'}
            </p>
            {isAdmin && !searchQuery && (
              <button
                onClick={() => {
                  setNewCatCc(selectedCc === 'todos' ? CENTROS_DE_COSTO[0] : selectedCc);
                  setShowCreateCatModal(true);
                }}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 transition-colors shadow-xs cursor-pointer"
              >
                <FolderPlus className="w-4 h-4" />
                Crear Categoría en {selectedCc === 'todos' ? 'Tarifario' : selectedCc.split('-')[0].trim()}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map((cat) => {
              const catKey = `${cat.cc}:::${cat.category}`;
              const catEssaysCount = itemCounts[catKey] || 0;
              const sortedSubcats = [...(cat.subcategories || [])].sort(compareHierarchical);
              const isExpanded = !!expandedCatKeys[catKey];
              const activeSubcat = activeSubcatFilter[catKey] || null;
              const activeSubSubcat = activeSubSubcatFilter[catKey] || null;

              // Items belonging to this category
              const catAllItems = items.filter(
                (it) => it.cc === cat.cc && it.category === cat.category
              );

              // Filtered by active subcategory if selected
              let filteredBySubcat = activeSubcat
                ? catAllItems.filter((it) => (it.subcategory || '').trim() === activeSubcat.trim())
                : catAllItems;

              if (activeSubSubcat) {
                filteredBySubcat = filteredBySubcat.filter(
                  (it) => (it.subSubcategory || '').trim() === activeSubSubcat.trim()
                );
              }

              // Filtered by local search in this category
              const localSearch = (catSearchTerm[catKey] || '').toLowerCase().trim();
              const displayedItems = filteredBySubcat.filter((it) => {
                if (!localSearch) return true;
                return (
                  it.designation.toLowerCase().includes(localSearch) ||
                  (it.code && it.code.toLowerCase().includes(localSearch)) ||
                  (it.sku && it.sku.toLowerCase().includes(localSearch)) ||
                  (it.norm && it.norm.toLowerCase().includes(localSearch)) ||
                  (it.subcategory && it.subcategory.toLowerCase().includes(localSearch)) ||
                  (it.subSubcategory && it.subSubcategory.toLowerCase().includes(localSearch))
                );
              });

              const isDragOver = dragOverCatKey === catKey;

              return (
                <div
                  key={catKey}
                  onDragOver={(e) => handleCategoryDragOver(e, catKey)}
                  onDragLeave={(e) => handleCategoryDragLeave(e, catKey)}
                  onDrop={(e) => handleCategoryDrop(e, cat.cc, cat.category)}
                  className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                    isDragOver
                      ? 'border-red-500 shadow-xl ring-2 ring-red-400 bg-red-50/20 scale-[1.008]'
                      : isExpanded
                      ? 'border-red-200 shadow-md ring-1 ring-red-100'
                      : 'border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
                >
                  {isDragOver && (
                    <div className="bg-red-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>Soltar aquí para mover los ensayos a &quot;{cat.category}&quot;</span>
                    </div>
                  )}

                  {/* Category Header */}
                  <div className="bg-slate-50/90 px-5 py-3.5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div
                      onClick={() => toggleCategoryExpand(catKey)}
                      className="flex items-center gap-3 cursor-pointer select-none group/title flex-1 min-w-0"
                    >
                      <div className="w-8 h-8 rounded-lg bg-red-100/70 border border-red-200 flex items-center justify-center text-red-700 shrink-0 font-bold text-xs group-hover/title:bg-red-200/70 transition-colors">
                        <FolderTree className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-bold text-slate-900 tracking-tight group-hover/title:text-red-700 transition-colors truncate">
                            {cat.category}
                          </h2>
                          {selectedCc === 'todos' && (
                            <span className="text-[10px] bg-slate-200 text-slate-800 px-2 py-0.5 rounded-md font-bold flex items-center gap-1 border border-slate-300/80">
                              <Building className="w-3 h-3 text-slate-500" />
                              {cat.cc}
                            </span>
                          )}
                          <span className="text-[10px] bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full font-semibold">
                            {cat.subcategories?.length || 0} subcategorías
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              catEssaysCount > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {catEssaysCount} {catEssaysCount === 1 ? 'ensayo' : 'ensayos'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Category Action Buttons */}
                    <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                      {/* Toggle View Essays Button */}
                      <button
                        onClick={() => toggleCategoryExpand(catKey)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                          isExpanded
                            ? 'bg-red-700 text-white hover:bg-red-800'
                            : 'bg-white text-slate-700 hover:text-red-700 hover:border-red-200 border border-slate-200'
                        }`}
                        title={isExpanded ? 'Ocultar ensayos de esta categoría' : 'Ver ensayos alojados en esta categoría'}
                      >
                        <FlaskConical className={`w-3.5 h-3.5 ${isExpanded ? 'text-white' : 'text-red-600'}`} />
                        <span>{isExpanded ? 'Ocultar Ensayos' : `Ver Ensayos (${catEssaysCount})`}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isAdmin && (
                        <>
                          <button
                            onClick={() => {
                              setTargetCategoryForSubcat({ cc: cat.cc, category: cat.category });
                              setShowCreateSubcatModal(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-red-700 hover:border-red-200 text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                            title="Agregar subcategoría dentro de esta categoría"
                          >
                            <Plus className="w-3.5 h-3.5 text-red-600" />
                            <span className="hidden sm:inline">+ Subcategoría</span>
                          </button>

                          <button
                            onClick={() => {
                              setRenameCatData({
                                cc: cat.cc,
                                oldCategory: cat.category,
                                newCategory: cat.category,
                              });
                            }}
                            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-blue-700 hover:border-blue-200 transition-colors shadow-2xs cursor-pointer"
                            title="Renombrar categoría"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Empty Category prominent button */}
                          {catEssaysCount === 0 ? (
                            <button
                              onClick={() => {
                                setDeleteConfirmData({
                                  type: 'category',
                                  cc: cat.cc,
                                  category: cat.category,
                                  count: 0,
                                });
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                              title="Eliminar esta categoría vacía permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Eliminar Categoría Vacía</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-300 cursor-not-allowed shadow-2xs"
                              title={`Tiene ${catEssaysCount} ensayo(s) asociado(s). Reasigna los ensayos para poder eliminarla.`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Subcategories Grid */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Subcategorías ({sortedSubcats.length})
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {sortedSubcats.length > 0 ? 'Pincha una subcategoría para filtrar sus ensayos' : ''}
                      </span>
                    </div>

                    {sortedSubcats.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-500">
                          Esta categoría no tiene subcategorías aún.
                        </p>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setTargetCategoryForSubcat({ cc: cat.cc, category: cat.category });
                              setShowCreateSubcatModal(true);
                            }}
                            className="mt-2 inline-flex items-center gap-1 text-xs text-red-700 hover:text-red-800 font-semibold cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Agregar la primera subcategoría
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {sortedSubcats.map((rawSubcat) => {
                          const normSub = normalizeSub(rawSubcat);
                          const subcat = normSub.name;
                          const children = normSub.children || [];
                          const subKey = `${cat.cc}:::${cat.category}:::${subcat}`;
                          const subEssaysCount = itemCounts[subKey] || 0;
                          const isSubActive = activeSubcat === subcat && isExpanded && !activeSubSubcat;
                          const isSubcatDragOver = dragOverSubcatKey === subKey;

                          return (
                            <div
                              key={subKey}
                              onClick={() => handleSubcategoryClick(catKey, subcat)}
                              onDragOver={(e) => handleSubcategoryDragOver(e, subKey)}
                              onDragLeave={handleSubcategoryDragLeave}
                              onDrop={(e) => handleSubcategoryDrop(e, cat.cc, cat.category, subcat)}
                              className={`group flex flex-col justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                isSubcatDragOver
                                  ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-400 shadow-md scale-[1.02]'
                                  : isSubActive
                                  ? 'bg-red-50/90 border-red-400 shadow-xs ring-1 ring-red-300'
                                  : 'border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-2xs'
                              }`}
                              title={
                                isSubcatDragOver
                                  ? `Soltar aquí para mover a la subcategoría "${subcat}"`
                                  : `Pincha para ver los ensayos de ${subcat}`
                              }
                            >
                              {/* Subcategory Top Row */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0 flex-1">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 mt-1 transition-colors ${
                                      isSubcatDragOver
                                        ? 'bg-emerald-600 ring-2 ring-emerald-300'
                                        : isSubActive
                                        ? 'bg-red-600 ring-2 ring-red-200'
                                        : 'bg-slate-400 group-hover:bg-red-600'
                                    }`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-xs font-semibold leading-tight ${
                                        isSubActive ? 'text-red-900' : 'text-slate-800'
                                      }`}
                                      title={subcat}
                                    >
                                      {subcat}
                                    </p>
                                    <span
                                      className={`text-[10px] font-medium block mt-0.5 ${
                                        subEssaysCount > 0 ? 'text-emerald-700' : 'text-slate-400'
                                      }`}
                                    >
                                      {subEssaysCount} {subEssaysCount === 1 ? 'ensayo' : 'ensayos'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  {isAdmin && (
                                    <>
                                      <button
                                        onClick={() => {
                                          setTargetCategoryForSubcat({
                                            cc: cat.cc,
                                            category: cat.category,
                                            parentSubcategory: subcat,
                                          });
                                          setShowCreateSubcatModal(true);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                                        title="Agregar sub-tipo (sub-subcategoría) dentro de esta subcategoría"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>

                                      <button
                                        onClick={() => {
                                          setRenameSubcatData({
                                            cc: cat.cc,
                                            category: cat.category,
                                            oldSubcategory: subcat,
                                            newSubcategory: subcat,
                                          });
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                                        title="Renombrar subcategoría"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>

                                      <button
                                        onClick={() => {
                                          setDeleteConfirmData({
                                            type: 'subcategory',
                                            cc: cat.cc,
                                            category: cat.category,
                                            subcategory: subcat,
                                            count: subEssaysCount,
                                          });
                                        }}
                                        className={`p-1 rounded-md transition-colors ${
                                          subEssaysCount > 0
                                            ? 'text-slate-300 hover:text-slate-400 cursor-not-allowed'
                                            : 'text-slate-400 hover:text-red-700 hover:bg-red-50 cursor-pointer'
                                        }`}
                                        title={
                                          subEssaysCount > 0
                                            ? `Tiene ${subEssaysCount} ensayo(s) asociado(s)`
                                            : 'Eliminar subcategoría vacía'
                                        }
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Level 3: Nested Sub-subcategories (if any) */}
                              {children.length > 0 && (
                                <div className="mt-2.5 pt-2 border-t border-slate-200/80 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 px-0.5">
                                    <span className="flex items-center gap-1">
                                      <Layers className="w-3 h-3" />
                                      SUB-TIPOS ({children.length})
                                    </span>
                                    {isAdmin && (
                                      <button
                                        onClick={() => {
                                          setTargetCategoryForSubcat({
                                            cc: cat.cc,
                                            category: cat.category,
                                            parentSubcategory: subcat,
                                          });
                                          setShowCreateSubcatModal(true);
                                        }}
                                        className="text-[10px] text-red-700 hover:underline font-semibold cursor-pointer"
                                      >
                                        + Agregar
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    {children.map((child) => {
                                      const subSubKey = `${cat.cc}:::${cat.category}:::${subcat}:::${child}`;
                                      const childCount = itemCounts[subSubKey] || 0;
                                      const isChildActive =
                                        activeSubcat === subcat && activeSubSubcat === child && isExpanded;
                                      const isChildDragOver = dragOverSubSubcatKey === subSubKey;

                                      return (
                                        <div
                                          key={subSubKey}
                                          onClick={() => handleSubSubcategoryClick(catKey, subcat, child)}
                                          onDragOver={(e) => handleSubSubcategoryDragOver(e, subSubKey)}
                                          onDragLeave={handleSubSubcategoryDragLeave}
                                          onDrop={(e) => handleSubSubcategoryDrop(e, cat.cc, cat.category, subcat, child)}
                                          className={`group/child flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg border text-xs transition-all cursor-pointer ${
                                            isChildDragOver
                                              ? 'bg-emerald-100 border-emerald-500 ring-2 ring-emerald-400 shadow-xs font-bold text-emerald-900 scale-102'
                                              : isChildActive
                                              ? 'bg-red-100/90 border-red-400 text-red-900 font-semibold ring-1 ring-red-300'
                                              : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700'
                                          }`}
                                          title={
                                            isChildDragOver
                                              ? `Soltar aquí para mover al sub-tipo "${child}"`
                                              : `Pincha para filtrar ensayos del sub-tipo ${child}`
                                          }
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            <span
                                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                isChildDragOver
                                                  ? 'bg-emerald-600'
                                                  : isChildActive
                                                  ? 'bg-red-600'
                                                  : 'bg-slate-400 group-hover/child:bg-red-500'
                                              }`}
                                            />
                                            <span className="text-[11px] truncate flex-1 font-medium" title={child}>
                                              {child}
                                            </span>
                                            <span
                                              className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold ${
                                                childCount > 0
                                                  ? 'bg-emerald-100 text-emerald-800'
                                                  : 'text-slate-400'
                                              }`}
                                            >
                                              {childCount}
                                            </span>
                                          </div>

                                          {isAdmin && (
                                            <div
                                              className="flex items-center gap-0.5 opacity-60 group-hover/child:opacity-100 transition-opacity"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <button
                                                onClick={() => {
                                                  setRenameSubcatData({
                                                    cc: cat.cc,
                                                    category: cat.category,
                                                    oldSubcategory: child,
                                                    newSubcategory: child,
                                                    parentSubcategory: subcat,
                                                  });
                                                }}
                                                className="p-0.5 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                                                title="Renombrar sub-tipo"
                                              >
                                                <Edit2 className="w-2.5 h-2.5" />
                                              </button>
                                              <button
                                                onClick={() => {
                                                  setDeleteConfirmData({
                                                    type: 'subcategory',
                                                    cc: cat.cc,
                                                    category: cat.category,
                                                    subcategory: child,
                                                    parentSubcategory: subcat,
                                                    count: childCount,
                                                  });
                                                }}
                                                className={`p-0.5 rounded cursor-pointer ${
                                                  childCount > 0
                                                    ? 'text-slate-300 cursor-not-allowed'
                                                    : 'text-slate-400 hover:text-red-700 hover:bg-red-50'
                                                }`}
                                                title={
                                                  childCount > 0
                                                    ? `Tiene ${childCount} ensayo(s) asociado(s)`
                                                    : 'Eliminar sub-tipo vacío'
                                                }
                                              >
                                                <Trash2 className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Subtle button to add first child if none */}
                              {children.length === 0 && isAdmin && (
                                <div className="mt-2 pt-1 border-t border-slate-100 flex justify-end" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => {
                                      setTargetCategoryForSubcat({
                                        cc: cat.cc,
                                        category: cat.category,
                                        parentSubcategory: subcat,
                                      });
                                      setShowCreateSubcatModal(true);
                                    }}
                                    className="text-[10px] text-slate-400 hover:text-red-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-2.5 h-2.5" />
                                    + Agregar sub-tipo
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Expanded Ensayos Drawer / Table */}
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                      {/* Filter & Search Toolbar */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                        {/* Subcategory & Sub-subcategory Filter Pills */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                              <Filter className="w-3.5 h-3.5 text-slate-400" />
                              Subcategoría:
                            </span>
                            <button
                              onClick={() => {
                                setActiveSubcatFilter((prev) => ({ ...prev, [catKey]: null }));
                                setActiveSubSubcatFilter((prev) => ({ ...prev, [catKey]: null }));
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                                activeSubcat === null
                                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 font-medium'
                              }`}
                            >
                              Todas ({catAllItems.length})
                            </button>
                            {sortedSubcats.map((rawSubcat) => {
                              const normSub = normalizeSub(rawSubcat);
                              const subcat = normSub.name;
                              const subKey = `${cat.cc}:::${cat.category}:::${subcat}`;
                              const count = itemCounts[subKey] || 0;
                              const isSubActive = activeSubcat === subcat;
                              return (
                                <button
                                  key={subcat}
                                  onClick={() => {
                                    setActiveSubcatFilter((prev) => ({
                                      ...prev,
                                      [catKey]: isSubActive ? null : subcat,
                                    }));
                                    setActiveSubSubcatFilter((prev) => ({ ...prev, [catKey]: null }));
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-xs transition-all truncate max-w-[240px] cursor-pointer ${
                                    isSubActive
                                      ? 'bg-red-700 text-white shadow-xs font-semibold'
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 font-medium'
                                  }`}
                                  title={subcat}
                                >
                                  {subcat} ({count})
                                </button>
                              );
                            })}
                          </div>

                          {/* Level 3 Sub-subcategories filter row if activeSubcat has children */}
                          {activeSubcat && (() => {
                            const currentSubObj = sortedSubcats.map(normalizeSub).find((s) => s.name === activeSubcat);
                            const children = currentSubObj?.children || [];
                            if (children.length === 0) return null;
                            const parentSubKey = `${cat.cc}:::${cat.category}:::${activeSubcat}`;
                            const totalInSubcat = itemCounts[parentSubKey] || 0;

                            return (
                              <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-200/60">
                                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-slate-400" />
                                  Sub-tipo:
                                </span>
                                <button
                                  onClick={() => setActiveSubSubcatFilter((prev) => ({ ...prev, [catKey]: null }))}
                                  className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer ${
                                    activeSubSubcat === null
                                      ? 'bg-slate-700 text-white shadow-xs font-semibold'
                                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 font-medium'
                                  }`}
                                >
                                  Todos ({totalInSubcat})
                                </button>
                                {children.map((child) => {
                                  const childKey = `${cat.cc}:::${cat.category}:::${activeSubcat}:::${child}`;
                                  const childCount = itemCounts[childKey] || 0;
                                  const isChildActive = activeSubSubcat === child;
                                  return (
                                    <button
                                      key={child}
                                      onClick={() =>
                                        setActiveSubSubcatFilter((prev) => ({
                                          ...prev,
                                          [catKey]: isChildActive ? null : child,
                                        }))
                                      }
                                      className={`px-2 py-0.5 rounded-md text-[11px] transition-all truncate max-w-[200px] cursor-pointer ${
                                        isChildActive
                                          ? 'bg-red-700 text-white shadow-xs font-semibold'
                                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 font-medium'
                                      }`}
                                      title={child}
                                    >
                                      {child} ({childCount})
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Local Search Input */}
                        <div className="relative w-full sm:w-64 shrink-0">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filtrar ensayos en categoría..."
                            value={catSearchTerm[catKey] || ''}
                            onChange={(e) =>
                              setCatSearchTerm((prev) => ({ ...prev, [catKey]: e.target.value }))
                            }
                            className="w-full pl-8 pr-6 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-600"
                          />
                          {catSearchTerm[catKey] && (
                            <button
                              onClick={() => setCatSearchTerm((prev) => ({ ...prev, [catKey]: '' }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Table of Essays */}
                      {displayedItems.length === 0 ? (
                        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center">
                          <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs text-slate-600 font-semibold">
                            {catAllItems.length === 0
                              ? 'Esta categoría no tiene ensayos alojados todavía.'
                              : 'No se encontraron ensayos con los filtros aplicados.'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {catAllItems.length === 0
                              ? 'Puedes reasignar o arrastrar ensayos hacia esta categoría, o eliminarla si ya no la necesitas.'
                              : 'Prueba limpiando la búsqueda o el filtro de subcategoría.'}
                          </p>
                          {catAllItems.length === 0 && isAdmin && (
                            <div className="mt-3 flex items-center justify-center">
                              <button
                                onClick={() => {
                                  setDeleteConfirmData({
                                    type: 'category',
                                    cc: cat.cc,
                                    category: cat.category,
                                    count: 0,
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Eliminar esta categoría vacía ahora</span>
                              </button>
                            </div>
                          )}
                          {activeSubcat && (
                            <button
                              onClick={() => setActiveSubcatFilter((prev) => ({ ...prev, [catKey]: null }))}
                              className="mt-3 text-xs text-red-700 hover:underline font-semibold cursor-pointer"
                            >
                              Quitar filtro de subcategoría
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[980px] text-left text-xs border-collapse">
                              <colgroup>
                                {canEdit && <col className="w-10" />}
                                {canEdit && <col className="w-9" />}
                                <col className="w-24" />
                                <col className="w-auto" />
                                <col className="w-64" />
                                <col className="w-52" />
                                <col className="w-28" />
                                {canEdit && <col className="w-36" />}
                              </colgroup>
                              <thead>
                                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider select-none">
                                  {canEdit && (
                                    <th className="py-2.5 px-3 w-10 text-center">
                                      <input
                                        type="checkbox"
                                        checked={
                                          displayedItems.length > 0 &&
                                          displayedItems.every((it) => selectedItemIds.includes(it.id))
                                        }
                                        onChange={() => toggleSelectAllDisplayed(displayedItems)}
                                        className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer w-4 h-4"
                                        title="Seleccionar todos los mostrados"
                                      />
                                    </th>
                                  )}
                                  {canEdit && (
                                    <th className="py-2.5 px-1 w-9 text-center text-slate-400 font-normal" title="Arrastrar para mover">
                                      <span className="sr-only">Mover</span>
                                    </th>
                                  )}
                                  <th className="py-2.5 px-3 w-24 text-center">Código / SKU</th>
                                  <th className="py-2.5 px-3 min-w-[260px]">Designación del Ensayo</th>
                                  <th className="py-2.5 px-3 w-64 min-w-[180px]">Norma / Referencia</th>
                                  <th className="py-2.5 px-3 w-52 min-w-[160px]">Subcategoría</th>
                                  <th className="py-2.5 px-3 w-28 text-right">Precio Oficial</th>
                                  {canEdit && <th className="py-2.5 px-3 w-36 text-center">Acciones</th>}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {displayedItems.map((item) => {
                                  const isSelected = selectedItemIds.includes(item.id);
                                  const isBeingDragged = draggedIds?.includes(item.id);

                                  return (
                                    <tr
                                      key={item.id}
                                      draggable={canEdit}
                                      onDragStart={(e) => handleDragStart(e, item)}
                                      onDragEnd={handleDragEnd}
                                      className={`transition-colors ${
                                        isSelected ? 'bg-red-50/90' : 'hover:bg-slate-50/80'
                                      } ${isBeingDragged ? 'opacity-40 border-dashed border-red-400 bg-red-100/40' : ''}`}
                                    >
                                      {canEdit && (
                                        <td className="py-2.5 px-3 text-center align-top">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleSelectItem(item.id)}
                                            className="rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer w-4 h-4"
                                            title="Seleccionar ensayo"
                                          />
                                        </td>
                                      )}
                                      {canEdit && (
                                        <td
                                          className="py-2.5 px-1 text-center align-top cursor-grab active:cursor-grabbing text-slate-400 hover:text-red-700 transition-colors select-none"
                                          title="Arrastra para mover a otra categoría o subcategoría"
                                        >
                                          <GripVertical className="w-4 h-4 mx-auto" />
                                        </td>
                                      )}
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap align-top">
                                        <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block shadow-2xs">
                                          {item.code || item.sku || 'S/C'}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 align-top min-w-[260px]">
                                        <div className="font-medium text-slate-900 leading-snug whitespace-pre-line text-xs break-words" title={item.designation}>
                                          {item.designation}
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 align-top">
                                        {item.norm ? (
                                          <span className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200/90 px-2 py-1 rounded-md font-medium inline-block max-w-full leading-relaxed whitespace-pre-line break-words">
                                            {item.norm}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 text-[11px] italic">-</span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-3 align-top">
                                        <div className="flex flex-col gap-1 max-w-full">
                                          <span
                                            className="text-[11px] text-slate-700 bg-slate-100/90 border border-slate-200/60 px-2 py-0.5 rounded-md inline-block font-medium leading-tight break-words"
                                            title={item.subcategory}
                                          >
                                            {item.subcategory || '-'}
                                          </span>
                                          {item.subSubcategory && (
                                            <span
                                              className="text-[10px] text-red-700 bg-red-50 border border-red-200/80 px-1.5 py-0.5 rounded inline-flex items-center gap-1 font-semibold leading-tight break-words"
                                              title={`Sub-tipo: ${item.subSubcategory}`}
                                            >
                                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                              <span>{item.subSubcategory}</span>
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap align-top">
                                        <span className="font-bold text-red-700 font-mono text-xs block">
                                          {item.ufPrice !== undefined ? Number(item.ufPrice).toFixed(2) : '0.00'} UF
                                        </span>
                                        <span className="text-[10px] text-slate-400 block font-normal">
                                          / {item.unit || 'c/u'}
                                        </span>
                                      </td>
                                      {canEdit && (
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap align-top">
                                          <button
                                            onClick={() => openReassignModal(item)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50/50 transition-colors shadow-2xs cursor-pointer"
                                            title="Cambiar/editar la categoría de este ensayo"
                                          >
                                            <Edit2 className="w-3 h-3 text-red-600 shrink-0" />
                                            <span>Editar Categoría</span>
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span>
                              Mostrando <strong>{displayedItems.length}</strong> de <strong>{catAllItems.length}</strong> ensayos alojados en esta categoría
                            </span>
                            {activeSubcat && (
                              <button
                                onClick={() => setActiveSubcatFilter((prev) => ({ ...prev, [catKey]: null }))}
                                className="text-red-700 hover:underline font-semibold self-start sm:self-auto cursor-pointer"
                              >
                                Ver todos los ensayos de la categoría
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Modal 1: Create Category */}
        {showCreateCatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Crear Nueva Categoría</h3>
                </div>
                <button
                  onClick={() => setShowCreateCatModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Centro de Costo <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={newCatCc}
                    onChange={(e) => setNewCatCc(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent"
                    required
                  >
                    {CENTROS_DE_COSTO.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nombre de la Categoría <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder="Ej: VII - ENSAYOS AMBIENTALES Y QUÍMICOS"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recomendación: usa numeración romana (ej. I, II, III...) si deseas mantener el orden estándar de los tarifados oficiales.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subcategorías Iniciales (Opcional, una por línea)
                  </label>
                  <textarea
                    rows={4}
                    value={newCatInitialSubcats}
                    onChange={(e) => setNewCatInitialSubcats(e.target.value)}
                    placeholder="VII.1 Ensayos de lixiviación&#10;VII.2 Análisis de pH y conductividad&#10;VII.3 Contenido de sulfatos"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-mono"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Puedes agregar varias subcategorías de una vez escribiendo cada una en una línea nueva.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateCatModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-700 text-white hover:bg-red-800 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Guardando...' : 'Crear Categoría'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 2: Create Subcategory */}
        {showCreateSubcatModal && targetCategoryForSubcat && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {targetCategoryForSubcat.parentSubcategory
                      ? 'Agregar Sub-tipo (Sub-subcategoría)'
                      : 'Agregar Subcategoría'}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowCreateSubcatModal(false);
                    setTargetCategoryForSubcat(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubcategory} className="p-6 space-y-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <span className="text-slate-500 block font-medium">Categoría Destino:</span>
                  <span className="text-slate-900 font-bold block mt-0.5">{targetCategoryForSubcat.category}</span>
                  {targetCategoryForSubcat.parentSubcategory && (
                    <div className="mt-1 pt-1 border-t border-slate-200">
                      <span className="text-slate-500 block font-medium">Subcategoría Padre:</span>
                      <span className="text-red-700 font-bold block">{targetCategoryForSubcat.parentSubcategory}</span>
                    </div>
                  )}
                  <span className="text-[11px] text-slate-500 font-normal">{targetCategoryForSubcat.cc}</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {targetCategoryForSubcat.parentSubcategory
                      ? 'Nombre del Sub-tipo'
                      : 'Nombre de la Subcategoría'}{' '}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSubcatName}
                    onChange={(e) => setNewSubcatName(e.target.value)}
                    placeholder={
                      targetCategoryForSubcat.parentSubcategory
                        ? 'Ej: Triaxial UU (No consolidado no drenado)'
                        : 'Ej: I.5 Ensayos de permeabilidad especial'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium"
                    required
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {targetCategoryForSubcat.parentSubcategory
                      ? 'Especifica el nombre del ensayo o sub-tipo dentro de esta subcategoría.'
                      : 'Usa numeración correlativa subordinada a la categoría (ej. I.1, I.2...).'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateSubcatModal(false);
                      setTargetCategoryForSubcat(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-700 text-white hover:bg-red-800 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Agregando...' : 'Agregar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 3: Rename Category */}
        {renameCatData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">Renombrar Categoría</h3>
                </div>
                <button
                  onClick={() => setRenameCatData(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRenameCategory} className="p-6 space-y-4">
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Actualización en cascada:</span>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        Al cambiar este nombre, se actualizará automáticamente en todos los ensayos de la base de datos pertenecientes a esta categoría.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium">Nombre Actual:</span>
                  <p className="text-xs font-semibold text-slate-700 bg-slate-100 p-2 rounded-lg mt-0.5">
                    {renameCatData.oldCategory}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nuevo Nombre <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={renameCatData.newCategory}
                    onChange={(e) =>
                      setRenameCatData((prev) => (prev ? { ...prev, newCategory: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRenameCatData(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Actualizando...' : 'Guardar Nuevo Nombre'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 4: Rename Subcategory */}
        {renameSubcatData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {renameSubcatData.parentSubcategory
                      ? 'Renombrar Sub-tipo'
                      : 'Renombrar Subcategoría'}
                  </h3>
                </div>
                <button
                  onClick={() => setRenameSubcatData(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleRenameSubcategory} className="p-6 space-y-4">
                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-xs text-amber-900">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Actualización en cascada:</span>
                      <p className="mt-0.5 text-[11px] text-amber-800">
                        Al cambiar este nombre, todos los ensayos asignados a{' '}
                        {renameSubcatData.parentSubcategory ? 'este sub-tipo' : 'esta subcategoría'} se
                        actualizarán automáticamente.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium">Categoría:</span>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{renameSubcatData.category}</p>
                  {renameSubcatData.parentSubcategory && (
                    <p className="text-[11px] text-slate-600 mt-1">
                      Subcategoría Padre: <strong>{renameSubcatData.parentSubcategory}</strong>
                    </p>
                  )}
                </div>

                <div>
                  <span className="block text-[11px] text-slate-500 font-medium">Nombre Actual:</span>
                  <p className="text-xs font-semibold text-slate-700 bg-slate-100 p-2 rounded-lg mt-0.5">
                    {renameSubcatData.oldSubcategory}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nuevo Nombre <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={renameSubcatData.newSubcategory}
                    onChange={(e) =>
                      setRenameSubcatData((prev) => (prev ? { ...prev, newSubcategory: e.target.value } : null))
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent font-medium"
                    required
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setRenameSubcatData(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-700 text-white hover:bg-blue-800 transition-colors shadow-xs disabled:opacity-50"
                  >
                    {submitting ? 'Actualizando...' : 'Guardar Nuevo Nombre'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal 5: Delete Confirmation */}
        {deleteConfirmData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-red-50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-red-900">
                    Eliminar{' '}
                    {deleteConfirmData.type === 'category'
                      ? 'Categoría'
                      : deleteConfirmData.parentSubcategory
                      ? 'Sub-tipo'
                      : 'Subcategoría'}
                  </h3>
                </div>
                <button
                  onClick={() => setDeleteConfirmData(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                {deleteConfirmData.count > 0 ? (
                  <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-xs text-red-800 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-red-900 text-sm block">Acción Bloqueada</span>
                        <p className="mt-1">
                          No es posible eliminar{' '}
                          {deleteConfirmData.type === 'category'
                            ? 'esta categoría'
                            : deleteConfirmData.parentSubcategory
                            ? 'este sub-tipo'
                            : 'esta subcategoría'}{' '}
                          porque contiene{' '}
                          <strong>{deleteConfirmData.count} ensayo(s)</strong> asociado(s) en la base de datos oficial.
                        </p>
                        <p className="mt-2 text-[11px] text-red-700">
                          Para eliminarla, primero debes reasignar o eliminar esos ensayos en el Tarifario.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs text-slate-700">
                    <p>
                      ¿Estás seguro de que deseas eliminar permanentemente{' '}
                      {deleteConfirmData.type === 'category'
                        ? 'la categoría'
                        : deleteConfirmData.parentSubcategory
                        ? 'el sub-tipo'
                        : 'la subcategoría'}:
                    </p>
                    <p className="p-2.5 rounded-lg bg-slate-100 font-mono text-xs font-semibold text-slate-900">
                      {deleteConfirmData.type === 'category'
                        ? deleteConfirmData.category
                        : deleteConfirmData.subcategory}
                    </p>
                    {deleteConfirmData.parentSubcategory && (
                      <p className="text-[11px] text-slate-500">
                        Subcategoría Padre: <strong>{deleteConfirmData.parentSubcategory}</strong>
                      </p>
                    )}
                    <p className="text-slate-500 text-[11px]">
                      Esta acción no afecta a ningún ensayo porque actualmente no tiene ítems asignados.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmData(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    {deleteConfirmData.count > 0 ? 'Entendido' : 'Cancelar'}
                  </button>
                  {deleteConfirmData.count === 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteExecute}
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-700 text-white hover:bg-red-800 transition-colors shadow-xs disabled:opacity-50"
                    >
                      {submitting ? 'Eliminando...' : 'Sí, Eliminar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal 6: Reassign / Edit Item Category */}
        {reassignItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-700">
                    <Edit2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Editar Categoría de Ensayo</h3>
                    <p className="text-[11px] text-slate-500">Reasigna este ensayo a otra categoría o subcategoría</p>
                  </div>
                </div>
                <button
                  onClick={() => setReassignItem(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleReassignSubmit} className="p-6 space-y-4">
                {/* Essay Overview Banner */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-[11px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded font-semibold">
                      {reassignItem.code || reassignItem.sku || 'Sin código'}
                    </span>
                    <span className="font-bold text-red-700 font-mono text-xs">
                      {reassignItem.ufPrice !== undefined ? Number(reassignItem.ufPrice).toFixed(2) : '0.00'} UF
                    </span>
                  </div>
                  <p className="font-bold text-slate-900 text-xs leading-snug">
                    {reassignItem.designation}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1 border-t border-slate-200/60">
                    {reassignItem.norm && <span>Norma: <strong>{reassignItem.norm}</strong></span>}
                    <span>Ubicación actual: <strong>{reassignItem.category}</strong></span>
                  </div>
                </div>

                {/* Centro de Costo Destino */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Centro de Costo Destino <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={reassignCc}
                    onChange={(e) => handleCcChangeInModal(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium cursor-pointer"
                    required
                  >
                    {CENTROS_DE_COSTO.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Categoría Destino */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Categoría Destino <span className="text-red-600">*</span>
                  </label>
                  {!isCustomCat ? (
                    <div className="space-y-1.5">
                      <select
                        value={reassignCat}
                        onChange={(e) => handleCatChangeInModal(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium cursor-pointer"
                        required
                      >
                        {structure
                          .filter((s) => s.cc === reassignCc)
                          .map((s) => s.category)
                          .sort(compareHierarchical)
                          .map((catName) => (
                            <option key={catName} value={catName}>
                              {catName}
                            </option>
                          ))}
                        <option value="__CUSTOM__">+ Nueva categoría personalizada...</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={customCatName}
                        onChange={(e) => setCustomCatName(e.target.value)}
                        placeholder="Escribe el nombre de la nueva categoría..."
                        className="w-full px-3 py-2 rounded-lg border border-red-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomCat(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        ← Volver a seleccionar categoría existente
                      </button>
                    </div>
                  )}
                </div>

                {/* Subcategoría Destino */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subcategoría Destino
                  </label>
                  {!isCustomSubcat && !isCustomCat ? (
                    <div className="space-y-1.5">
                      <select
                        value={reassignSubcat}
                        onChange={(e) => handleSubcatChangeInModal(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium cursor-pointer"
                      >
                        <option value="">(Misma que categoría principal)</option>
                        {(
                          structure.find((s) => s.cc === reassignCc && s.category === reassignCat)
                            ?.subcategories || []
                        )
                          .map(normalizeSub)
                          .sort((a, b) => compareHierarchical(a.name, b.name))
                          .map((subObj) => (
                            <option key={subObj.name} value={subObj.name}>
                              {subObj.name}
                            </option>
                          ))}
                        <option value="__CUSTOM__">+ Nueva subcategoría personalizada...</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={customSubcatName}
                        onChange={(e) => setCustomSubcatName(e.target.value)}
                        placeholder="Escribe el nombre de la nueva subcategoría..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium"
                      />
                      {!isCustomCat && (
                        <button
                          type="button"
                          onClick={() => setIsCustomSubcat(false)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          ← Volver a seleccionar subcategoría existente
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-subcategoría Destino (Opcional) */}
                {reassignSubcat && !isCustomSubcat && !isCustomCat && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sub-tipo / Sub-subcategoría <span className="text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    {!isCustomSubSubcat ? (
                      <div className="space-y-1.5">
                        <select
                          value={reassignSubSubcat}
                          onChange={(e) => handleSubSubcatChangeInModal(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium cursor-pointer"
                        >
                          <option value="">(Ninguno / Subcategoría general)</option>
                          {(() => {
                            const catObj = structure.find((s) => s.cc === reassignCc && s.category === reassignCat);
                            const subObj = (catObj?.subcategories || [])
                              .map(normalizeSub)
                              .find((s) => s.name === reassignSubcat);
                            return (subObj?.children || []).map((childName) => (
                              <option key={childName} value={childName}>
                                {childName}
                              </option>
                            ));
                          })()}
                          <option value="__CUSTOM__">+ Nuevo sub-tipo personalizado...</option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          type="text"
                          value={customSubSubcatName}
                          onChange={(e) => setCustomSubSubcatName(e.target.value)}
                          placeholder="Escribe el nombre del nuevo sub-tipo..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setIsCustomSubSubcat(false)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          ← Volver a seleccionar sub-tipo existente
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReassignItem(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-700 text-white hover:bg-red-800 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {submitting ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floating Batch Move Toolbar */}
        {selectedItemIds.length > 0 && canEdit && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4 max-w-4xl w-[92%] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-600 flex items-center justify-center font-bold text-sm text-white shadow-xs shrink-0">
                {selectedItemIds.length}
              </div>
              <div>
                <span className="text-xs font-bold text-slate-100 block">
                  {selectedItemIds.length} ensayo{selectedItemIds.length > 1 ? 's' : ''} seleccionado{selectedItemIds.length > 1 ? 's' : ''}
                </span>
                <span className="text-[11px] text-slate-400">
                  Arrastra los ensayos hacia una categoría o elígelas aquí:
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <select
                value={batchCc}
                onChange={(e) => handleBatchCcChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium cursor-pointer"
              >
                {CENTROS_DE_COSTO.map((cc) => (
                  <option key={cc} value={cc}>{cc}</option>
                ))}
              </select>

              <select
                value={batchCat}
                onChange={(e) => handleBatchCatChange(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium max-w-[200px] truncate cursor-pointer"
              >
                {availableBatchCategories.map((c) => (
                  <option key={c.category} value={c.category}>{c.category}</option>
                ))}
              </select>

              <select
                value={batchSubcat}
                onChange={(e) => {
                  setBatchSubcat(e.target.value);
                  setBatchSubSubcat('');
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium max-w-[180px] truncate cursor-pointer"
              >
                <option value="">(Misma que categoría)</option>
                {availableBatchSubcategories.map(normalizeSub).map((sub) => (
                  <option key={sub.name} value={sub.name}>{sub.name}</option>
                ))}
              </select>

              {availableBatchSubSubcategories.length > 0 && (
                <select
                  value={batchSubSubcat}
                  onChange={(e) => setBatchSubSubcat(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium max-w-[180px] truncate cursor-pointer"
                >
                  <option value="">(Sin sub-tipo específico)</option>
                  {availableBatchSubSubcategories.map((child) => (
                    <option key={child} value={child}>{child}</option>
                  ))}
                </select>
              )}

              <button
                onClick={() => executeMoveItems(selectedItemIds, batchCc, batchCat, batchSubcat, batchSubSubcat)}
                disabled={submitting || !batchCat}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Mover Ensayos</span>
              </button>

              <button
                onClick={() => setSelectedItemIds([])}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Deseleccionar todos"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Custom Download Excel */}
        <TarifarioExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
        />
      </main>
    </div>
  );
}

export default function ConfiguracionTarifarioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-3 border-red-700 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-xs text-slate-500 font-medium">Cargando módulo de configuración...</p>
          </div>
        </div>
      }
    >
      <ConfiguracionTarifarioContent />
    </Suspense>
  );
}
