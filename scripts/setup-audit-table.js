/**
 * Crea la tabla registro_auditoria en Supabase usando DATABASE_URL (idempotente).
 * Uso: node scripts/setup-audit-table.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const env = {};
try {
  fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .forEach((l) => {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
} catch {}

const connectionString = process.env.DATABASE_URL || env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL no definido. Ejecuta scripts/audit-table.sql en Supabase → SQL Editor.');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const sql = fs.readFileSync(path.join(__dirname, 'audit-table.sql'), 'utf8');
  await client.query(sql);
  const r = await client.query(
    "select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='registro_auditoria'"
  );
  console.log('OK: registro_auditoria lista. Columnas:', r.rows[0].n);
  await client.end();
})().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

