import fs from 'fs';
import path from 'path';
import { Client } from 'pg';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Falta DATABASE_URL en .env.local');
  process.exit(1);
}

async function setupTables() {
  console.log('📡 Conectando a Supabase PostgreSQL para crear tablas...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✓ Conectado exitosamente a la base de datos.');

    const sqlPath = path.join(process.cwd(), 'scripts', 'supabase-schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    console.log('⚙️ Ejecutando esquema DDL oficial (tablas, índices, RLS)...');
    await client.query(sql);
    console.log('✅ Esquema oficial de base de datos creado exitosamente en Supabase.');
  } catch (err: any) {
    console.error('❌ Error al ejecutar esquema SQL:', err.message);
  } finally {
    await client.end();
  }
}

setupTables();
