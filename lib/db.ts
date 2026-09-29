import fs from 'fs';
import path from 'path';
import {
  User,
  UserProfile,
  TarifarioItem,
  Cotizacion,
  FormatoSettings,
  EconomicIndicators,
  TarifarioCategoryStructure,
  ReglaAprendida,
  TipoReglaAprendida,
  EstadoReglaAprendida,
  OrigenReglaAprendida,
  CorrelativoConfig,
} from './types';
import { DEFAULT_PROFILES } from './permissions';

// Estructura completa de la base de datos persistida en db.json
interface DatabaseSchema {
  version: string;
  lastUpdated: string;
  users: User[];
  profiles?: UserProfile[];
  tarifario: TarifarioItem[];
  cotizaciones: Cotizacion[];
  formatoSettings?: FormatoSettings;
  lastIndicators?: EconomicIndicators;
  tarifarioStructure?: TarifarioCategoryStructure[];
  reglasAprendidas?: ReglaAprendida[];
  correlativoConfig?: CorrelativoConfig;
}

export const DEFAULT_FORMATO_SETTINGS: FormatoSettings = {
  formatCode: 'DGL-FA-193 V3',
  officeTitle: 'Oficina central',
  officeAddress: 'Plaza Ercilla 883, Santiago, Chile',
  contactPhone: '+56 2 2978 4800',
  contactEmail: 'contacto@idiem.cl',
  contactWeb: 'www.idiem.cl',
  budgetTitle: 'PRESUPUESTO ENSAYOS DE LABORATORIO',
  divisionTitle: 'División Geotecnia Laboratorio',
  observations: [
    '1.2.1 Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de su recepción.',
    '1.2.2 La presente propuesta está generada a carácter informativo. La determinación de ensayos y sus cantidades dependerá de la estimación del cliente, a lo cual, la propuesta deberá ser ajustada a dicho detalle de ensayo.',
    '1.2.3 (*) Los ensayos realizados bajo normativas específicas indicadas podrían no contar con alcance de acreditación bajo LE-304 si corresponde.',
    '1.2.4 ¿El laboratorio tiene la capacidad y recursos para realizar las actividades?: [X] SÍ    [ ] NO',
  ],
};

import initialDbData from '../data/db.json';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const BACKUP_PATH = path.join(process.cwd(), 'data', 'db.json.bak');

let _memoryDb: DatabaseSchema | null = null;

// Ensure database file exists with automatic backup recovery and memory fallback
function ensureDb(): DatabaseSchema {
  if (_memoryDb) return _memoryDb;

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        _memoryDb = parsed;
        return _memoryDb!;
      }
    }
  } catch (err) {
    // Read-only filesystem or inaccessible in serverless
  }

  // Fallback to bundled database
  try {
    _memoryDb = JSON.parse(JSON.stringify(initialDbData)) as DatabaseSchema;
  } catch {
    _memoryDb = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      users: [],
      tarifario: [],
      cotizaciones: [],
    };
  }
  return _memoryDb;
}

