import { TarifarioItem, TarifarioCategoryStructure, SubcategoryItem } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';
import initialDbData from '../data/db.json';

// In-memory cache for fast lookups and resilience
let _cachedTarifario: TarifarioItem[] | null = null;
let _cachedStructure: TarifarioCategoryStructure[] | null = null;

export function normalizeSubcategory(sub: string | SubcategoryItem): { name: string; children: string[] } {
  if (typeof sub === 'string') {
    return { name: sub.trim(), children: [] };
  }
  return {
    name: (sub?.name || '').trim(),
    children: Array.isArray(sub?.children)
      ? sub.children.map((c) => (typeof c === 'string' ? c.trim() : '')).filter(Boolean)
      : [],
  };
}

export function findSubcategoryIndex(
  subcategories: (string | SubcategoryItem)[],
  name: string
): number {
  const target = name.trim().toLowerCase();
  return subcategories.findIndex((s) => {
    const sName = (typeof s === 'string' ? s : s?.name || '').trim().toLowerCase();
    return sName === target;
  });
}

function ensureLocalCache(): { items: TarifarioItem[]; structure: TarifarioCategoryStructure[] } {
  if (!_cachedTarifario) {
    try {
      const initial = (initialDbData as any)?.tarifario || [];
      _cachedTarifario = Array.isArray(initial) ? JSON.parse(JSON.stringify(initial)) : [];
    } catch {
      _cachedTarifario = [];
    }
  }
  if (!_cachedStructure) {
    try {
      const initialStruct = (initialDbData as any)?.tarifarioStructure || [];
      _cachedStructure = Array.isArray(initialStruct) ? JSON.parse(JSON.stringify(initialStruct)) : [];
    } catch {
      _cachedStructure = [];
    }
  }
  return { items: _cachedTarifario!, structure: _cachedStructure! };
}

export function mapRowToTarifarioItem(row: any): TarifarioItem {
  return {
    id: String(row.id),
    code: row.code || '',
    category: row.category || 'ENSAYOS GENERALES',
    subcategory: row.subcategory || row.category || 'ENSAYOS GENERALES',
    subSubcategory: row.sub_subcategory || '',
    designation: row.designation || '',
    norm: row.norm || '',
    minWeightKg:
      typeof row.min_weight_kg === 'number'
        ? row.min_weight_kg
        : parseFloat(String(row.min_weight_kg || 0)) || 0,
    unit: row.unit || 'c/u',
    ufPrice: Number(row.uf_price) || 0,
    sku: row.sku || '',
    cc: row.cc || '',
    isOfficial: row.is_official !== false,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
    updatedBy: row.updated_by || 'Sistema',
  };
}

export function mapItemToRow(item: Partial<TarifarioItem>) {
  const row: Record<string, any> = {};
  if (item.id !== undefined) row.id = item.id;
  if (item.code !== undefined) row.code = item.code;
  if (item.category !== undefined) row.category = item.category;
  if (item.subcategory !== undefined) row.subcategory = item.subcategory;
  if (item.subSubcategory !== undefined) row.sub_subcategory = item.subSubcategory;
  if (item.designation !== undefined) row.designation = item.designation;
  if (item.norm !== undefined) row.norm = item.norm;
  if (item.minWeightKg !== undefined) {
    row.min_weight_kg =
      typeof item.minWeightKg === 'number'
        ? item.minWeightKg
        : parseFloat(String(item.minWeightKg || 0)) || 0;
  }
  if (item.unit !== undefined) row.unit = item.unit;
  if (item.ufPrice !== undefined) row.uf_price = Number(item.ufPrice) || 0;
  if (item.sku !== undefined) row.sku = item.sku;
  if (item.cc !== undefined) row.cc = item.cc;
  if (item.isOfficial !== undefined) row.is_official = item.isOfficial;
  if (item.updatedAt !== undefined) row.updated_at = item.updatedAt;
  if (item.updatedBy !== undefined) row.updated_by = item.updatedBy;
  return row;
}

/**
 * Obtener todos los ítems del tarifario oficial.
 */
export async function getTarifarioAsync(): Promise<TarifarioItem[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('tarifario')
        .select('*')
        .order('category', { ascending: true })
        .order('designation', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapRowToTarifarioItem);
        _cachedTarifario = mapped;
        return mapped;
      }
      if (error) {
        console.warn('Supabase getTarifario error, falling back to cache:', error.message);
      }
    } catch (err: any) {
      console.warn('Supabase getTarifario exception:', err.message);
    }
  }

  const { items } = ensureLocalCache();
  return items;
}

