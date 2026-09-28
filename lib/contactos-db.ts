import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { Contacto } from './types';

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
      CREATE TABLE IF NOT EXISTS contactos (
        email TEXT PRIMARY KEY COLLATE NOCASE,
        name TEXT NOT NULL,
        phone TEXT,
        company TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_contactos_name ON contactos(name);
      CREATE INDEX IF NOT EXISTS idx_contactos_phone ON contactos(phone);
    `);

    // Auto-seed existing contacts from db.json if table is empty
    try {
      const countStmt = _db.prepare('SELECT COUNT(*) as count FROM contactos');
      const countRow = countStmt.get() as { count: number } | undefined;
      if (countRow && countRow.count === 0) {
        seedFromDbJson(_db);
      }
    } catch (err) {
      console.error('Error checking/seeding contactos table:', err);
    }
  }
  return _db;
}

function seedFromDbJson(db: DatabaseSync) {
  const jsonPath = path.join(process.cwd(), 'data', 'db.json');
  if (!fs.existsSync(jsonPath)) return;

  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.cotizaciones)) return;

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO contactos (email, name, phone, company, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (const cot of data.cotizaciones) {
      const email = cot.clientEmail?.trim().toLowerCase();
      const name = cot.clientAttention?.trim();
      const phone = cot.clientPhone?.trim() || '';
      const company = cot.clientName?.trim() || '';
      const date = cot.createdAt || new Date().toISOString();

      if (email && email.includes('@') && name) {
        insertStmt.run(email, name, phone, company, date, date);
      }
    }
  } catch (err) {
    console.error('Error auto-seeding contactos from db.json:', err);
  }
}

export function searchContactos(query: string, limit = 10): Contacto[] {
  const db = getDb();
  const trimmed = (query || '').trim();

  let rows: Record<string, unknown>[];

  if (!trimmed) {
    const stmt = db.prepare(`
      SELECT * FROM contactos
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    rows = stmt.all(limit) as Record<string, unknown>[];
  } else {
    const q = `%${trimmed}%`;
    const stmt = db.prepare(`
      SELECT * FROM contactos
      WHERE email LIKE ? OR name LIKE ? OR phone LIKE ? OR company LIKE ?
      ORDER BY 
        CASE 
          WHEN LOWER(email) = LOWER(?) THEN 1
          WHEN LOWER(name) LIKE LOWER(?) THEN 2
          ELSE 3
        END,
        updated_at DESC
      LIMIT ?
    `);
    rows = stmt.all(q, q, q, q, trimmed, `${trimmed}%`, limit) as Record<string, unknown>[];
  }

  return rows.map((r) => ({
    email: String(r.email || ''),
    name: String(r.name || ''),
    phone: String(r.phone || ''),
    company: r.company ? String(r.company) : undefined,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  }));
}

export function getContactoByEmail(email: string): Contacto | null {
  if (!email) return null;
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const stmt = db.prepare('SELECT * FROM contactos WHERE LOWER(email) = LOWER(?)');
  const r = stmt.get(normalized) as Record<string, unknown> | undefined;
  if (!r) return null;

  return {
    email: String(r.email || ''),
    name: String(r.name || ''),
    phone: String(r.phone || ''),
    company: r.company ? String(r.company) : undefined,
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

export function upsertContacto(data: {
  email: string;
  name: string;
  phone?: string;
  company?: string;
}): Contacto | null {
  const email = (data.email || '').trim().toLowerCase();
  const name = (data.name || '').trim();
  const phone = (data.phone || '').trim();
  const company = (data.company || '').trim();

  if (!email || !email.includes('@')) {
    return null; // Invalid email cannot be contact key
  }
  if (!name) {
    return null; // Name is required
  }

  const db = getDb();
  const now = new Date().toISOString();

  const existing = getContactoByEmail(email);

  if (existing) {
    const updateStmt = db.prepare(`
      UPDATE contactos
      SET name = ?,
          phone = CASE WHEN ? != '' THEN ? ELSE phone END,
          company = CASE WHEN ? != '' THEN ? ELSE company END,
          updated_at = ?
      WHERE LOWER(email) = LOWER(?)
    `);
    updateStmt.run(name, phone, phone, company, company, now, email);
    return getContactoByEmail(email);
  } else {
    const insertStmt = db.prepare(`
      INSERT INTO contactos (email, name, phone, company, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(email, name, phone, company, now, now);
    return {
      email,
      name,
      phone,
      company: company || undefined,
      createdAt: now,
      updatedAt: now,
    };
  }
}

export function deleteContacto(email: string): boolean {
  if (!email) return false;
  const db = getDb();
  const normalized = email.trim().toLowerCase();
  const stmt = db.prepare('DELETE FROM contactos WHERE LOWER(email) = LOWER(?)');
  const info = stmt.run(normalized);
  return info.changes > 0;
}

export function getAllContactos(limit = 100): Contacto[] {
  return searchContactos('', limit);
}


