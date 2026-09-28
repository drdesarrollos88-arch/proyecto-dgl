import { TarifarioItem, ReglaAprendida } from './types';

/**
 * Normaliza texto para búsqueda inteligente de ensayos geotécnicos:
 * - Minúsculas y remoción de tildes (á -> a, ñ -> n)
 * - Normaliza decimales de dimensiones: 15,0 o 15.0 -> 15; 30,0 -> 30; 5,0 -> 5; 10,0 -> 10
 * - Normaliza signos de dimensiones: "15 x 30", "15*30", "15X30" -> "15x30"
 * - Normaliza términos geotécnicos frecuentes: in-situ -> insitu, cono de arena -> cono arena
 */
export function normalizeGeotechnicalText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Normalizar decimales en dimensiones, ej. 15,0 o 15.0 a 15; 3,6 a 3.6
    .replace(/(\d+)[,.]0+\b/g, '$1')
    .replace(/(\d+),(\d+)/g, '$1.$2')
    // Normalizar dimensiones con espacios como "15 x 30" o "15 * 30" a "15x30"
    .replace(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)/g, '$1x$2')
    // Normalizar in-situ / in situ
    .replace(/in[\s-]situ/g, 'insitu')
    // Normalizar cono de arena
    .replace(/cono\s+de\s+arena/g, 'cono arena');
}

export interface SmartSearchResult {
  item: TarifarioItem;
  score: number;
  matchReason?: string;
  isAiSuggested?: boolean;
  isLearnedRule?: boolean;
  learnedRuleConfirmations?: number;
}

/**
 * Búsqueda inteligente de alto rendimiento sobre los 358 ensayos del laboratorio DGL.
 * Resuelve variaciones dimensionales (15x30 <-> 15,0 x 30,0), abreviaciones,
 * y coincidencia multitoken con jerarquía, ponderación geotécnica y reglas aprendidas (Opción B).
 */
export function smartSearchTarifario(
  items: TarifarioItem[],
  query: string,
  limit: number = 15,
  reglasAprendidas?: ReglaAprendida[]
): SmartSearchResult[] {
  const qClean = query.trim();
  if (!qClean) return [];

  const qNorm = normalizeGeotechnicalText(qClean);
  const tokens = qNorm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const results: SmartSearchResult[] = [];

  for (const item of items) {
    const rawDesig = item.designation || '';
    const normDesig = normalizeGeotechnicalText(rawDesig);
    const normFull = normalizeGeotechnicalText(
      `${item.code || ''} ${item.sku || ''} ${rawDesig} ${item.norm || ''} ${item.subcategory || ''} ${item.category || ''}`
    );

    // Todos los tokens deben coincidir en alguna parte de la cadena normalizada del ítem
    const allTokensMatch = tokens.every((tok) => normFull.includes(tok));

    if (allTokensMatch) {
      let score = 100;
      const desigLower = rawDesig.toLowerCase();

      // Coincidencia exacta de Código o SKU tiene máxima prioridad
      if (item.code && item.code.trim().toLowerCase() === qClean.toLowerCase()) {
        score += 250;
      }
      if (item.sku && item.sku.trim().toLowerCase() === qClean.toLowerCase()) {
        score += 250;
      }

      // Coincidencia exacta de designación
      if (desigLower === qClean.toLowerCase() || normDesig === qNorm) {
        score += 180;
      }

      // Priorizar ensayos principales que inicien con palabras clave (ej. "Ensayo Triaxial...", "Triaxial...")
      if (
        tokens.some((t) => normDesig.startsWith(t)) ||
        normDesig.startsWith('ensaye') ||
        normDesig.startsWith('ensayo')
      ) {
        score += 35;
      }

      // Priorización de ensayos principales vs recargos por día u hora adicional
      if (desigLower.includes('dia adicional') || desigLower.includes('día adicional')) {
        score -= 40;
      }
      if (desigLower.includes('hora adicional')) {
        score -= 45;
      }
      if (desigLower.includes('preparacion') || desigLower.includes('preparación')) {
        score -= 15;
      }

      // Ponderación por concisión: ensayos más específicos obtienen mayor relevancia
      score -= Math.min(25, Math.floor(rawDesig.length / 40));

      results.push({ item, score });
    }
  }

  // Bonificación por Reglas Aprendidas activas en IDIEM (Opción B)
  if (reglasAprendidas && Array.isArray(reglasAprendidas) && reglasAprendidas.length > 0) {
    for (const regla of reglasAprendidas) {
      if (regla.estado !== 'activo') continue;
      const normTerm = normalizeGeotechnicalText(regla.terminoUsuario);
      if (!normTerm) continue;

      const matchTerm = qNorm.includes(normTerm) || normTerm.includes(qNorm);

      if (matchTerm) {
        // Verificar si el ítem correspondiente ya está en los resultados
        const existing = results.find(
          (r) =>
            (regla.codigoEnsayo && r.item.code === regla.codigoEnsayo) ||
            (regla.sku && r.item.sku === regla.sku)
        );

        if (existing) {
          existing.score += 260 + (regla.conteoConfirmaciones * 15);
          existing.isLearnedRule = true;
          existing.learnedRuleConfirmations = regla.conteoConfirmaciones;
          existing.matchReason = `🧠 Regla aprendida por uso (${regla.conteoConfirmaciones} confirmaciones)`;
        } else {
          // Si el ensayo no había sido capturado por el filtro léxico estricto, insertarlo
          const candidate = items.find(
            (it) =>
              (regla.codigoEnsayo && it.code === regla.codigoEnsayo) ||
              (regla.sku && it.sku === regla.sku)
          );
          if (candidate) {
            results.push({
              item: candidate,
              score: 280 + (regla.conteoConfirmaciones * 15),
              isLearnedRule: true,
              learnedRuleConfirmations: regla.conteoConfirmaciones,
              matchReason: `🧠 Regla aprendida por uso (${regla.conteoConfirmaciones} confirmaciones)`,
            });
          }
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

