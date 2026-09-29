import { createClient } from '@supabase/supabase-js';

const cleanStr = (val?: string) => (val || '').replace(/^\uFEFF/, '').trim();
const supabaseUrl = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const supabaseServiceKey = cleanStr(process.env.SUPABASE_SERVICE_ROLE_KEY) || supabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && (supabaseServiceKey || supabaseAnonKey));

// Cliente público para el navegador / componentes cliente
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Cliente administrativo con service_role para las API routes del servidor (Next.js)
export const supabaseAdmin = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