// Atomic and resilient write with backup rotation and retry on lock
function writeDb(data: DatabaseSchema) {
  _memoryDb = data;
  try {
    if (!data || !Array.isArray(data.users) || !Array.isArray(data.tarifario) || !Array.isArray(data.cotizaciones)) {
      return;
    }

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    data.lastUpdated = new Date().toISOString();
    const jsonStr = JSON.stringify(data, null, 2);

    if (fs.existsSync(DB_PATH)) {
      try { fs.copyFileSync(DB_PATH, BACKUP_PATH); } catch {}
    }

    const tempPath = `${DB_PATH}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, jsonStr, 'utf-8');

    let written = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.renameSync(tempPath, DB_PATH);
        written = true;
        break;
      } catch {
        if (attempt === 4) {
          try {
            fs.writeFileSync(DB_PATH, jsonStr, 'utf-8');
            try { fs.unlinkSync(tempPath); } catch {}
            written = true;
          } catch {}
        }
      }
    }
  } catch (err) {
    // Safely ignore filesystem write errors in read-only serverless runtimes
  }
}

// ==================== USERS ====================

export function getUsers(): User[] {
  const db = ensureDb();
  return db.users;
}

export function getUserByEmail(email: string): User | undefined {
  const db = ensureDb();
  return db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
}

export function getUserByRut(rut: string): User | undefined {
  const db = ensureDb();
  const cleanRut = rut.replace(/[^0-9kK]/g, '').toLowerCase();
  return db.users.find((u) => u.rut.replace(/[^0-9kK]/g, '').toLowerCase() === cleanRut);
}

export function createUser(user: Omit<User, 'id' | 'createdAt'>): User {
  const db = ensureDb();
  const newUser: User = {
    ...user,
    id: `usr-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  db.users.push(newUser);
  writeDb(db);
  return newUser;
}

export function deleteUser(id: string): boolean {
  const db = ensureDb();
  const initialLen = db.users.length;
  db.users = db.users.filter((u) => u.id !== id);
  if (db.users.length !== initialLen) {
    writeDb(db);
    return true;
  }
  return false;
}

export function getUserById(id: string): User | undefined {
  const db = ensureDb();
  return db.users.find((u) => u.id === id);
}

export function updateUserProfile(
  id: string,
  profile: Partial<
    Pick<
      User,
      | 'name'
      | 'email'
      | 'rut'
      | 'commercialTitle'
      | 'phone'
      | 'commercialInitials'
      | 'signature'
      | 'role'
      | 'profileId'
      | 'customPermissions'
    >
  >
): User | null {
  const db = ensureDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) return null;

  db.users[index] = {
    ...db.users[index],
    ...profile,
  };
  writeDb(db);
  return db.users[index];
}

export function updateUserPassword(id: string, newPasswordHash: string): boolean {
  const db = ensureDb();
  const index = db.users.findIndex((u) => u.id === id);
  if (index === -1) return false;

  db.users[index].passwordHash = newPasswordHash;
  writeDb(db);
  return true;
}

// ==================== PERFILES Y PERMISOS ====================

export function getProfiles(): UserProfile[] {
  const db = ensureDb();
  if (!db.profiles || !Array.isArray(db.profiles) || db.profiles.length === 0) {
    db.profiles = [...DEFAULT_PROFILES];
    writeDb(db);
  }
  return db.profiles;
}

export function getProfileById(id: string): UserProfile | undefined {
  const profiles = getProfiles();
  return profiles.find((p) => p.id === id);
}

