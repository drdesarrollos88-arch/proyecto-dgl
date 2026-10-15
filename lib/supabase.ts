import { createClient, SupabaseClient } from '@supabase/supabase-js';

const cleanStr = (val?: string) => (val || '').replace(/^\uFEFF/, '').trim();

function getUrl(): string {
  return cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function getAnonKey(): string {
  return cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function getServiceKey(): string {
  return cleanStr(process.env.SUPABASE_SERVICE_ROLE_KEY) || getAnonKey();
}

export const isSupabaseConfigured = Boolean(
  cleanStr(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  (cleanStr(process.env.SUPABASE_SERVICE_ROLE_KEY) || cleanStr(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
);

let _adminClient: SupabaseClient | null = null;
let _lastServiceKey: string = '';

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getUrl();
  const key = getServiceKey();
  if (!url || !key) return null;

  if (!_adminClient || _lastServiceKey !== key) {
    _lastServiceKey = key;
    _adminClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _adminClient;
}

// Cliente público para el navegador / componentes cliente
export const supabase = isSupabaseConfigured
  ? createClient(getUrl(), getAnonKey())
  : null;

// Cliente administrativo con service_role para las API routes del servidor (Next.js)
// Envuelto en Proxy para evaluar dinámicamente el cliente con la mejor clave disponible
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    if (!client) return null;
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});
