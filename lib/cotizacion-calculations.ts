import { CotizacionItem } from './types';

/**
 * Indicadores por defecto de resiliencia en caso de que la API o la cotización carezcan de valores.
 */
export const DEFAULT_UF_VALUE = 40879.04;
export const DEFAULT_DOLLAR_VALUE = 933.47;

/**
 * Calcula los subtotales de un ítem individual garantizando coherencia estricta en UF, CLP y USD.
 *
 * Reglas de cálculo según la moneda principal de la cotización:
 * 1. 'UF': El precio base y subtotal se fijan en UF (2 decimales). CLP y USD se calculan como equivalencias exactas.
 * 2. 'CLP': El precio base y subtotal se fijan en pesos enteros (CLP). UF y USD se calculan como equivalencias exactas.
 * 3. 'USD': El precio base y subtotal se fijan en dólares (2 decimales). CLP y UF se calculan como equivalencias exactas.
 */
export function calculateItemSubtotals(
  item: {
    ufPrice: number;
    factor?: number;
    quantity?: number;
    isDivider?: boolean;
    subtotalUf?: number;
    subtotalClp?: number;
    subtotalUsd?: number;
  },
  ufValue: number = DEFAULT_UF_VALUE,
  dollarValue: number = DEFAULT_DOLLAR_VALUE,
  currency: 'UF' | 'CLP' | 'USD' = 'UF'
): { subtotalUf: number; subtotalClp: number; subtotalUsd: number } {
  if (item.isDivider) {
    return { subtotalUf: 0, subtotalClp: 0, subtotalUsd: 0 };
  }

  const qty = typeof item.quantity === 'number' ? Math.max(0, item.quantity) : 0;
  const factor = typeof item.factor === 'number' ? Math.max(0, item.factor) : 1.0;
  const ufPrice = typeof item.ufPrice === 'number' ? Math.max(0, item.ufPrice) : 0;

  const safeUf = ufValue > 0 ? ufValue : DEFAULT_UF_VALUE;
  const safeUsd = dollarValue > 0 ? dollarValue : DEFAULT_DOLLAR_VALUE;

  if (currency === 'CLP') {
    // Modo CLP: la moneda contractual es pesos chilenos (enteros)
    const unitPriceClp = Math.round(ufPrice * factor * safeUf);
    const subtotalClp = Math.round(unitPriceClp * qty);
    const subtotalUf = safeUf > 0 ? Math.round((subtotalClp / safeUf) * 100) / 100 : 0;
    const subtotalUsd = safeUsd > 0 ? Math.round((subtotalClp / safeUsd) * 100) / 100 : 0;
    return { subtotalUf, subtotalClp, subtotalUsd };
  }

  if (currency === 'USD') {
    // Modo USD: la moneda contractual es dólares americanos (2 decimales)
    const unitPriceUsd = Math.round(((ufPrice * factor * safeUf) / safeUsd) * 100) / 100;
    const subtotalUsd = Math.round(unitPriceUsd * qty * 100) / 100;
    const subtotalClp = Math.round(subtotalUsd * safeUsd);
    const subtotalUf = safeUf > 0 ? Math.round(((subtotalUsd * safeUsd) / safeUf) * 100) / 100 : 0;
    return { subtotalUf, subtotalClp, subtotalUsd };
  }

  // Modo UF (por defecto institucional IDIEM): la moneda contractual es UF (2 decimales)
  const unitPriceUf = Math.round(ufPrice * factor * 100) / 100;
  const subtotalUf = Math.round(unitPriceUf * qty * 100) / 100;
  const subtotalClp = Math.round(subtotalUf * safeUf);
  const subtotalUsd = safeUsd > 0 ? Math.round(((subtotalUf * safeUf) / safeUsd) * 100) / 100 : 0;
  return { subtotalUf, subtotalClp, subtotalUsd };
}

/**
 * Recalcula todos los ítems de una cotización aplicando los indicadores económicos y moneda seleccionada.
 */