export function saveProfile(
  profile: Omit<UserProfile, 'createdAt'> & { createdAt?: string }
): UserProfile {
  const db = ensureDb();
  const profiles = getProfiles();
  const now = new Date().toISOString();

  const existingIndex = profiles.findIndex((p) => p.id === profile.id);
  if (existingIndex !== -1) {
    db.profiles![existingIndex] = {
      ...profiles[existingIndex],
      ...profile,
      updatedAt: now,
    };
    writeDb(db);
    return db.profiles![existingIndex];
  }

  const newProfile: UserProfile = {
    ...profile,
    id: profile.id || `prof-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  db.profiles!.push(newProfile);
  writeDb(db);
  return newProfile;
}

export function deleteProfile(id: string): { success: boolean; message?: string } {
  const db = ensureDb();
  const profiles = getProfiles();
  const profile = profiles.find((p) => p.id === id);

  if (!profile) {
    return { success: false, message: 'Perfil no encontrado.' };
  }
  if (profile.isSystem) {
    return {
      success: false,
      message: 'No se pueden eliminar los perfiles predeterminados del sistema.',
    };
  }

  const usersWithProfile = db.users.filter((u) => u.profileId === id);
  if (usersWithProfile.length > 0) {
    return {
      success: false,
      message: `No se puede eliminar el perfil porque está asignado a ${usersWithProfile.length} usuario(s). Reasigne primero a los usuarios.`,
    };
  }

  db.profiles = profiles.filter((p) => p.id !== id);
  writeDb(db);
  return { success: true };
}

// ==================== FORMATO ====================

export function getFormatoSettings(): FormatoSettings {
  const db = ensureDb();
  if (!db.formatoSettings) {
    db.formatoSettings = { ...DEFAULT_FORMATO_SETTINGS };
    writeDb(db);
  }
  return db.formatoSettings;
}

export function saveFormatoSettings(
  settings: Partial<FormatoSettings>,
  updatedBy: string
): FormatoSettings {
  const db = ensureDb();
  const current = db.formatoSettings || { ...DEFAULT_FORMATO_SETTINGS };
  const merged: FormatoSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };

  if (!settings.headerImage) {
    delete merged.headerImage;
  }

  db.formatoSettings = merged;
  writeDb(db);
  return db.formatoSettings;
}

// ==================== TARIFARIO ====================

export function getTarifario(): TarifarioItem[] {
  const db = ensureDb();
  return db.tarifario;
}

export function getTarifarioItemById(id: string): TarifarioItem | undefined {
  const db = ensureDb();
  return db.tarifario.find((item) => item.id === id);
}

export function updateTarifarioItem(
  id: string,
  updates: Partial<Omit<TarifarioItem, 'id'>>,
  updatedBy: string
): TarifarioItem | null {
  const db = ensureDb();
  const index = db.tarifario.findIndex((item) => item.id === id);
  if (index === -1) return null;

  db.tarifario[index] = {
    ...db.tarifario[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  writeDb(db);
  return db.tarifario[index];
}

export function createTarifarioItem(
  item: Omit<TarifarioItem, 'id' | 'updatedAt' | 'isOfficial'>,
  createdBy: string
): TarifarioItem {
  const db = ensureDb();
  const newItem: TarifarioItem = {
    ...item,
    id: `item-${Date.now()}`,
    isOfficial: true,
    updatedAt: new Date().toISOString(),
    updatedBy: createdBy,
  };
  db.tarifario.push(newItem);
  writeDb(db);
  return newItem;
}

export function replaceTarifario(items: TarifarioItem[], updatedBy: string) {
  const db = ensureDb();
  db.tarifario = items.map((it) => ({
    ...it,
    isOfficial: true,
    updatedAt: new Date().toISOString(),
    updatedBy,
  }));
  writeDb(db);
}

// ==================== TARIFARIO STRUCTURE (CATEGORIES & SUBCATEGORIES) ====================

export function getTarifarioStructure(): TarifarioCategoryStructure[] {
  const db = ensureDb();
  let structure = db.tarifarioStructure || [];

  // If no structure stored yet, initialize dynamically from current items in tarifario
  if (structure.length === 0 && db.tarifario && db.tarifario.length > 0) {
    const map = new Map<string, Set<string>>(); // key: `${cc}:::${category}` -> Set of subcategories
    db.tarifario.forEach((it) => {
      if (it.cc && it.category) {
        const key = `${it.cc}:::${it.category}`;
        if (!map.has(key)) map.set(key, new Set<string>());
        if (it.subcategory) {
          map.get(key)!.add(it.subcategory);
        }
      }
    });

    const initStructure: TarifarioCategoryStructure[] = [];
    map.forEach((subSet, key) => {
      const [cc, category] = key.split(':::');
      initStructure.push({
        cc,
        category,
        subcategories: Array.from(subSet),
      });
    });

    db.tarifarioStructure = initStructure;
    writeDb(db);
    return initStructure;
  }

  // Ensure any newly added item categories are reflected in the structure
  let modified = false;
  db.tarifario.forEach((it) => {
    if (it.cc && it.category) {
      let entry = structure.find((s) => s.cc === it.cc && s.category === it.category);
      if (!entry) {
        entry = { cc: it.cc, category: it.category, subcategories: [] };
        structure.push(entry);
        modified = true;
      }
      if (it.subcategory && !entry.subcategories.includes(it.subcategory)) {
        entry.subcategories.push(it.subcategory);
        modified = true;
      }
    }
  });

  if (modified) {
    db.tarifarioStructure = structure;
    writeDb(db);
  }

  return structure;
}

export function addCategoryToStructure(
  cc: string,
  category: string,
  subcategories: string[] = []
): { success: boolean; message?: string } {
  const db = ensureDb();
  const structure = getTarifarioStructure();
  const trimmedCat = category.trim();
  const trimmedCc = cc.trim();

  if (!trimmedCat) return { success: false, message: 'La categoría no puede estar vacía.' };
  if (!trimmedCc) return { success: false, message: 'El Centro de Costo es requerido.' };

  const existing = structure.find(
    (s) => s.cc === trimmedCc && s.category.toLowerCase() === trimmedCat.toLowerCase()
  );
  if (existing) {
    return { success: false, message: 'Esta categoría ya existe para este Centro de Costo.' };
  }

  const cleanSubcats = Array.from(
    new Set(subcategories.map((s) => s.trim()).filter(Boolean))
  );

  structure.push({
    cc: trimmedCc,
    category: trimmedCat,
    subcategories: cleanSubcats,
  });

  db.tarifarioStructure = structure;
  writeDb(db);
  return { success: true };
}

export function addSubcategoryToStructure(
  cc: string,
  category: string,
  subcategory: string
): { success: boolean; message?: string } {
  const db = ensureDb();
  const structure = getTarifarioStructure();
  const trimmedSubcat = subcategory.trim();

  if (!trimmedSubcat) return { success: false, message: 'La subcategoría no puede estar vacía.' };

  let entry = structure.find(
    (s) => s.cc === cc && s.category.toLowerCase() === category.toLowerCase()
  );

  if (!entry) {
    entry = { cc, category, subcategories: [] };
    structure.push(entry);
  }

  if (entry.subcategories.some((s) => s.toLowerCase() === trimmedSubcat.toLowerCase())) {
    return { success: false, message: 'Esta subcategoría ya existe dentro de esta categoría.' };
  }

  entry.subcategories.push(trimmedSubcat);
  db.tarifarioStructure = structure;
  writeDb(db);
  return { success: true };
}

export function renameCategoryInDb(
  cc: string,
  oldCategory: string,
  newCategory: string
): { success: boolean; updatedCount: number; message?: string } {
  const db = ensureDb();
  const structure = getTarifarioStructure();
  const trimmedNew = newCategory.trim();

  if (!trimmedNew) return { success: false, updatedCount: 0, message: 'El nuevo nombre no puede estar vacío.' };

  const entry = structure.find((s) => s.cc === cc && s.category === oldCategory);
  if (entry) {
    entry.category = trimmedNew;
  }

  // Update in all items
  let updatedCount = 0;
  db.tarifario.forEach((it) => {
    if (it.cc === cc && it.category === oldCategory) {
      it.category = trimmedNew;
      it.updatedAt = new Date().toISOString();
      updatedCount++;
    }
  });

  db.tarifarioStructure = structure;
  writeDb(db);
  return { success: true, updatedCount };
}

export function renameSubcategoryInDb(
  cc: string,
  category: string,
  oldSubcategory: string,
  newSubcategory: string
): { success: boolean; updatedCount: number; message?: string } {
  const db = ensureDb();
  const structure = getTarifarioStructure();
  const trimmedNew = newSubcategory.trim();

  if (!trimmedNew) return { success: false, updatedCount: 0, message: 'El nuevo nombre no puede estar vacío.' };

  const entry = structure.find((s) => s.cc === cc && s.category === category);
  if (entry) {
    entry.subcategories = entry.subcategories.map((s) => (s === oldSubcategory ? trimmedNew : s));
  }

  // Update in all items
  let updatedCount = 0;
  db.tarifario.forEach((it) => {
    if (it.cc === cc && it.category === category && it.subcategory === oldSubcategory) {
      it.subcategory = trimmedNew;
      it.updatedAt = new Date().toISOString();
      updatedCount++;
    }
  });

  db.tarifarioStructure = structure;
  writeDb(db);
  return { success: true, updatedCount };
}

export function deleteCategoryFromStructure(
  cc: string,
  category: string
): { success: boolean; count: number; message?: string } {
  const db = ensureDb();
  const structure = getTarifarioStructure();

  const count = db.tarifario.filter((it) => it.cc === cc && it.category === category).length;
  if (count > 0) {
    return {
      success: false,
      count,
      message: `No se puede eliminar la categoría porque contiene ${count} ensayo(s) asociado(s). Reasigna o elimina los ensayos primero.`,
    };
  }

  db.tarifarioStructure = structure.filter(
    (s) => !(s.cc === cc && s.category === category)
  );
  writeDb(db);
  return { success: true, count: 0 };
}

export function deleteSubcategoryFromStructure(
  cc: string,
  category: string,
  subcategory: string
): { success: boolean; count: number; message?: string } {
  const db = ensureDb();
  const structure = getTarifarioStructure();

  const count = db.tarifario.filter(
    (it) => it.cc === cc && it.category === category && it.subcategory === subcategory
  ).length;

  if (count > 0) {
    return {
      success: false,
      count,
      message: `No se puede eliminar la subcategoría porque contiene ${count} ensayo(s) asociado(s). Reasigna o elimina los ensayos primero.`,
    };
  }

  const entry = structure.find((s) => s.cc === cc && s.category === category);
  if (entry) {
    entry.subcategories = entry.subcategories.filter((s) => s !== subcategory);
  }

  db.tarifarioStructure = structure;
  writeDb(db);
  return { success: true, count: 0 };
}

// ==================== COTIZACIONES ====================

export function getCotizaciones(includeDeleted = false): Cotizacion[] {
  const db = ensureDb();
  let list = db.cotizaciones;
  if (!includeDeleted) {
    list = list.filter((c) => !c.isDeleted);
  }
  return list.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getCotizacionById(id: string): Cotizacion | undefined {
  const db = ensureDb();
  return db.cotizaciones.find((c) => c.id === id);
}

export function saveCotizacion(
  cotizacion: Omit<Cotizacion, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Cotizacion {
  const db = ensureDb();
  const now = new Date().toISOString();

  if (cotizacion.id) {
    const index = db.cotizaciones.findIndex((c) => c.id === cotizacion.id);
    if (index !== -1) {
      db.cotizaciones[index] = {
        ...db.cotizaciones[index],
        ...cotizacion,
        updatedAt: now,
      } as Cotizacion;
      writeDb(db);
      return db.cotizaciones[index];
    }
  }

  // New cotizacion: advance correlativo if code has sequential number
  if (cotizacion.code && cotizacion.centroCosto) {
    const match = cotizacion.code.match(/PR\.DGL\.(\d{4})\.\d{4}\.(\d+)/i);
    if (match) {
      const num = parseInt(match[2], 10);
      if (!isNaN(num)) {
        advanceCorrelativo(cotizacion.centroCosto, num);
      }
    }
  }

  const newCot: Cotizacion = {
    ...cotizacion,
    id: `cot-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  } as Cotizacion;

  db.cotizaciones.push(newCot);
  writeDb(db);
  return newCot;
}

