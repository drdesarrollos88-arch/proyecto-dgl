import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export interface SalesforceAuthData {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  userName?: string;
  userEmail?: string;
  userId?: string;
  orgId?: string;
  issuedAt?: string;
  updatedAt: string;
}

export interface SalesforceStatusResponse {
  connected: boolean;
  userName?: string;
  userEmail?: string;
  instanceUrl?: string;
  updatedAt?: string;
}

const CONFIG_KEY = 'salesforce_auth';
let _memoryAuth: SalesforceAuthData | null = null;

// Helper: Codificar base64url para PKCE
function base64UrlEncode(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Genera el par PKCE (code_verifier y code_challenge) usando Web Crypto nativo
 */
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const verifier = base64UrlEncode(randomBytes);

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = base64UrlEncode(new Uint8Array(hash));

  return { verifier, challenge };
}

/**
 * Obtiene la URL de redirección configurada según el origen (localhost o Cloudflare Workers)
 */
export function getRedirectUri(origin?: string): string {
  if (origin && origin.includes('localhost')) {
    return 'http://localhost:3000/api/auth/salesforce/callback';
  }
  return 'https://dgl-cotizador.dr-desarrollos88.workers.dev/api/auth/salesforce/callback';
}

/**
 * Construye la URL de autorización OAuth 2.0 hacia Salesforce
 */
export async function buildSalesforceAuthUrl(origin: string, challenge: string): Promise<string> {
  const clientId = process.env.SALESFORCE_CLIENT_ID || '';
  const loginUrl = (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');
  const redirectUri = getRedirectUri(origin);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'consent',
  });

  return `${loginUrl}/services/oauth2/authorize?${params.toString()}`;
}

/**
 * Guarda las credenciales de Salesforce de forma persistente en Supabase (configuracion_sistema)
 */
export async function saveSalesforceAuth(authData: SalesforceAuthData): Promise<void> {
  _memoryAuth = authData;
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('configuracion_sistema').upsert({
        key: CONFIG_KEY,
        value: authData,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error guardando salesforce_auth en Supabase:', err);
    }
  }
}

/**
 * Lee las credenciales de Salesforce desde Supabase o memoria
 */
export async function getStoredSalesforceAuth(): Promise<SalesforceAuthData | null> {
  if (_memoryAuth) return _memoryAuth;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('configuracion_sistema')
        .select('value')
        .eq('key', CONFIG_KEY)
        .single();

      if (!error && data?.value) {
        _memoryAuth = data.value as SalesforceAuthData;
        return _memoryAuth;
      }
    } catch (err) {
      console.error('Error leyendo salesforce_auth desde Supabase:', err);
    }
  }

  return null;
}

/**
 * Intercambia el código de autorización obtenido en el callback por tokens OAuth
 */