/**
 * Obtener la estructura de categorías y subcategorías.
 */
export async function getTarifarioStructureAsync(): Promise<TarifarioCategoryStructure[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('tarifario_structure')
        .select('*')
        .order('cc', { ascending: true })
        .order('category', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped: TarifarioCategoryStructure[] = data.map((row: any) => ({
          cc: row.cc,
          category: row.category,
          subcategories: Array.isArray(row.subcategories) ? row.subcategories : [],
        }));
        _cachedStructure = mapped;
        return mapped;
      }
      if (error) {
        console.warn('Supabase getTarifarioStructure error:', error.message);
      }
    } catch (err: any) {
      console.warn('Supabase getTarifarioStructure exception:', err.message);
    }
  }

  const { structure } = ensureLocalCache();
  return structure;
}

/**
 * Asegurar que una categoría y subcategoría existan en tarifario_structure.
 */
export async function ensureCategoryAndSubcategoryInStructureAsync(
  cc: string,
  category: string,
  subcategory?: string,
  subSubcategory?: string
): Promise<void> {
  if (!cc || !category) return;
  const trimmedCc = cc.trim();
  const trimmedCat = category.trim();
  const trimmedSubcat = subcategory ? subcategory.trim() : '';
  const trimmedSubSubcat = subSubcategory ? subSubcategory.trim() : '';

  const structId = `${trimmedCc}:::${trimmedCat}`;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('tarifario_structure')
        .select('*')
        .eq('id', structId)
        .maybeSingle();

      if (!existing) {
        let subcats: (string | SubcategoryItem)[] = [];
        if (trimmedSubcat) {
          if (trimmedSubSubcat) {
            subcats = [{ name: trimmedSubcat, children: [trimmedSubSubcat] }];
          } else {
            subcats = [trimmedSubcat];
          }
        }
        await supabaseAdmin.from('tarifario_structure').insert({
          id: structId,
          cc: trimmedCc,
          category: trimmedCat,
          subcategories: subcats,
          updated_at: new Date().toISOString(),
        });
      } else if (trimmedSubcat) {
        const currentSubcats: (string | SubcategoryItem)[] = Array.isArray(existing.subcategories)
          ? existing.subcategories
          : [];
        const idx = findSubcategoryIndex(currentSubcats, trimmedSubcat);
        let changed = false;

        if (idx === -1) {
          if (trimmedSubSubcat) {
            currentSubcats.push({ name: trimmedSubcat, children: [trimmedSubSubcat] });
          } else {
            currentSubcats.push(trimmedSubcat);
          }
          changed = true;
        } else if (trimmedSubSubcat) {
          const item = normalizeSubcategory(currentSubcats[idx]);
          if (!item.children.some((c) => c.toLowerCase() === trimmedSubSubcat.toLowerCase())) {
            item.children.push(trimmedSubSubcat);
            currentSubcats[idx] = item;
            changed = true;
          }
        }

        if (changed) {
          await supabaseAdmin
            .from('tarifario_structure')
            .update({
              subcategories: currentSubcats,
              updated_at: new Date().toISOString(),
            })
            .eq('id', structId);
        }
      }
    } catch (e: any) {
      console.warn('Error in ensureCategoryAndSubcategoryInStructureAsync:', e.message);
    }
  }

  // Also update local cache
  const { structure } = ensureLocalCache();
  let entry = structure.find(
    (s) => s.cc === trimmedCc && s.category.toLowerCase() === trimmedCat.toLowerCase()
  );
  if (!entry) {
    let subcats: (string | SubcategoryItem)[] = [];
    if (trimmedSubcat) {
      if (trimmedSubSubcat) {
        subcats = [{ name: trimmedSubcat, children: [trimmedSubSubcat] }];
      } else {
        subcats = [trimmedSubcat];
      }
    }
    entry = { cc: trimmedCc, category: trimmedCat, subcategories: subcats };
    structure.push(entry);
  } else if (trimmedSubcat) {
    const idx = findSubcategoryIndex(entry.subcategories, trimmedSubcat);
    if (idx === -1) {
      if (trimmedSubSubcat) {
        entry.subcategories.push({ name: trimmedSubcat, children: [trimmedSubSubcat] });
      } else {
        entry.subcategories.push(trimmedSubcat);
      }
    } else if (trimmedSubSubcat) {
      const item = normalizeSubcategory(entry.subcategories[idx]);
      if (!item.children.some((c) => c.toLowerCase() === trimmedSubSubcat.toLowerCase())) {
        item.children.push(trimmedSubSubcat);
        entry.subcategories[idx] = item;
      }
    }
  }
}

