import { Client } from 'pg';

const regions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ca-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
];

async function check() {
  for (const reg of regions) {
    const host = `aws-0-${reg}.pooler.supabase.com`;
    const client = new Client({
      host,
      port: 6543,
      user: 'postgres.xjtnbqrulabmcvshatyh',
      password: 'w4JoaCYyySX5cgEY',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000,
    });
    try {
      await client.connect();
      console.log(`\n SUCCESS! Region is: ${reg} (${host})`);
      await client.query(`
        ALTER TABLE tarifario ADD COLUMN IF NOT EXISTS sub_subcategory TEXT DEFAULT '';
        CREATE INDEX IF NOT EXISTS idx_tarifario_sub_subcategory ON tarifario(sub_subcategory);
      `);
      console.log('✓ Column sub_subcategory added or ensured successfully!');
      await client.end();
      return;
    } catch (e: any) {
      if (e.message.includes('tenant/user') || e.message.includes('not found')) {
        // wrong region
        process.stdout.write(`.`);
      } else {
        console.log(`\n${reg}: ${e.message}`);
      }
    }
  }
  console.log('\nFinished testing regions.');
}

check();

