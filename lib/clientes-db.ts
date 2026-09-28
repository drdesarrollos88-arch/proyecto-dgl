import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { Cliente } from './types';

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
      CREATE TABLE IF NOT EXISTS clientes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rut TEXT NOT NULL,
        comuna TEXT,
        address TEXT,
        giro TEXT,
        phone TEXT,
        payment_condition TEXT,
        email TEXT,
        contact_person TEXT,
        created_at TEXT,
        updated_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_clientes_name ON clientes(name);
      CREATE INDEX IF NOT EXISTS idx_clientes_rut ON clientes(rut);
    `);
  }
  return _db;
}

export function searchClientes(query: string, limit = 20): Cliente[] {
  const db = getDb();
  const q = `%${query.trim()}%`;

  const stmt = db.prepare(`
    SELECT * FROM clientes
    WHERE name LIKE ? OR rut LIKE ?
    ORDER BY name ASC
    LIMIT ?
  `);

  const rows = stmt.all(q, q, limit) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name || ''),
    rut: String(r.rut || ''),
    comuna: String(r.comuna || ''),
    address: String(r.address || ''),
    giro: String(r.giro || ''),
    phone: String(r.phone || ''),
    paymentCondition: String(r.payment_condition || ''),
    email: String(r.email || ''),
    contactPerson: String(r.contact_person || ''),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  }));
}

export function getClienteById(id: string): Cliente | null {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM clientes WHERE id = ?');
  const r = stmt.get(id) as Record<string, unknown> | undefined;
  if (!r) return null;

  return {
    id: String(r.id),
    name: String(r.name || ''),
    rut: String(r.rut || ''),
    comuna: String(r.comuna || ''),
    address: String(r.address || ''),
    giro: String(r.giro || ''),
    phone: String(r.phone || ''),
    paymentCondition: String(r.payment_condition || ''),
    email: String(r.email || ''),
    contactPerson: String(r.contact_person || ''),
    createdAt: String(r.created_at || ''),
    updatedAt: String(r.updated_at || ''),
  };
}

export function createCliente(data: {
  name: string;
  rut: string;
  comuna?: string;
  address?: string;
  giro?: string;
  phone?: string;
  paymentCondition?: string;
  email?: string;
  contactPerson?: string;
}): Cliente {
  const db = getDb();
  const now = new Date().toISOString();
  const id = `cli-${Date.now()}`;

  const stmt = db.prepare(`
    INSERT INTO clientes (id, name, rut, comuna, address, giro, phone, payment_condition, email, contact_person, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.name.trim(),
    data.rut.trim(),
    (data.comuna || '').trim(),
    (data.address || '').trim(),
    (data.giro || '').trim(),
    (data.phone || '').trim(),
    (data.paymentCondition || '').trim(),
    (data.email || '').trim(),
    (data.contactPerson || '').trim(),
    now,
    now
  );

  return {
    id,
    name: data.name.trim(),
    rut: data.rut.trim(),
    comuna: (data.comuna || '').trim(),
    address: (data.address || '').trim(),
    giro: (data.giro || '').trim(),
    phone: (data.phone || '').trim(),
    paymentCondition: (data.paymentCondition || '').trim(),
    email: (data.email || '').trim(),
    contactPerson: (data.contactPerson || '').trim(),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateCliente(
  id: string,
  data: Partial<Omit<Cliente, 'id' | 'createdAt'>>
): Cliente | null {
  const db = getDb();
  const existing = getClienteById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = {
    ...existing,
    ...data,
    updatedAt: now,
  };

  const stmt = db.prepare(`
    UPDATE clientes
    SET name = ?, rut = ?, comuna = ?, address = ?, giro = ?, phone = ?, payment_condition = ?, email = ?, contact_person = ?, updated_at = ?
    WHERE id = ?
  `);

  stmt.run(
    updated.name,
    updated.rut,
    updated.comuna,
    updated.address,
    updated.giro,
    updated.phone,
    updated.paymentCondition,
    updated.email,
    updated.contactPerson,
    now,
    id
  );

  return updated;
}

export function deleteCliente(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare('DELETE FROM clientes WHERE id = ?');
  stmt.run(id);
  return true;
}

export async function importClientesFromExcel(buffer: ArrayBuffer): Promise<number> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('El archivo no contiene hojas de datos.');

  const db = getDb();
  db.exec('BEGIN TRANSACTION');

  try {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO clientes (id, name, rut, comuna, address, giro, phone, payment_condition, email, contact_person, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let count = 0;
    const now = new Date().toISOString();

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber < 2) return; // Skip header

      const nameVal = row.getCell(1).value;
      const rutVal = row.getCell(2).value;
      const comunaVal = row.getCell(3).value;
      const addressVal = row.getCell(4).value;
      const giroVal = row.getCell(5).value;
      const phoneVal = row.getCell(6).value;
      const paymentVal = row.getCell(7).value;

      if (!nameVal && !rutVal) return;

      const id = `cli-${rowNumber - 1}`;
      insertStmt.run(
        id,
        String(nameVal || '').trim(),
        String(rutVal || '').trim(),
        String(comunaVal || '').trim(),
        String(addressVal || '').trim(),
        String(giroVal || '').trim(),
        String(phoneVal || '').trim(),
        String(paymentVal || '').trim(),
        '',
        '',
        now,
        now
      );
      count++;
    });

    db.exec('COMMIT');
    return count;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