export function deleteCotizacion(
  id: string,
  deletedBy?: string,
  deletedById?: string
): { success: boolean; error?: string } {
  const db = ensureDb();
  const index = db.cotizaciones.findIndex((c) => c.id === id);
  if (index === -1) {
    return { success: false, error: 'Cotización no encontrada.' };
  }

  const cot = db.cotizaciones[index];

  // Inviolabilidad de cotizaciones oficiales: Prohibir eliminar Finalizadas, Enviadas o Aprobadas
  if (cot.status === 'Finalizada' || cot.status === 'Enviada' || cot.status === 'Aprobada') {
    return {
      success: false,
      error: `No se puede eliminar una cotización oficial emitida en estado "${cot.status}". Por normativas de calidad ISO y trazabilidad, las cotizaciones oficiales deben permanecer archivadas.`,
    };
  }

  // Borrado lógico (Soft Delete) para borradores con bitácora de auditoría
  cot.isDeleted = true;
  cot.deletedAt = new Date().toISOString();
  cot.deletedBy = deletedBy || 'Sistema';
  cot.deletedById = deletedById;
  writeDb(db);
  return { success: true };
}

// ==================== GESTIÓN DE CORRELATIVOS OFICIALES ====================

export const DEFAULT_CORRELATIVO_CONFIG: CorrelativoConfig = {
  defaultInitialNumber: 598, // Número base del sistema manual externo indicado
  sequences: {
    '2339': 598, // Rocas
    '1817': 579, // Básicos
    '2340': 100, // Especiales
    '2341': 588, // Grandes Partículas
  },
};