export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  origin: string
): Promise<SalesforceAuthData> {
  const clientId = process.env.SALESFORCE_CLIENT_ID || '';
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';
  const loginUrl = (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');
  const redirectUri = getRedirectUri(origin);

  const bodyParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });

  const tokenRes = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Error canjeando código en Salesforce (${tokenRes.status}): ${errText}`);
  }

  const tokenJson = await tokenRes.json();
  const accessToken = tokenJson.access_token;
  const refreshToken = tokenJson.refresh_token;
  const instanceUrl = tokenJson.instance_url || process.env.SALESFORCE_INSTANCE_URL || 'https://idiem.my.salesforce.com';
  const identityUrl = tokenJson.id;

  let userName = 'Usuario IDIEM';
  let userEmail = 'diego.roman@idiem.cl';
  let userId = '';
  let orgId = '';

  if (identityUrl && accessToken) {
    try {
      const userRes = await fetch(identityUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const userJson = await userRes.json();
        userName = userJson.display_name || userJson.username || userName;
        userEmail = userJson.email || userEmail;
        userId = userJson.user_id || '';
        orgId = userJson.organization_id || '';
      }
    } catch (e) {
      console.warn('No se pudo consultar identityUrl de Salesforce:', e);
    }
  }

  const authData: SalesforceAuthData = {
    accessToken,
    refreshToken: refreshToken || '',
    instanceUrl,
    userName,
    userEmail,
    userId,
    orgId,
    issuedAt: tokenJson.issued_at ? String(tokenJson.issued_at) : undefined,
    updatedAt: new Date().toISOString(),
  };

  await saveSalesforceAuth(authData);
  return authData;
}

/**
 * Renueva el token de acceso de Salesforce usando el refresh_token
 */
export async function refreshSalesforceToken(refreshToken: string): Promise<string> {
  const clientId = process.env.SALESFORCE_CLIENT_ID || '';
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';
  const loginUrl = (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');

  const bodyParams = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: bodyParams.toString(),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Fallo al refrescar token de Salesforce (${res.status}): ${errText}`);
  }

  const json = await res.json();
  const newAccessToken = json.access_token;
  const newInstanceUrl = json.instance_url;

  const current = await getStoredSalesforceAuth();
  if (current) {
    const updated: SalesforceAuthData = {
      ...current,
      accessToken: newAccessToken,
      instanceUrl: newInstanceUrl || current.instanceUrl,
      updatedAt: new Date().toISOString(),
    };
    await saveSalesforceAuth(updated);
  }

  return newAccessToken;
}

/**
 * Obtiene un Access Token válido garantizado (hace ping y si expiró, lo renueva automáticamente)
 */
export async function getValidSalesforceClient(): Promise<{
  accessToken: string;
  instanceUrl: string;
  userName: string;
}> {
  const auth = await getStoredSalesforceAuth();
  if (!auth || (!auth.accessToken && !auth.refreshToken)) {
    throw new Error('Salesforce no está conectado. Por favor inicia sesión en Salesforce primero.');
  }

  const instanceUrl = auth.instanceUrl || 'https://idiem.my.salesforce.com';

  // 1. Probar si el token actual está vivo
  try {
    const testRes = await fetch(`${instanceUrl}/services/data/v59.0/sobjects/Opportunity/describe`, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
    });

    if (testRes.ok) {
      return {
        accessToken: auth.accessToken,
        instanceUrl,
        userName: auth.userName || 'Usuario IDIEM',
      };
    }
  } catch {
    // Si falla la conexión, intentamos refrescar
  }

  // 2. Si no funcionó o expiró, renovar con el refresh_token
  if (auth.refreshToken) {
    const newAccessToken = await refreshSalesforceToken(auth.refreshToken);
    return {
      accessToken: newAccessToken,
      instanceUrl,
      userName: auth.userName || 'Usuario IDIEM',
    };
  }

  throw new Error('La sesión de Salesforce ha caducado y no tiene Refresh Token. Por favor reautentica.');
}

/**
 * Consulta el estado actual de la conexión de Salesforce para la interfaz de usuario
 */
export async function getSalesforceStatus(): Promise<SalesforceStatusResponse> {
  const auth = await getStoredSalesforceAuth();
  if (!auth || (!auth.accessToken && !auth.refreshToken)) {
    return { connected: false };
  }

  return {
    connected: true,
    userName: auth.userName || 'Diego Román',
    userEmail: auth.userEmail || 'diego.roman@idiem.cl',
    instanceUrl: auth.instanceUrl || 'https://idiem.my.salesforce.com',
    updatedAt: auth.updatedAt,
  };
}

/**
 * Desconecta la sesión de Salesforce eliminando las credenciales almacenadas
 */
export async function disconnectSalesforce(): Promise<void> {
  _memoryAuth = null;
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('configuracion_sistema').delete().eq('key', CONFIG_KEY);
    } catch (err) {
      console.error('Error desconectando salesforce:', err);
    }
  }
}

