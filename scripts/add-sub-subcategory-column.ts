import { Client } from 'pg';
import dns from 'dns';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Try resolving with dns
dns.setDefaultResultOrder('verbatim');

async function main() {
  console.log('Connecting to PostgreSQL to check columns via IPv6...');
  const client = new Client({
    host: '2600:1f13:5fd:be01::9614',
    port: 5432,
    user: 'postgres',
    password: 'w4JoaCYyySX5cgEY',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Adding sub_subcategory column if not exists...');
  await client.query(`
    ALTER TABLE tarifario ADD COLUMN IF NOT EXISTS sub_subcategory TEXT DEFAULT '';
    CREATE INDEX IF NOT EXISTS idx_tarifario_sub_subcategory ON tarifario(sub_subcategory);
  `);

  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tarifario';
  `);
  console.log('Columns in tarifario table:');
  res.rows.forEach(r => console.log(` - ${r.column_name} (${r.data_type})`));

  await client.end();
  console.log('Done!');
}

main().catch(console.error);