/**
 * Actualizar un ítem específico del tarifario.
 */
export async function updateTarifarioItemAsync(
  id: string,
  updates: Partial<TarifarioItem>,
  updatedBy: string = 'Sistema'
): Promise<TarifarioItem | null> {
  const cleanUpdates = { ...updates };
  cleanUpdates.updatedAt = new Date().toISOString();
  cleanUpdates.updatedBy = updatedBy;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const dbRow = mapItemToRow(cleanUpdates);
      const { data, error } = await supabaseAdmin
        .from('tarifario')
        .update(dbRow)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const updatedItem = mapRowToTarifarioItem(data);

        // Update in local cache
        const { items } = ensureLocalCache();
        const idx = items.findIndex((it) => it.id === id);
        if (idx !== -1) {
          items[idx] = updatedItem;
        }

        // If category or subcategory updated, ensure structure has it
        if (cleanUpdates.category || cleanUpdates.cc || cleanUpdates.subcategory || cleanUpdates.subSubcategory) {
          await ensureCategoryAndSubcategoryInStructureAsync(
            updatedItem.cc,
            updatedItem.category,
            updatedItem.subcategory,
            updatedItem.subSubcategory
          );
        }

        return updatedItem;
      }
      if (error) {
        console.error('Supabase updateTarifarioItem error:', error.message);
      }
    } catch (err: any) {
      console.error('Supabase updateTarifarioItem exception:', err.message);
    }
  }

  // Fallback in-memory
  const { items } = ensureLocalCache();
  const idx = items.findIndex((it) => it.id === id);
  if (idx === -1) return null;

  items[idx] = {
    ...items[idx],
    ...cleanUpdates,
    updatedAt: cleanUpdates.updatedAt,
    updatedBy,
  };

  if (cleanUpdates.category || cleanUpdates.cc || cleanUpdates.subcategory || cleanUpdates.subSubcategory) {
    await ensureCategoryAndSubcategoryInStructureAsync(
      items[idx].cc,
      items[idx].category,
      items[idx].subcategory,
      items[idx].subSubcategory
    );
  }

  return items[idx];
}

/**
 * Actualizar precios de múltiples ítems del tarifario en una sola operación masiva.
 */
export async function batchUpdateTarifarioPricesAsync(
  updates: Array<{ id: string; ufPrice: number }>,
  updatedBy: string = 'Sistema'
): Promise<{ success: boolean; count: number; updatedItems: TarifarioItem[]; error?: string }> {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: true, count: 0, updatedItems: [] };
  }

  const now = new Date().toISOString();
  const updatedItems: TarifarioItem[] = [];

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      for (const u of updates) {
        const { data, error } = await supabaseAdmin
          .from('tarifario')
          .update({
            uf_price: Number(u.ufPrice) || 0,
            updated_at: now,
            updated_by: updatedBy,
          })
          .eq('id', u.id)
          .select()
          .single();

        if (!error && data) {
          const item = mapRowToTarifarioItem(data);
          updatedItems.push(item);
          // Actualizar memoria
          const { items } = ensureLocalCache();
          const idx = items.findIndex((it) => it.id === u.id);
          if (idx !== -1) items[idx] = item;
        } else if (error) {
          console.warn(`Error actualizando precio en Supabase para ítem ${u.id}:`, error.message);
        }
      }
      return { success: true, count: updatedItems.length, updatedItems };
    } catch (err: any) {
      console.error('Supabase batchUpdateTarifarioPrices exception:', err.message);
    }
  }

  // Fallback in-memory
  const { items } = ensureLocalCache();
  for (const u of updates) {
    const idx = items.findIndex((it) => it.id === u.id);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        ufPrice: Number(u.ufPrice) || 0,
        updatedAt: now,
        updatedBy,
      };
      updatedItems.push(items[idx]);
    }
  }

  return { success: true, count: updatedItems.length, updatedItems };
}

/**
 * Crear un nuevo ítem en el tarifario.
 */
