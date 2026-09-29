import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('Connected to PostgreSQL.');

  const res = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tarifario' 
    ORDER BY ordinal_position;
  `);
  console.log('Columns in tarifario:', res.rows);

  const structRes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'tarifario_structure' 
    ORDER BY ordinal_position;
  `);
  console.log('Columns in tarifario_structure:', structRes.rows);

  const countRes = await client.query('SELECT count(*) FROM tarifario');
  console.log('Row count in tarifario:', countRes.rows[0]);

  await client.end();
}

main().catch(console.error);
