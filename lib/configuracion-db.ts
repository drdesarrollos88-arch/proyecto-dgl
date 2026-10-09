import { FormatoSettings, CorrelativoConfig } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';
import {
  DEFAULT_FORMATO_SETTINGS,
  DEFAULT_CORRELATIVO_CONFIG,
  getFormatoSettings as getLocalFormatoSettings,
  saveFormatoSettings as saveLocalFormatoSettings,
  getCorrelativoConfig as getLocalCorrelativoConfig,
  saveCorrelativoConfig as saveLocalCorrelativoConfig,
} from './db';

const KEY_FORMATO = 'formato_settings';
const KEY_CORRELATIVOS = 'correlativo_config';

let _cachedFormato: FormatoSettings | null = null;
let _cachedCorrelativos: CorrelativoConfig | null = null;

/**
 * Obtiene la configuración de formato oficial desde Supabase o memoria local
 */
export async function getFormatoSettingsAsync(): Promise<FormatoSettings> {
  if (_cachedFormato) return _cachedFormato;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('configuracion_sistema')
        .select('value')
        .eq('key', KEY_FORMATO)
        .maybeSingle();

      if (!error && data?.value) {
        _cachedFormato = data.value as FormatoSettings;
        return _cachedFormato;
      }
    } catch (err) {
      console.warn('Error leyendo formato_settings desde Supabase:', err);
    }
  }

  _cachedFormato = getLocalFormatoSettings();
  return _cachedFormato;
}

/**
 * Guarda la configuración de formato en Supabase y memoria
 */
export async function saveFormatoSettingsAsync(
  settings: Partial<FormatoSettings>,
  updatedBy: string
): Promise<FormatoSettings> {
  const current = await getFormatoSettingsAsync();
  const updated: FormatoSettings = {
    ...current,
    ...settings,
    observations: Array.isArray(settings.observations) ? settings.observations : current.observations,
  };

  _cachedFormato = updated;
  saveLocalFormatoSettings(settings, updatedBy);

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('configuracion_sistema').upsert({
        key: KEY_FORMATO,
        value: updated,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error guardando formato_settings en Supabase:', err);
    }
  }

  return updated;
}

/**
 * Obtiene la configuración de correlativos oficiales desde Supabase o memoria
 */
export async function getCorrelativoConfigAsync(): Promise<CorrelativoConfig> {
  if (_cachedCorrelativos) return _cachedCorrelativos;

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data, error } = await supabaseAdmin
        .from('configuracion_sistema')
        .select('value')
        .eq('key', KEY_CORRELATIVOS)
        .maybeSingle();

      if (!error && data?.value) {
        _cachedCorrelativos = data.value as CorrelativoConfig;
        return _cachedCorrelativos;
      }
    } catch (err) {
      console.warn('Error leyendo correlativo_config desde Supabase:', err);
    }
  }

  _cachedCorrelativos = getLocalCorrelativoConfig();
  return _cachedCorrelativos;
}

/**
 * Guarda la configuración de correlativos en Supabase y memoria
 */
export async function saveCorrelativoConfigAsync(
  config: CorrelativoConfig
): Promise<CorrelativoConfig> {
  const sanitized: CorrelativoConfig = {
    defaultInitialNumber: Number(config.defaultInitialNumber) || 598,
    sequences: { ...(config.sequences || {}) },
  };

  _cachedCorrelativos = sanitized;
  saveLocalCorrelativoConfig(sanitized);

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from('configuracion_sistema').upsert({
        key: KEY_CORRELATIVOS,
        value: sanitized,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error guardando correlativo_config en Supabase:', err);
    }
  }

  return sanitized;
}

/**
 * Calcula el siguiente código de cotización de forma resiliente
 */
export async function getNextCorrelativoAsync(
  centroCosto: string,
  year?: number
): Promise<{ code: string; correlativo: number; fullNumber: string }> {
  const currentYear = year || new Date().getFullYear();
  const match = centroCosto.match(/(\d{4})/);
  const ccNum = match ? match[1] : '2339';

  const config = await getCorrelativoConfigAsync();
  const currentAssigned =
    config.sequences[ccNum] !== undefined
      ? Number(config.sequences[ccNum])
      : config.defaultInitialNumber || 598;

  const fullNumber = String(currentAssigned).padStart(4, '0');
  const code = `PR.DGL.${ccNum}.${currentYear}.${fullNumber}-V1`;

  return { code, correlativo: currentAssigned, fullNumber };
}

/**
 * Avanza la secuencia de correlativos de forma atómica en Supabase
 */
export async function advanceCorrelativoAsync(
  centroCosto: string,
  usedNumber?: number
): Promise<void> {
  const match = centroCosto.match(/(\d{4})/);
  const ccNum = match ? match[1] : '2339';
  const config = await getCorrelativoConfigAsync();

  const current =
    config.sequences[ccNum] !== undefined
      ? Number(config.sequences[ccNum])
      : config.defaultInitialNumber || 598;

  const next = usedNumber !== undefined && usedNumber >= current ? usedNumber + 1 : current + 1;
  config.sequences[ccNum] = next;

  await saveCorrelativoConfigAsync(config);
}