export function recalculateCotizacionItems(
  items: CotizacionItem[],
  ufValue: number = DEFAULT_UF_VALUE,
  dollarValue: number = DEFAULT_DOLLAR_VALUE,
  currency: 'UF' | 'CLP' | 'USD' = 'UF'
): CotizacionItem[] {
  return items.map((it) => {
    if (it.isDivider) return it;

    const { subtotalUf, subtotalClp, subtotalUsd } = calculateItemSubtotals(
      it,
      ufValue,
      dollarValue,
      currency
    );

    return {
      ...it,
      subtotalUf,
      subtotalClp,
      subtotalUsd,
    };
  });
}

export interface PartidaTotal {
  count: number;
  subtotalUf: number;
  subtotalClp: number;
  subtotalUsd: number;
}

export interface CotizacionTotalsResult {
  totalUf: number;
  totalClp: number;
  totalUsd: number;
  totalWeight: number;
  totalUnitWeight: number;
  partidaTotals: Record<string, PartidaTotal>;
}

/**
 * Calcula los totales consolidados y los subtotales por partida garantizando cuadre matemático estricto:
 * 1. Cada subtotal de partida es la suma exacta de sus ítems componentes.
 * 2. El total general es la suma exacta de todos los ítems (y por ende de las partidas).
 * 3. Se eliminan los desfases de centavos o pesos causados por acumulación de coma flotante.
 */
export function calculateCotizacionTotals(
  items: CotizacionItem[],
  ufValue: number = DEFAULT_UF_VALUE,
  dollarValue: number = DEFAULT_DOLLAR_VALUE,
  currency: 'UF' | 'CLP' | 'USD' = 'UF'
): CotizacionTotalsResult {
  let totalUf = 0;
  let totalClp = 0;
  let totalUsd = 0;
  let totalWeight = 0;
  let totalUnitWeight = 0;

  const partidaTotals: Record<string, PartidaTotal> = {};
  let currentDividerId = '';

  for (const it of items) {
    if (it.isDivider) {
      currentDividerId = it.id;
      partidaTotals[currentDividerId] = {
        count: 0,
        subtotalUf: 0,
        subtotalClp: 0,
        subtotalUsd: 0,
      };
      continue;
    }

    const { subtotalUf, subtotalClp, subtotalUsd } = calculateItemSubtotals(
      it,
      ufValue,
      dollarValue,
      currency
    );

    totalUf += subtotalUf;
    totalClp += subtotalClp;
    totalUsd += subtotalUsd;

    if (currentDividerId) {
      if (!partidaTotals[currentDividerId]) {
        partidaTotals[currentDividerId] = {
          count: 0,
          subtotalUf: 0,
          subtotalClp: 0,
          subtotalUsd: 0,
        };
      }
      partidaTotals[currentDividerId].count += 1;
      partidaTotals[currentDividerId].subtotalUf += subtotalUf;
      partidaTotals[currentDividerId].subtotalClp += subtotalClp;
      partidaTotals[currentDividerId].subtotalUsd += subtotalUsd;
    }

    const w =
      typeof it.minWeightKg === 'number'
        ? it.minWeightKg
        : parseFloat(String(it.minWeightKg || 0));
    if (!isNaN(w) && w > 0) {
      totalWeight += w * (it.quantity || 0);
      totalUnitWeight += w;
    }
  }

  // Redondeo de seguridad para evitar residuos IEEE-754 en subtotales de partidas
  for (const divId of Object.keys(partidaTotals)) {
    partidaTotals[divId].subtotalUf = Math.round(partidaTotals[divId].subtotalUf * 100) / 100;
    partidaTotals[divId].subtotalClp = Math.round(partidaTotals[divId].subtotalClp);
    partidaTotals[divId].subtotalUsd = Math.round(partidaTotals[divId].subtotalUsd * 100) / 100;
  }

  return {
    totalUf: Math.round(totalUf * 100) / 100,
    totalClp: Math.round(totalClp),
    totalUsd: Math.round(totalUsd * 100) / 100,
    totalWeight: Math.round(totalWeight * 10) / 10,
    totalUnitWeight: Math.round(totalUnitWeight * 10) / 10,
    partidaTotals,
  };
}