export function getCorrelativoConfig(): CorrelativoConfig {
  const db = ensureDb();
  if (!db.correlativoConfig) {
    db.correlativoConfig = { ...DEFAULT_CORRELATIVO_CONFIG };
    writeDb(db);
  }
  return db.correlativoConfig;
}

export function saveCorrelativoConfig(config: CorrelativoConfig): CorrelativoConfig {
  const db = ensureDb();
  db.correlativoConfig = {
    defaultInitialNumber: Number(config.defaultInitialNumber) || 598,
    sequences: { ...(config.sequences || {}) },
  };
  writeDb(db);
  return db.correlativoConfig;
}

export function getNextCorrelativo(
  centroCosto: string,
  year?: number
): { code: string; correlativo: number; fullNumber: string } {
  const currentYear = year || new Date().getFullYear();
  const match = centroCosto.match(/(\d{4})/);
  const ccNum = match ? match[1] : '2339';

  const config = getCorrelativoConfig();
  const currentAssigned =
    config.sequences[ccNum] !== undefined
      ? Number(config.sequences[ccNum])
      : config.defaultInitialNumber || 598;

  const fullNumber = String(currentAssigned).padStart(4, '0');
  const code = `PR.DGL.${ccNum}.${currentYear}.${fullNumber}-V1`;

  return { code, correlativo: currentAssigned, fullNumber };
}

