import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^\uFEFF/, '').trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/^\uFEFF/, '').trim();

const s = createClient(url, key);

async function run() {
  const { data, error } = await s.from('tarifario').select('id, category, subcategory, sub_subcategory').limit(1);
  if (error) {
    console.log('Column check error:', error.message);
  } else {
    console.log('Column sub_subcategory exists! Sample:', data);
  }
}

run().catch(console.error);
