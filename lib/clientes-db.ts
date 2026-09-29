import { Cliente } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';

let _db: any = null;

function getDb(): any {
  if (isSupabaseConfigured || process.env.NODE_ENV === 'production') {
    return null;
  }
  if (!_db) {
    try {
      // Dynamic import to prevent crash in serverless/Cloudflare Workers runtime
      const path = require('path');
      const fs = require('fs');
      const { DatabaseSync } = require('node:sqlite');
      if (!DatabaseSync) return null;

      const DB_PATH = path.join(process.cwd(), 'data', 'clientes.db');
      try {
        const dir = path.dirname(DB_PATH);
        if (fs && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      } catch {
        return null;
      }
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
    } catch {
      _db = null;
    }
  }
  return _db;
}

export async function searchClientes(query: string, limit = 20): Promise<Cliente[]> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const trimmed = query.trim();
      let req = supabaseAdmin
        .from('clientes')
        .select('*')
        .order('name', { ascending: true })
        .limit(limit);

      if (trimmed) {
        req = req.or(`name.ilike.%${trimmed}%,rut.ilike.%${trimmed}%`);
      }

      const { data, error } = await req;
      if (!error && data) {
        return data.map((r: any) => ({
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
    } catch (e) {
      console.error('Error querying clientes in Supabase:', e);
    }
  }

  const db = getDb();
  if (!db) return [];

  try {
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
  } catch {
    return [];
  }
}

export async function getClienteById(id: string): Promise<Cliente | null> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('clientes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          id: String(data.id),
          name: String(data.name || ''),
          rut: String(data.rut || ''),
          comuna: String(data.comuna || ''),
          address: String(data.address || ''),
          giro: String(data.giro || ''),
          phone: String(data.phone || ''),
          paymentCondition: String(data.payment_condition || ''),
          email: String(data.email || ''),
          contactPerson: String(data.contact_person || ''),
          createdAt: String(data.created_at || ''),
          updatedAt: String(data.updated_at || ''),
        };
      }
    } catch (e) {
      console.error('Error getting cliente by id in Supabase:', e);
    }
  }

  const db = getDb();
  if (!db) return null;

  try {
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
  } catch {
    return null;
  }
}

export async function createCliente(data: {
  name: string;
  rut: string;
  comuna?: string;
  address?: string;
  giro?: string;
  phone?: string;
  paymentCondition?: string;
  email?: string;
  contactPerson?: string;
}): Promise<Cliente> {
  const now = new Date().toISOString();
  const id = `cli-${Date.now()}`;

  const newClient: Cliente = {
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

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('clientes').insert({
        id,
        name: newClient.name,
        rut: newClient.rut,
        comuna: newClient.comuna,
        address: newClient.address,
        giro: newClient.giro,
        phone: newClient.phone,
        payment_condition: newClient.paymentCondition,
        email: newClient.email,
        contact_person: newClient.contactPerson,
        created_at: now,
        updated_at: now,
      });
      return newClient;
    } catch (e) {
      console.error('Error creating cliente in Supabase:', e);
    }
  }

  const db = getDb();
  if (db) {
    try {
      const stmt = db.prepare(`
        INSERT INTO clientes (id, name, rut, comuna, address, giro, phone, payment_condition, email, contact_person, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        newClient.name,
        newClient.rut,
        newClient.comuna,
        newClient.address,
        newClient.giro,
        newClient.phone,
        newClient.paymentCondition,
        newClient.email,
        newClient.contactPerson,
        now,
        now
      );
    } catch {}
  }

  return newClient;
}

export async function updateCliente(
  id: string,
  data: Partial<Omit<Cliente, 'id' | 'createdAt'>>
): Promise<Cliente | null> {
  const existing = await getClienteById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: Cliente = {
    ...existing,
    ...data,
    updatedAt: now,
  };

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('clientes').update({
        name: updated.name,
        rut: updated.rut,
        comuna: updated.comuna,
        address: updated.address,
        giro: updated.giro,
        phone: updated.phone,
        payment_condition: updated.paymentCondition,
        email: updated.email,
        contact_person: updated.contactPerson,
        updated_at: now,
      }).eq('id', id);
      return updated;
    } catch (e) {
      console.error('Error updating cliente in Supabase:', e);
    }
  }

  const db = getDb();
  if (db) {
    try {
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
    } catch {}
  }

  return updated;
}

export async function deleteCliente(id: string): Promise<boolean> {
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('clientes').delete().eq('id', id);
      return true;
    } catch (e) {
      console.error('Error deleting cliente in Supabase:', e);
    }
  }

  const db = getDb();
  if (db) {
    try {
      const stmt = db.prepare('DELETE FROM clientes WHERE id = ?');
      stmt.run(id);
      return true;
    } catch {}
  }
  return true;
}

export async function importClientesFromExcel(buffer: ArrayBuffer): Promise<number> {
  const ExcelJSModule = await import('exceljs');
  const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('El archivo no contiene hojas de datos.');

  const db = getDb();
  if (db) {
    db.exec('BEGIN TRANSACTION');
    try {
      const insertStmt = db.prepare(`
        INSERT OR REPLACE INTO clientes (id, name, rut, comuna, address, giro, phone, payment_condition, email, contact_person, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let count = 0;
      const now = new Date().toISOString();

      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber < 2) return;

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
  return 0;
}