export async function createTarifarioItemAsync(
  itemData: Omit<TarifarioItem, 'id' | 'updatedAt' | 'isOfficial'>,
  createdBy: string = 'Sistema'
): Promise<TarifarioItem> {
  const newId = `ENS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  const newItem: TarifarioItem = {
    ...itemData,
    id: newId,
    code: itemData.code || '',
    category: itemData.category || 'ENSAYOS GENERALES',
    subcategory: itemData.subcategory || itemData.category || 'ENSAYOS GENERALES',
    subSubcategory: itemData.subSubcategory || '',
    designation: itemData.designation,
    norm: itemData.norm || '',
    minWeightKg: itemData.minWeightKg || 0,
    unit: itemData.unit || 'c/u',
    ufPrice: Number(itemData.ufPrice) || 0,
    sku: itemData.sku || '',
    cc: itemData.cc || '',
    isOfficial: true,
    updatedAt: now,
    updatedBy: createdBy,
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const dbRow = mapItemToRow(newItem);
      const { data, error } = await supabaseAdmin
        .from('tarifario')
        .insert(dbRow)
        .select()
        .single();

      if (!error && data) {
        const created = mapRowToTarifarioItem(data);
        const { items } = ensureLocalCache();
        items.unshift(created);
        await ensureCategoryAndSubcategoryInStructureAsync(
          created.cc,
          created.category,
          created.subcategory,
          created.subSubcategory
        );
        return created;
      }
      if (error) {
        console.error('Supabase createTarifarioItem error:', error.message);
      }
    } catch (err: any) {
      console.error('Supabase createTarifarioItem exception:', err.message);
    }
  }

  const { items } = ensureLocalCache();
  items.unshift(newItem);
  await ensureCategoryAndSubcategoryInStructureAsync(
    newItem.cc,
    newItem.category,
    newItem.subcategory,
    newItem.subSubcategory
  );
  return newItem;
}

/**
 * Mover varios ensayos de una categoría/subcategoría a otra en lote.
 */
export async function batchMoveTarifarioItemsAsync(
  ids: string[],
  targetCc: string,
  targetCategory: string,
  targetSubcategory: string,
  targetSubSubcategory: string = '',
  updatedBy: string = 'Sistema'
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!ids || ids.length === 0) {
    return { success: true, count: 0 };
  }
  const now = new Date().toISOString();
  const trimmedCc = targetCc.trim();
  const trimmedCat = targetCategory.trim();
  const trimmedSubcat = (targetSubcategory || targetCategory).trim();
  const trimmedSubSubcat = (targetSubSubcategory || '').trim();

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { error } = await supabaseAdmin
        .from('tarifario')
        .update({
          cc: trimmedCc,
          category: trimmedCat,
          subcategory: trimmedSubcat,
          sub_subcategory: trimmedSubSubcat,
          updated_at: now,
          updated_by: updatedBy,
        })
        .in('id', ids);

      if (error) {
        console.error('Supabase batchMove error:', error.message);
        return { success: false, count: 0, error: error.message };
      }

      // Ensure target category/subcategory in structure
      await ensureCategoryAndSubcategoryInStructureAsync(
        trimmedCc,
        trimmedCat,
        trimmedSubcat,
        trimmedSubSubcat
      );

      // Update in local cache
      const { items } = ensureLocalCache();
      const idSet = new Set(ids);
      items.forEach((it) => {
        if (idSet.has(it.id)) {
          it.cc = trimmedCc;
          it.category = trimmedCat;
          it.subcategory = trimmedSubcat;
          it.subSubcategory = trimmedSubSubcat;
          it.updatedAt = now;
          it.updatedBy = updatedBy;
        }
      });

      return { success: true, count: ids.length };
    } catch (err: any) {
      console.error('Supabase batchMove exception:', err.message);
      return { success: false, count: 0, error: err.message };
    }
  }

  // Fallback in-memory
  const { items } = ensureLocalCache();
  const idSet = new Set(ids);
  let count = 0;
  items.forEach((it) => {
    if (idSet.has(it.id)) {
      it.cc = trimmedCc;
      it.category = trimmedCat;
      it.subcategory = trimmedSubcat;
      it.subSubcategory = trimmedSubSubcat;
      it.updatedAt = now;
      it.updatedBy = updatedBy;
      count++;
    }
  });

  await ensureCategoryAndSubcategoryInStructureAsync(
    trimmedCc,
    trimmedCat,
    trimmedSubcat,
    trimmedSubSubcat
  );
  return { success: true, count };
}

/**
 * Agregar una nueva categoría a la estructura.
 */
export async function addCategoryToStructureAsync(
  cc: string,
  category: string,
  subcategories: (string | SubcategoryItem)[] = []
): Promise<{ success: boolean; message?: string }> {
  const trimmedCat = category.trim();
  const trimmedCc = cc.trim();
  if (!trimmedCat) return { success: false, message: 'La categoría no puede estar vacía.' };
  if (!trimmedCc) return { success: false, message: 'El Centro de Costo es requerido.' };

  const structId = `${trimmedCc}:::${trimmedCat}`;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('tarifario_structure')
        .select('id')
        .eq('id', structId)
        .maybeSingle();

      if (existing) {
        return { success: false, message: 'Esta categoría ya existe para este Centro de Costo.' };
      }

      const { error } = await supabaseAdmin.from('tarifario_structure').insert({
        id: structId,
        cc: trimmedCc,
        category: trimmedCat,
        subcategories,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return { success: false, message: error.message };
      }
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  // Update local cache
  const { structure } = ensureLocalCache();
  const existing = structure.find(
    (s) => s.cc === trimmedCc && s.category.toLowerCase() === trimmedCat.toLowerCase()
  );
  if (existing) {
    return { success: false, message: 'Esta categoría ya existe para este Centro de Costo.' };
  }
  structure.push({ cc: trimmedCc, category: trimmedCat, subcategories });
  return { success: true };
}

/**
 * Agregar una subcategoría a una categoría existente.
 * Si se especifica parentSubcategory, se agrega como nivel 3 dentro de ella.
 */
export async function addSubcategoryToStructureAsync(
  cc: string,
  category: string,
  subcategory: string,
  parentSubcategory?: string
): Promise<{ success: boolean; message?: string }> {
  const trimmedCc = cc.trim();
  const trimmedCat = category.trim();
  const trimmedSubcat = subcategory.trim();
  const trimmedParent = parentSubcategory ? parentSubcategory.trim() : '';
  if (!trimmedSubcat) return { success: false, message: 'La subcategoría no puede estar vacía.' };

  const structId = `${trimmedCc}:::${trimmedCat}`;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data: existing } = await supabaseAdmin
        .from('tarifario_structure')
        .select('*')
        .eq('id', structId)
        .maybeSingle();

      if (!existing) {
        let initialSubcats: (string | SubcategoryItem)[] = [];
        if (trimmedParent) {
          initialSubcats = [{ name: trimmedParent, children: [trimmedSubcat] }];
        } else {
          initialSubcats = [trimmedSubcat];
        }
        await supabaseAdmin.from('tarifario_structure').insert({
          id: structId,
          cc: trimmedCc,
          category: trimmedCat,
          subcategories: initialSubcats,
          updated_at: new Date().toISOString(),
        });
      } else {
        const subcats: (string | SubcategoryItem)[] = Array.isArray(existing.subcategories)
          ? existing.subcategories
          : [];

        if (trimmedParent) {
          // Level 3 addition
          const parentIdx = findSubcategoryIndex(subcats, trimmedParent);
          if (parentIdx === -1) {
            subcats.push({ name: trimmedParent, children: [trimmedSubcat] });
          } else {
            const parentObj = normalizeSubcategory(subcats[parentIdx]);
            if (parentObj.children.some((c) => c.toLowerCase() === trimmedSubcat.toLowerCase())) {
              return { success: false, message: 'Esta subcategoría ya existe dentro de este grupo.' };
            }
            parentObj.children.push(trimmedSubcat);
            subcats[parentIdx] = parentObj;
          }
        } else {
          // Level 2 addition
          if (findSubcategoryIndex(subcats, trimmedSubcat) !== -1) {
            return { success: false, message: 'Esta subcategoría ya existe dentro de esta categoría.' };
          }
          subcats.push(trimmedSubcat);
        }

        await supabaseAdmin
          .from('tarifario_structure')
          .update({
            subcategories: subcats,
            updated_at: new Date().toISOString(),
          })
          .eq('id', structId);
      }
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }

  const { structure } = ensureLocalCache();
  let entry = structure.find(
    (s) => s.cc === trimmedCc && s.category.toLowerCase() === trimmedCat.toLowerCase()
  );
  if (!entry) {
    let initialSubcats: (string | SubcategoryItem)[] = [];
    if (trimmedParent) {
      initialSubcats = [{ name: trimmedParent, children: [trimmedSubcat] }];
    } else {
      initialSubcats = [trimmedSubcat];
    }
    entry = { cc: trimmedCc, category: trimmedCat, subcategories: initialSubcats };
    structure.push(entry);
  } else {
    if (trimmedParent) {
      const parentIdx = findSubcategoryIndex(entry.subcategories, trimmedParent);
      if (parentIdx === -1) {
        entry.subcategories.push({ name: trimmedParent, children: [trimmedSubcat] });
      } else {
        const parentObj = normalizeSubcategory(entry.subcategories[parentIdx]);
        if (parentObj.children.some((c) => c.toLowerCase() === trimmedSubcat.toLowerCase())) {
          return { success: false, message: 'Esta subcategoría ya existe dentro de este grupo.' };
        }
        parentObj.children.push(trimmedSubcat);
        entry.subcategories[parentIdx] = parentObj;
      }
    } else {
      if (findSubcategoryIndex(entry.subcategories, trimmedSubcat) !== -1) {
        return { success: false, message: 'Esta subcategoría ya existe dentro de esta categoría.' };
      }
      entry.subcategories.push(trimmedSubcat);
    }
  }

  return { success: true };
}

/**
 * Renombrar categoría en estructura y en todos los ensayos.
 */
export async function renameCategoryInDbAsync(
  cc: string,
  oldCategory: string,
  newCategory: string
): Promise<{ success: boolean; updatedCount: number; message?: string }> {
  const trimmedNew = newCategory.trim();
  if (!trimmedNew) return { success: false, updatedCount: 0, message: 'El nuevo nombre no puede estar vacío.' };

  const oldStructId = `${cc}:::${oldCategory}`;
  const newStructId = `${cc}:::${trimmedNew}`;

  let updatedCount = 0;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      // 1. Get old structure
      const { data: oldEntry } = await supabaseAdmin
        .from('tarifario_structure')
        .select('*')
        .eq('id', oldStructId)
        .maybeSingle();

      const subcats = oldEntry?.subcategories || [];

      // 2. Delete old structure row and insert new row
      await supabaseAdmin.from('tarifario_structure').delete().eq('id', oldStructId);
      await supabaseAdmin.from('tarifario_structure').upsert({
        id: newStructId,
        cc,
        category: trimmedNew,
        subcategories: subcats,
        updated_at: new Date().toISOString(),
      });

      // 3. Update all items in tarifario
      const { data: updatedRows, error } = await supabaseAdmin
        .from('tarifario')
        .update({
          category: trimmedNew,
          updated_at: new Date().toISOString(),
        })
        .eq('cc', cc)
        .eq('category', oldCategory)
        .select('id');

      if (!error && updatedRows) {
        updatedCount = updatedRows.length;
      }
    } catch (e: any) {
      console.error('Error renaming category in Supabase:', e.message);
    }
  }

  // Update in local cache
  const { structure, items } = ensureLocalCache();
  const entry = structure.find((s) => s.cc === cc && s.category === oldCategory);
  if (entry) {
    entry.category = trimmedNew;
  }
  items.forEach((it) => {
    if (it.cc === cc && it.category === oldCategory) {
      it.category = trimmedNew;
      it.updatedAt = new Date().toISOString();
      if (!isSupabaseConfigured) updatedCount++;
    }
  });

  return { success: true, updatedCount };
}

/**
 * Renombrar subcategoría en estructura y en todos los ensayos.
 * Si parentSubcategory está presente, renombra la sub-subcategoría de nivel 3.
 */
export async function renameSubcategoryInDbAsync(
  cc: string,
  category: string,
  oldSubcategory: string,
  newSubcategory: string,
  parentSubcategory?: string
): Promise<{ success: boolean; updatedCount: number; message?: string }> {
  const trimmedNew = newSubcategory.trim();
  const trimmedOld = oldSubcategory.trim();
  const trimmedParent = parentSubcategory ? parentSubcategory.trim() : '';
  if (!trimmedNew) return { success: false, updatedCount: 0, message: 'El nuevo nombre no puede estar vacío.' };

  const structId = `${cc}:::${category}`;
  let updatedCount = 0;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data: entry } = await supabaseAdmin
        .from('tarifario_structure')
        .select('*')
        .eq('id', structId)
        .maybeSingle();

      if (entry) {
        const subcats: (string | SubcategoryItem)[] = Array.isArray(entry.subcategories) ? entry.subcategories : [];
        if (trimmedParent) {
          // Renaming Level 3 child
          const parentIdx = findSubcategoryIndex(subcats, trimmedParent);
          if (parentIdx !== -1) {
            const parentObj = normalizeSubcategory(subcats[parentIdx]);
            parentObj.children = parentObj.children.map((c) => (c === trimmedOld ? trimmedNew : c));
            subcats[parentIdx] = parentObj;
          }
        } else {
          // Renaming Level 2 subcategory
          const idx = findSubcategoryIndex(subcats, trimmedOld);
          if (idx !== -1) {
            const current = subcats[idx];
            if (typeof current === 'object' && current !== null) {
              subcats[idx] = { ...current, name: trimmedNew };
            } else {
              subcats[idx] = trimmedNew;
            }
          }
        }

        await supabaseAdmin
          .from('tarifario_structure')
          .update({ subcategories: subcats, updated_at: new Date().toISOString() })
          .eq('id', structId);
      }

      if (trimmedParent) {
        // Update level 3 items in tarifario
        const { data: updatedRows } = await supabaseAdmin
          .from('tarifario')
          .update({
            sub_subcategory: trimmedNew,
            updated_at: new Date().toISOString(),
          })
          .eq('cc', cc)
          .eq('category', category)
          .eq('subcategory', trimmedParent)
          .eq('sub_subcategory', trimmedOld)
          .select('id');

        if (updatedRows) updatedCount = updatedRows.length;
      } else {
        // Update level 2 items in tarifario
        const { data: updatedRows } = await supabaseAdmin
          .from('tarifario')
          .update({
            subcategory: trimmedNew,
            updated_at: new Date().toISOString(),
          })
          .eq('cc', cc)
          .eq('category', category)
          .eq('subcategory', trimmedOld)
          .select('id');

        if (updatedRows) updatedCount = updatedRows.length;
      }
    } catch (e: any) {
      console.error('Error renaming subcategory in Supabase:', e.message);
    }
  }

  // Local cache
  const { structure, items } = ensureLocalCache();
  const entry = structure.find((s) => s.cc === cc && s.category === category);
  if (entry) {
    if (trimmedParent) {
      const parentIdx = findSubcategoryIndex(entry.subcategories, trimmedParent);
      if (parentIdx !== -1) {
        const parentObj = normalizeSubcategory(entry.subcategories[parentIdx]);
        parentObj.children = parentObj.children.map((c) => (c === trimmedOld ? trimmedNew : c));
        entry.subcategories[parentIdx] = parentObj;
      }
    } else {
      const idx = findSubcategoryIndex(entry.subcategories, trimmedOld);
      if (idx !== -1) {
        const current = entry.subcategories[idx];
        if (typeof current === 'object' && current !== null) {
          entry.subcategories[idx] = { ...current, name: trimmedNew };
        } else {
          entry.subcategories[idx] = trimmedNew;
        }
      }
    }
  }

  items.forEach((it) => {
    if (trimmedParent) {
      if (it.cc === cc && it.category === category && it.subcategory === trimmedParent && (it.subSubcategory || '') === trimmedOld) {
        it.subSubcategory = trimmedNew;
        it.updatedAt = new Date().toISOString();
        if (!isSupabaseConfigured) updatedCount++;
      }
    } else {
      if (it.cc === cc && it.category === category && it.subcategory === trimmedOld) {
        it.subcategory = trimmedNew;
        it.updatedAt = new Date().toISOString();
        if (!isSupabaseConfigured) updatedCount++;
      }
    }
  });

  return { success: true, updatedCount };
}

/**
 * Eliminar una categoría vacía de la estructura.
 */
export async function deleteCategoryFromStructureAsync(
  cc: string,
  category: string
): Promise<{ success: boolean; count: number; message?: string }> {
  const structId = `${cc}:::${category}`;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      // 1. Check if there are items assigned to this category
      const { count, error } = await supabaseAdmin
        .from('tarifario')
        .select('*', { count: 'exact', head: true })
        .eq('cc', cc)
        .eq('category', category);

      if (error) {
        return { success: false, count: 0, message: error.message };
      }

      const numCount = count || 0;
      if (numCount > 0) {
        return {
          success: false,
          count: numCount,
          message: `No se puede eliminar la categoría porque contiene ${numCount} ensayo(s) asociado(s). Reasigna o mueve los ensayos primero.`,
        };
      }

      // 2. Delete from structure
      await supabaseAdmin.from('tarifario_structure').delete().eq('id', structId);
    } catch (e: any) {
      return { success: false, count: 0, message: e.message };
    }
  }

  // Update local cache
  const { structure, items } = ensureLocalCache();
  const localCount = items.filter((it) => it.cc === cc && it.category === category).length;
  if (localCount > 0 && !isSupabaseConfigured) {
    return {
      success: false,
      count: localCount,
      message: `No se puede eliminar la categoría porque contiene ${localCount} ensayo(s) asociado(s).`,
    };
  }

  _cachedStructure = structure.filter((s) => !(s.cc === cc && s.category === category));
  return { success: true, count: 0 };
}

/**
 * Eliminar una subcategoría vacía de la estructura.
 * Si parentSubcategory está presente, elimina la sub-subcategoría de nivel 3 dentro de ella.
 */
export async function deleteSubcategoryFromStructureAsync(
  cc: string,
  category: string,
  subcategory: string,
  parentSubcategory?: string
): Promise<{ success: boolean; count: number; message?: string }> {
  const trimmedSubcat = subcategory.trim();
  const trimmedParent = parentSubcategory ? parentSubcategory.trim() : '';
  const structId = `${cc}:::${category}`;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      let query = supabaseAdmin
        .from('tarifario')
        .select('*', { count: 'exact', head: true })
        .eq('cc', cc)
        .eq('category', category);

      if (trimmedParent) {
        query = query.eq('subcategory', trimmedParent).eq('sub_subcategory', trimmedSubcat);
      } else {
        query = query.eq('subcategory', trimmedSubcat);
      }

      const { count, error } = await query;
      if (error) return { success: false, count: 0, message: error.message };

      const numCount = count || 0;
      if (numCount > 0) {
        return {
          success: false,
          count: numCount,
          message: `No se puede eliminar la subcategoría porque contiene ${numCount} ensayo(s).`,
        };
      }

      const { data: entry } = await supabaseAdmin
        .from('tarifario_structure')
        .select('*')
        .eq('id', structId)
        .maybeSingle();

      if (entry) {
        let subcats: (string | SubcategoryItem)[] = Array.isArray(entry.subcategories) ? entry.subcategories : [];
        if (trimmedParent) {
          const parentIdx = findSubcategoryIndex(subcats, trimmedParent);
          if (parentIdx !== -1) {
            const parentObj = normalizeSubcategory(subcats[parentIdx]);
            parentObj.children = parentObj.children.filter((c) => c !== trimmedSubcat);
            subcats[parentIdx] = parentObj;
          }
        } else {
          subcats = subcats.filter((s) => {
            const sName = typeof s === 'string' ? s : s?.name || '';
            return sName !== trimmedSubcat;
          });
        }

        await supabaseAdmin
          .from('tarifario_structure')
          .update({ subcategories: subcats, updated_at: new Date().toISOString() })
          .eq('id', structId);
      }
    } catch (e: any) {
      return { success: false, count: 0, message: e.message };
    }
  }

  const { structure, items } = ensureLocalCache();
  const localCount = items.filter((it) => {
    if (it.cc !== cc || it.category !== category) return false;
    if (trimmedParent) {
      return it.subcategory === trimmedParent && (it.subSubcategory || '') === trimmedSubcat;
    }
    return it.subcategory === trimmedSubcat;
  }).length;

  if (localCount > 0 && !isSupabaseConfigured) {
    return {
      success: false,
      count: localCount,
      message: `No se puede eliminar la subcategoría porque contiene ${localCount} ensayo(s).`,
    };
  }

  const entry = structure.find((s) => s.cc === cc && s.category === category);
  if (entry) {
    if (trimmedParent) {
      const parentIdx = findSubcategoryIndex(entry.subcategories, trimmedParent);
      if (parentIdx !== -1) {
        const parentObj = normalizeSubcategory(entry.subcategories[parentIdx]);
        parentObj.children = parentObj.children.filter((c) => c !== trimmedSubcat);
        entry.subcategories[parentIdx] = parentObj;
      }
    } else {
      entry.subcategories = entry.subcategories.filter((s) => {
        const sName = typeof s === 'string' ? s : s?.name || '';
        return sName !== trimmedSubcat;
      });
    }
  }

  return { success: true, count: 0 };
}

/**
 * Reemplaza o actualiza el tarifario en lote en Supabase y memoria.
 */
export async function replaceTarifarioAsync(items: TarifarioItem[], updatedBy: string): Promise<void> {
  const now = new Date().toISOString();
  const processedItems = items.map((it) => ({
    ...it,
    isOfficial: true,
    updatedAt: now,
    updatedBy,
  }));

  _cachedTarifario = processedItems;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const rows = processedItems.map(mapItemToRow);
      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error } = await supabaseAdmin.from('tarifario').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.error(`Error en lote ${i}-${i + chunk.length} al guardar tarifario en Supabase:`, error.message);
        }
      }
    } catch (err) {
      console.error('Error persistiendo lote de tarifario en Supabase:', err);
    }
  }
}
