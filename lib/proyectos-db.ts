import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { Proyecto } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'clientes.db');

let _db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!_db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new DatabaseSync(DB_PATH);

    _db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS proyectos (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        reference TEXT,
        city TEXT,
        client_name TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_proyectos_name ON proyectos(name);
    `);

    // Auto-seed existing projects from db.json if table is empty
    try {
      const countStmt = _db.prepare('SELECT COUNT(*) as count FROM proyectos');
      const countRow = countStmt.get() as { count: number } | undefined;
      if (countRow && countRow.count === 0) {
        seedFromDbJson(_db);
      }
    } catch (err) {
      console.error('Error checking/seeding proyectos table:', err);
    }
  }
  return _db;
}

function getNextId(db: DatabaseSync): string {
  const stmt = db.prepare(`
    SELECT id FROM proyectos 
    WHERE id LIKE 'PRY-%'
  `);
  const rows = stmt.all() as { id: string }[];
  let maxNum = 0;
  for (const row of rows) {
    const numPart = parseInt(row.id.replace('PRY-', ''), 10);
    if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
    }
  }
  const nextNum = maxNum + 1;
  return `PRY-${String(nextNum).padStart(4, '0')}`;
}

function seedFromDbJson(db: DatabaseSync) {
  const jsonPath = path.join(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(jsonPath)) return;

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.cotizaciones)) return;

    let modifiedQuotes = false;
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO proyectos (id, name, reference, city, client_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const cot of data.cotizaciones) {
      const name = cot.projectName?.trim();
      if (!name) continue;

      // Check if project name already inserted
      const checkStmt = db.prepare('SELECT id FROM proyectos WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
      const existing = checkStmt.get(name) as { id: string } | undefined;
      let pid: string = existing?.id || '';
      if (!pid) {
        pid = cot.projectId?.trim() || getNextId(db);
        const ref = cot.reference?.trim() || '';
        const city = cot.city?.trim() || '';
        const client = cot.clientName?.trim() || '';
        const date = cot.createdAt || new Date().toISOString();
        insertStmt.run(pid, name, ref, city, client, date, date);
      }

      if (!cot.projectId && pid) {
        cot.projectId = pid;
        modifiedQuotes = true;
      }
    }

    if (modifiedQuotes) {
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('Error auto-seeding proyectos from db.json:', err);
  }
}

export function searchProyectos(query: string, limit = 10): Proyecto[] {
  const db = getDb();
  const trimmed = (query || '').trim();

  let rows: Record<string, unknown>[];

  if (!trimmed) {
    const stmt = db.prepare(`
      SELECT * FROM proyectos
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    rows = stmt.all(limit) as Record<string, unknown>[];
  } else {
    const q = `%${trimmed}%`;
    const stmt = db.prepare(`
      SELECT * FROM proyectos
      WHERE name LIKE ? OR id LIKE ? OR reference LIKE ? OR client_name LIKE ?
      ORDER BY 
        CASE 
          WHEN LOWER(id) = LOWER(?) THEN 1
          WHEN LOWER(name) LIKE LOWER(?) THEN 2
          ELSE 3
        END,
        updated_at DESC
      LIMIT ?
    `);
    rows = stmt.all(q, q, q, q, trimmed, `${trimmed}%`, limit) as Record<string, unknown>[];
  }

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name || ''),
    reference: r.reference ? String(r.reference) : undefined,
    city: r.city ? String(r.city) : undefined,
    clientName: r.client_name ? String(r.client_name) : undefined,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  }));
}

export function getProyectoById(id: string): Proyecto | null {
  if (!id) return null;
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM proyectos WHERE id = ?');
  const r = stmt.get(id.trim()) as Record<string, unknown> | undefined;
  if (!r) return null;

  return {
    id: String(r.id),
    name: String(r.name || ''),
    reference: r.reference ? String(r.reference) : undefined,
    city: r.city ? String(r.city) : undefined,
    clientName: r.client_name ? String(r.client_name) : undefined,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

export function getProyectoByName(name: string): Proyecto | null {
  if (!name) return null;
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM proyectos WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))');
  const r = stmt.get(name.trim()) as Record<string, unknown> | undefined;
  if (!r) return null;

  return {
    id: String(r.id),
    name: String(r.name || ''),
    reference: r.reference ? String(r.reference) : undefined,
    city: r.city ? String(r.city) : undefined,
    clientName: r.client_name ? String(r.client_name) : undefined,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

export function createOrGetProyecto(data: {
  id?: string;
  name: string;
  reference?: string;
  city?: string;
  clientName?: string;
}): Proyecto {
  const name = (data.name || '').trim();
  if (!name) {
    throw new Error('El nombre del proyecto es obligatorio');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const ref = (data.reference || '').trim();
  const city = (data.city || '').trim();
  const clientName = (data.clientName || '').trim();

  // If specific ID is supplied
  if (data.id && data.id.trim()) {
    const existing = getProyectoById(data.id.trim());
    if (existing) {
      const updateStmt = db.prepare(`
        UPDATE proyectos
        SET name = ?,
            reference = CASE WHEN ? != '' THEN ? ELSE reference END,
            city = CASE WHEN ? != '' THEN ? ELSE city END,
            client_name = CASE WHEN ? != '' THEN ? ELSE client_name END,
            updated_at = ?
        WHERE id = ?
      `);
      updateStmt.run(name, ref, ref, city, city, clientName, clientName, now, existing.id);
      return getProyectoById(existing.id)!;
    }
  }

  // Check if project exists by name
  const existingByName = getProyectoByName(name);
  if (existingByName) {
    const updateStmt = db.prepare(`
      UPDATE proyectos
      SET reference = CASE WHEN ? != '' THEN ? ELSE reference END,
          city = CASE WHEN ? != '' THEN ? ELSE city END,
          client_name = CASE WHEN ? != '' THEN ? ELSE client_name END,
          updated_at = ?
      WHERE id = ?
    `);
    updateStmt.run(ref, ref, city, city, clientName, clientName, now, existingByName.id);
    return getProyectoById(existingByName.id)!;
  }

  // Generate new unique sequential ID
  const nextId = getNextId(db);
  const insertStmt = db.prepare(`
    INSERT INTO proyectos (id, name, reference, city, client_name, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertStmt.run(nextId, name, ref, city, clientName, now, now);

  return {
    id: nextId,
    name,
    reference: ref || undefined,
    city: city || undefined,
    clientName: clientName || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateProyecto(
  id: string,
  data: {
    name: string;
    reference?: string;
    city?: string;
    clientName?: string;
  }
): Proyecto | null {
  if (!id || !data.name?.trim()) return null;
  const db = getDb();
  const existing = getProyectoById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const name = data.name.trim();
  const ref = (data.reference || '').trim();
  const city = (data.city || '').trim();
  const clientName = (data.clientName || '').trim();

  const updateStmt = db.prepare(`
    UPDATE proyectos
    SET name = ?,
        reference = ?,
        city = ?,
        client_name = ?,
        updated_at = ?
    WHERE id = ?
  `);
  updateStmt.run(name, ref, city, clientName, now, id);

  return getProyectoById(id);
}

export function deleteProyecto(id: string): boolean {
  if (!id) return false;
  const db = getDb();
  const stmt = db.prepare('DELETE FROM proyectos WHERE id = ?');
  const info = stmt.run(id);
  return info.changes > 0;
}

export function getAllProyectos(limit = 100): Proyecto[] {
  return searchProyectos('', limit);
}
