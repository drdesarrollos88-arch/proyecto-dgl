import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Connecting to PostgreSQL database...');
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Ensuring schema for tarifario and tarifario_structure...');

  // 1. Modify or create tarifario table to support full TarifarioItem schema
  // Check if tarifario exists and if id has nulls, or drop and recreate cleanly
  await client.query(`DROP TABLE IF EXISTS tarifario CASCADE;`);

  await client.query(`
    CREATE TABLE tarifario (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'ENSAYOS GENERALES',
      subcategory TEXT NOT NULL DEFAULT 'ENSAYOS GENERALES',
      designation TEXT NOT NULL,
      norm TEXT DEFAULT '',
      min_weight_kg NUMERIC DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'c/u',
      uf_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
      sku TEXT DEFAULT '',
      cc TEXT NOT NULL DEFAULT '',
      is_official BOOLEAN DEFAULT TRUE,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      updated_by TEXT DEFAULT 'Sistema'
    );
    CREATE INDEX IF NOT EXISTS idx_tarifario_cc ON tarifario(cc);
    CREATE INDEX IF NOT EXISTS idx_tarifario_category ON tarifario(category);
    CREATE INDEX IF NOT EXISTS idx_tarifario_subcategory ON tarifario(subcategory);
  `);

  // 2. Create tarifario_structure table
  await client.query(`
    CREATE TABLE IF NOT EXISTS tarifario_structure (
      id TEXT PRIMARY KEY,
      cc TEXT NOT NULL,
      category TEXT NOT NULL,
      subcategories JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_tarifario_structure_cc ON tarifario_structure(cc);
  `);

  // 3. Load from data/db.json and upsert all items
  const dbJsonPath = path.join(process.cwd(), 'data', 'db.json');
  const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8'));

  const items = dbData.tarifario || [];
  console.log(`Upserting ${items.length} tarifario items from db.json...`);


  const chunkSize = 50;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const valuePlaceholders: string[] = [];
    const values: any[] = [];

    chunk.forEach((it: any, idx: number) => {
      const offset = idx * 14;
      valuePlaceholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14})`
      );
      values.push(
        it.id,
        it.code || '',
        it.category || 'ENSAYOS GENERALES',
        it.subcategory || it.category || 'ENSAYOS GENERALES',
        it.designation || '',
        it.norm || '',
        typeof it.minWeightKg === 'number' ? it.minWeightKg : parseFloat(it.minWeightKg) || 0,
        it.unit || 'c/u',
        Number(it.ufPrice) || 0,
        it.sku || '',
        it.cc || '',
        it.isOfficial !== false,
        it.updatedAt || new Date().toISOString(),
        it.updatedBy || 'Sistema'
      );
    });

    const query = `
      INSERT INTO tarifario (
        id, code, category, subcategory, designation, norm,
        min_weight_kg, unit, uf_price, sku, cc, is_official,
        updated_at, updated_by
      ) VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        category = EXCLUDED.category,
        subcategory = EXCLUDED.subcategory,
        designation = EXCLUDED.designation,
        norm = EXCLUDED.norm,
        min_weight_kg = EXCLUDED.min_weight_kg,
        unit = EXCLUDED.unit,
        uf_price = EXCLUDED.uf_price,
        sku = EXCLUDED.sku,
        cc = EXCLUDED.cc,
        is_official = EXCLUDED.is_official,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;
    `;
    await client.query(query, values);
    console.log(`Inserted chunk ${i + 1} - ${Math.min(i + chunkSize, items.length)} of ${items.length}`);
  }
  console.log(`✓ All items synced to tarifario table.`);

  // 4. Upsert structure
  const structure = dbData.tarifarioStructure || [];
  console.log(`Upserting ${structure.length} categories to tarifario_structure...`);
  for (const s of structure) {
    const structId = `${s.cc}:::${s.category}`;
    await client.query(
      `
      INSERT INTO tarifario_structure (id, cc, category, subcategories, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO UPDATE SET
        cc = EXCLUDED.cc,
        category = EXCLUDED.category,
        subcategories = EXCLUDED.subcategories,
        updated_at = NOW();
      `,
      [structId, s.cc, s.category, JSON.stringify(s.subcategories || [])]
    );
  }
  console.log(`✓ ${structure.length} category structures synced to tarifario_structure.`);

  const finalItems = await client.query('SELECT count(*) FROM tarifario');
  const finalStruct = await client.query('SELECT count(*) FROM tarifario_structure');
  console.log(`Finished: ${finalItems.rows[0].count} items, ${finalStruct.rows[0].count} categories in Supabase.`);

  await client.end();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