export function advanceCorrelativo(centroCosto: string, usedNumber?: number): void {
  const db = ensureDb();
  const match = centroCosto.match(/(\d{4})/);
  const ccNum = match ? match[1] : '2339';
  const config = getCorrelativoConfig();

  const current =
    config.sequences[ccNum] !== undefined
      ? Number(config.sequences[ccNum])
      : config.defaultInitialNumber || 598;

  const next = usedNumber !== undefined && usedNumber >= current ? usedNumber + 1 : current + 1;
  config.sequences[ccNum] = next;
  db.correlativoConfig = config;
  writeDb(db);
}


// ==================== ECONOMIC INDICATORS ====================

export function getStoredIndicators(): EconomicIndicators | null {
  const db = ensureDb();
  return db.lastIndicators || null;
}

export function saveStoredIndicators(indicators: EconomicIndicators) {
  const db = ensureDb();
  db.lastIndicators = indicators;
  writeDb(db);
}

// ==================== APRENDIZAJE CONTINUO IA (OPCIÓN B: REGLAS Y FEEDBACK) ====================

export const DEFAULT_REGLAS_APRENDIDAS: ReglaAprendida[] = [
  {
    id: 'regla-def-1',
    tipo: 'sinonimo',
    terminoUsuario: 'triaxial 15x30',
    codigoEnsayo: '106',
    sku: 'COD-106',
    designacion: 'Triaxial CIU convencional probeta 15,0 x 30,0 cm',
    conteoConfirmaciones: 8,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-2',
    tipo: 'sinonimo',
    terminoUsuario: 'triaxial 5x10',
    codigoEnsayo: '102',
    sku: 'COD-102',
    designacion: 'Triaxial CIU convencional probeta 5,0 x 10,0 cm',
    conteoConfirmaciones: 6,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-3',
    tipo: 'sinonimo',
    terminoUsuario: 'corte directo 30x30',
    codigoEnsayo: '70',
    sku: 'COD-70',
    designacion: 'Corte directo CD probeta 30,0 x 30,0 cm',
    conteoConfirmaciones: 7,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-4',
    tipo: 'sinonimo',
    terminoUsuario: 'clasificacion completa',
    codigoEnsayo: '1',
    sku: 'COD-1',
    designacion: 'Clasificación USCS completa (bajo 3")',
    conteoConfirmaciones: 15,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-5',
    tipo: 'sinonimo',
    terminoUsuario: 'consolidacion 20 cm',
    codigoEnsayo: '78-1',
    sku: 'COD-78-1',
    designacion: 'Consolidación Edométrica en molde de 20 cm de diámetro',
    conteoConfirmaciones: 9,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-6',
    tipo: 'sinonimo',
    terminoUsuario: 'compresion simple testigo',
    codigoEnsayo: '210',
    sku: 'COD-210',
    designacion: 'Compresión simple probeta testigo de roca (ASTM D7012)',
    conteoConfirmaciones: 11,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-7',
    tipo: 'sinonimo',
    terminoUsuario: 'carga puntual colpa',
    codigoEnsayo: '212',
    sku: 'COD-212',
    designacion: 'Carga puntual (Point Load Test) en colpa o testigo de roca',
    conteoConfirmaciones: 5,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
  {
    id: 'regla-def-8',
    tipo: 'observacion_frecuente',
    terminoUsuario: 'cantera de roca colpas masivas',
    observacionSugerida: 'Toma de muestra y transporte de colpas de 5 a 6 toneladas debe ser coordinado y costeado por el cliente.',
    conteoConfirmaciones: 4,
    estado: 'activo',
    origen: 'manual',
    creadoEn: '2026-09-01T08:00:00.000Z',
    actualizadoEn: '2026-09-01T08:00:00.000Z',
    creadoPor: 'Sistema DGL',
  },
];

export function getReglasAprendidas(filtro?: {
  estado?: EstadoReglaAprendida;
  tipo?: TipoReglaAprendida;
}): ReglaAprendida[] {
  const db = ensureDb();
  if (!db.reglasAprendidas || !Array.isArray(db.reglasAprendidas) || db.reglasAprendidas.length === 0) {
    db.reglasAprendidas = [...DEFAULT_REGLAS_APRENDIDAS];
    writeDb(db);
  }

  let list = db.reglasAprendidas;
  if (filtro?.estado) {
    list = list.filter((r) => r.estado === filtro.estado);
  }
  if (filtro?.tipo) {
    list = list.filter((r) => r.tipo === filtro.tipo);
  }

  return list.sort((a, b) => b.conteoConfirmaciones - a.conteoConfirmaciones);
}

export function getReglaAprendidaById(id: string): ReglaAprendida | undefined {
  const db = ensureDb();
  const reglas = getReglasAprendidas();
  return reglas.find((r) => r.id === id);
}

export function saveReglaAprendida(
  regla: Partial<ReglaAprendida> & { terminoUsuario: string }
): ReglaAprendida {
  const db = ensureDb();
  const reglas = getReglasAprendidas();
  const now = new Date().toISOString();
  const cleanTerm = regla.terminoUsuario.trim();

  // Si tiene id, actualizar existente
  if (regla.id) {
    const idx = reglas.findIndex((r) => r.id === regla.id);
    if (idx !== -1) {
      db.reglasAprendidas![idx] = {
        ...db.reglasAprendidas![idx],
        ...regla,
        terminoUsuario: cleanTerm,
        actualizadoEn: now,
      };
      writeDb(db);
      return db.reglasAprendidas![idx];
    }
  }

  // Buscar por término coincidente para no duplicar
  const existingIdx = reglas.findIndex(
    (r) => r.terminoUsuario.toLowerCase() === cleanTerm.toLowerCase()
  );

  if (existingIdx !== -1) {
    db.reglasAprendidas![existingIdx] = {
      ...db.reglasAprendidas![existingIdx],
      ...regla,
      terminoUsuario: cleanTerm,
      conteoConfirmaciones: (db.reglasAprendidas![existingIdx].conteoConfirmaciones || 0) + 1,
      actualizadoEn: now,
    };
    writeDb(db);
    return db.reglasAprendidas![existingIdx];
  }

  // Resolver designación del tarifario si se dio código
  let desig = regla.designacion;
  let sku = regla.sku;
  if (regla.codigoEnsayo && (!desig || !sku)) {
    const item = db.tarifario.find((t) => t.code === regla.codigoEnsayo);
    if (item) {
      desig = item.designation;
      sku = item.sku || `COD-${item.code}`;
    }
  }

  const nuevaRegla: ReglaAprendida = {
    id: `regla-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    tipo: regla.tipo || 'sinonimo',
    terminoUsuario: cleanTerm,
    codigoEnsayo: regla.codigoEnsayo,
    sku,
    designacion: desig,
    observacionSugerida: regla.observacionSugerida,
    conteoConfirmaciones: regla.conteoConfirmaciones || 1,
    estado: regla.estado || 'activo',
    origen: regla.origen || 'manual',
    creadoPor: regla.creadoPor || 'Sistema DGL',
    creadoEn: now,
    actualizadoEn: now,
  };

  db.reglasAprendidas!.push(nuevaRegla);
  writeDb(db);
  return nuevaRegla;
}

export function incrementarReglaAprendida(
  terminoUsuario: string,
  codigoEnsayo?: string,
  origen: OrigenReglaAprendida = 'buscador_ensayos',
  observacionSugerida?: string
): ReglaAprendida {
  const cleanTerm = terminoUsuario.trim().toLowerCase();
  const db = ensureDb();
  const reglas = getReglasAprendidas();

  const idx = reglas.findIndex(
    (r) => r.terminoUsuario.toLowerCase() === cleanTerm && (!codigoEnsayo || r.codigoEnsayo === codigoEnsayo)
  );

  if (idx !== -1) {
    db.reglasAprendidas![idx].conteoConfirmaciones += 1;
    db.reglasAprendidas![idx].actualizadoEn = new Date().toISOString();
    writeDb(db);
    return db.reglasAprendidas![idx];
  }

  return saveReglaAprendida({
    tipo: observacionSugerida ? 'observacion_frecuente' : 'sinonimo',
    terminoUsuario,
    codigoEnsayo,
    origen,
    observacionSugerida,
    conteoConfirmaciones: 1,
    estado: 'activo',
  });
}

export function toggleEstadoReglaAprendida(
  id: string,
  nuevoEstado: EstadoReglaAprendida
): ReglaAprendida | null {
  const db = ensureDb();
  const reglas = getReglasAprendidas();
  const idx = reglas.findIndex((r) => r.id === id);
  if (idx === -1) return null;

  db.reglasAprendidas![idx].estado = nuevoEstado;
  db.reglasAprendidas![idx].actualizadoEn = new Date().toISOString();
  writeDb(db);
  return db.reglasAprendidas![idx];
}

export function deleteReglaAprendida(id: string): boolean {
  const db = ensureDb();
  const initLen = (db.reglasAprendidas || []).length;
  db.reglasAprendidas = (db.reglasAprendidas || []).filter((r) => r.id !== id);
  if (db.reglasAprendidas.length !== initLen) {
    writeDb(db);
    return true;
  }
  return false;
}

