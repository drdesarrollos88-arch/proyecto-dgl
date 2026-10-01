import { BibliografiaItem, TipoBibliografia, EstadoBibliografia } from './types';
import { isSupabaseConfigured, supabaseAdmin } from './supabase';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');

// Bibliografía técnica base precargada oficial de IDIEM - Universidad de Chile
const BOOTSTRAP_BIBLIOGRAFIA: BibliografiaItem[] = [
  {
    id: 'bib-tech-1',
    tipo: 'tecnica',
    titulo: 'NCh 1508:2014 Geotecnia - Estudio de mecánica de suelos',
    descripcion: 'Norma Chilena Oficial que establece los requisitos mínimos para el desarrollo de estudios geotécnicos y mecánica de suelos.',
    contenidoTexto: `NORMA CHILENA OFICIAL NCh1508:2014 - ESTUDIO DE MECÁNICA DE SUELOS:
1. Alcance: Aplica a estudios de mecánica de suelos para proyectos de edificación, obras civiles y fundaciones en territorio chileno.
2. Exploración del subsuelo: El número mínimo de puntos de exploración (calicatas, pozos o sondajes) dependerá del área de la obra, altura de edificación y complejidad geológica. En general, mínimo 3 puntos de exploración para obras menores y densificación según superficie.
3. Ensayos mínimos requeridos:
   - Granulometría por tamizado (NCh1517/1 o ASTM D422).
   - Límites de Atterberg (Límite Líquido y Plástico) según NCh1517/2 o ASTM D4318.
   - Clasificación de suelos según Sistema Unificado de Clasificación de Suelos (USCS) ASTM D2487.
   - Contenido de humedad natural (NCh1515 o ASTM D2216).
   - Densidad de partículas sólidas (NCh1532 o ASTM D854).
   - Ensayos mecánicos: Corte directo (ASTM D3080) o Triaxial (ASTM D2850 / D4767) para determinar ángulo de fricción interna y cohesión.
   - En suelos arcillosos compresibles: Ensayo de consolidación unidimensional edométrica (ASTM D2435).
4. Agresividad química: Cuando existan fundaciones de hormigón en contacto con el suelo o nivel freático, se deben ensayar sales solubles totales, sulfatos solubles (NCh1444) y cloruros.`,
    nombreArchivoOriginal: 'NCh1508-2014_Geotecnia_Oficial.pdf',
    tipoArchivo: 'pdf',
    tamanoBytes: 1024 * 350,
    tags: ['NCh1508', 'Mecánica de Suelos', 'USCS', 'Fundaciones', 'Norma Chilena'],
    metadatos: {
      autor: 'Instituto Nacional de Normalización (INN)',
      normaRef: 'NCh 1508:2014',
    },
    estado: 'activo',
    creadoPor: 'Sistema Oficial IDIEM',
    creadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bib-tech-2',
    tipo: 'tecnica',
    titulo: 'Manual de Carreteras MOP Volumen 8 - Especificaciones y Métodos de Ensayo',
    descripcion: 'Normativa oficial de la Dirección de Vialidad del Ministerio de Obras Públicas para pavimentos, bases y subrasantes.',
    contenidoTexto: `MANUAL DE CARRETERAS MOP VOLUMEN 8 - ENSAYOS Y ESPECIFICACIONES DE SUELOS Y ÁRIDOS:
1. Control de bases y subrasantes viales:
   - Proctor Modificado (Método 8.102.7 / ASTM D1557): Determinación de la densidad seca máxima y humedad óptima en moldes de 4" o 6".
   - Razón de Soporte California - CBR (Método 8.102.11 / ASTM D1883): Medición del índice de soporte en probetas saturadas a 4 días con carga de sobrepeso.
   - Densidad In Situ por Cono de Arena (Método 8.102.8 / NCh1516): Exigencia habitual de compactación >= 95% del Proctor Modificado en sub-bases y >= 100% en bases estabilizadas.
2. Desgaste Los Ángeles (Método 8.202.11 / ASTM C131 y C535):
   - Exigencia de desgaste inferior al 35% en áridos para bases y sub-bases granulares, y menor a 25% para capas de rodadura o gravas trituradas.
3. Clasificación vial: Metodología AASHTO M145 y USCS.`,
    nombreArchivoOriginal: 'Manual_Carreteras_MOP_Vol8_Resumen.pdf',
    tipoArchivo: 'pdf',
    tamanoBytes: 1024 * 480,
    tags: ['Manual de Carreteras', 'MOP', 'Vialidad', 'CBR', 'Proctor', 'Los Ángeles'],
    metadatos: {
      autor: 'Ministerio de Obras Públicas (MOP)',
      normaRef: 'MC-V8',
    },
    estado: 'activo',
    creadoPor: 'Sistema Oficial IDIEM',
    creadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bib-tech-3',
    tipo: 'tecnica',
    titulo: 'ASTM D7012 / ISRM - Mecánica de Rocas: Compresión Simple y Triaxial',
    descripcion: 'Estándar internacional para determinación de resistencia a la compresión uniaxial, triaxial y módulo de deformación estático en testigos de roca.',
    contenidoTexto: `NORMAS ASTM D7012 & ISRM - ENSAYOS MECÁNICOS EN ROCAS:
1. Preparación de probetas (ASTM D4543): Testigos cilíndricos obtenidos por perforación diamantina o tallado de colpas. La relación altura/diámetro (L/D) debe situarse estrictamente entre 2.0 y 2.5:1, con extremos refrendados planos y paralelos dentro de 0.02 mm.
2. Compresión Simple Uniaxial (ASTM D7012 Método C): Velocidad de aplicación de carga continua para alcanzar la rotura entre 2 y 15 minutos. Determinación de la resistencia UCS en MPa.
3. Propiedades físicas en roca (ISRM):
   - Densidad aparente y peso específico seco.
   - Porosidad efectiva y absorción de agua (ISRM Parte 1).
4. Ensayo de Desgaste Los Ángeles en roca de cantera (ASTM C535 / NCh1369): Aplica a colpas y áridos de gran tamaño (3" a 1 1/2") para obras marítimas, diques y escolleras.`,
    nombreArchivoOriginal: 'ASTM_D7012_ISRM_Rocas_Procedimiento.pdf',
    tipoArchivo: 'pdf',
    tamanoBytes: 1024 * 290,
    tags: ['Rocas', 'ASTM D7012', 'ISRM', 'Compresión Simple', 'Canteras', 'Obras Marítimas'],
    metadatos: {
      autor: 'ASTM International & ISRM',
      normaRef: 'ASTM D7012',
    },
    estado: 'activo',
    creadoPor: 'Sistema Oficial IDIEM',
    creadoEn: '2026-01-01T00:00:00.000Z',
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'bib-hist-1',
    tipo: 'historica',
    titulo: 'Caso Histórico: Caracterización de Cantera Marítima - ESVAL Melipilla',
    descripcion: 'Batería de ensayos aprobada por IDIEM para estudio de roca en ambiente marítimo y cantera.',
    contenidoTexto: `COTIZACIÓN HISTÓRICA APROBADA PR.DGL.2339.2026.0587:
Cliente: ESVAL S.A. | Proyecto: Cantera La Virgen, Melipilla | Centro de Costo: 2339 - Ensayos Rocas
Ensayos ejecutados:
- Cód 190: Análisis mineralógico macroscópico (1 muestra)
- Cód 191: Análisis mineralógico microscópico (1 muestra)
- Cód 189: Preparación de corte transparente o pulido en roca (1 muestra)
- Cód 210: Compresión simple probeta testigo de roca ASTM D7012 (5 probetas)
- Cód 229: Resistencia al desgaste Los Ángeles ASTM C535 / NCh 1369 (1 ensayo)
- Cód 184: Propiedades físicas en roca ISRM (3 muestras)
Cláusula particular: Extracción y transporte de 5 a 6 toneladas de colpas costeado y coordinado por el mandante.`,
    tipoArchivo: 'cotizacion',
    tags: ['Caso Histórico', 'Rocas', 'ESVAL', 'Cantera'],
    metadatos: {
      codigoCotizacion: 'PR.DGL.2339.2026.0587',
      cliente: 'ESVAL S.A.',
      proyecto: 'Cantera La Virgen',
      centroCosto: '2339 - Ensayos Rocas',
    },
    estado: 'activo',
    creadoPor: 'Diego Román',
    creadoEn: '2026-08-20T10:00:00.000Z',
    actualizadoEn: '2026-08-20T10:00:00.000Z',
  },
];

let _cachedBibliografia: BibliografiaItem[] | null = null;

function ensureCache(): BibliografiaItem[] {
  if (_cachedBibliografia) return _cachedBibliografia;

  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.bibliografia) && parsed.bibliografia.length > 0) {
        _cachedBibliografia = parsed.bibliografia;
        return _cachedBibliografia!;
      }
    }
  } catch {
    // Read-only serverless environment
  }

  _cachedBibliografia = [...BOOTSTRAP_BIBLIOGRAFIA];
  return _cachedBibliografia;
}

function persistLocally(items: BibliografiaItem[]) {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      parsed.bibliografia = items;
      fs.writeFileSync(DB_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    }
  } catch {
    // Read-only environment safe ignore
  }
}

/**
 * Obtiene el listado de bibliografía filtrado por tipo ('tecnica' | 'historica'), estado o búsqueda.
 */
export async function getBibliografia(filtro?: {
  tipo?: TipoBibliografia;
  estado?: EstadoBibliografia;
  query?: string;
  limit?: number;
}): Promise<BibliografiaItem[]> {
  // Intentar consultar Supabase si está disponible
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      let q = supabaseAdmin
        .from('bibliografia')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtro?.tipo) q = q.eq('tipo', filtro.tipo);
      if (filtro?.estado) q = q.eq('estado', filtro.estado);
      if (filtro?.limit) q = q.limit(filtro.limit);

      const { data, error } = await q;
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map((row) => ({
          id: row.id,
          tipo: row.tipo as TipoBibliografia,
          titulo: row.titulo,
          descripcion: row.descripcion,
          contenidoTexto: row.contenido_texto || row.contenidoTexto,
          nombreArchivoOriginal: row.nombre_archivo_original || row.nombreArchivoOriginal,
          tipoArchivo: row.tipo_archivo || row.tipoArchivo,
          tamanoBytes: row.tamano_bytes || row.tamanoBytes,
          tags: Array.isArray(row.tags) ? row.tags : [],
          metadatos: row.metadatos || {},
          estado: (row.estado as EstadoBibliografia) || 'activo',
          creadoPor: row.creado_por || row.creadoPor,
          creadoEn: row.created_at || row.creadoEn,
          actualizadoEn: row.updated_at || row.actualizadoEn,
        }));
      }
    } catch {
      // Fallback a memoria
    }
  }

  let items = ensureCache();

  if (filtro?.tipo) {
    items = items.filter((b) => b.tipo === filtro.tipo);
  }
  if (filtro?.estado) {
    items = items.filter((b) => b.estado === filtro.estado);
  }
  if (filtro?.query && filtro.query.trim()) {
    const qLower = filtro.query.toLowerCase().trim();
    items = items.filter(
      (b) =>
        b.titulo.toLowerCase().includes(qLower) ||
        (b.descripcion && b.descripcion.toLowerCase().includes(qLower)) ||
        b.contenidoTexto.toLowerCase().includes(qLower) ||
        (b.tags && b.tags.some((t) => t.toLowerCase().includes(qLower)))
    );
  }

  if (filtro?.limit) {
    items = items.slice(0, filtro.limit);
  }

  return items;
}

export async function getBibliografiaById(id: string): Promise<BibliografiaItem | undefined> {
  const items = ensureCache();
  return items.find((b) => b.id === id);
}

/**
 * Guarda o actualiza un ítem en la base de conocimientos.
 */
export async function saveBibliografiaItem(
  item: Partial<BibliografiaItem> & { titulo: string; tipo: TipoBibliografia }
): Promise<BibliografiaItem> {
  const items = ensureCache();
  const now = new Date().toISOString();

  let targetId = item.id;
  let creadoEn = now;

  if (targetId) {
    const existing = items.find((b) => b.id === targetId);
    if (existing) {
      creadoEn = existing.creadoEn;
    }
  } else {
    targetId = `bib-${item.tipo}-${Date.now()}`;
  }

  const fullItem: BibliografiaItem = {
    id: targetId,
    tipo: item.tipo,
    titulo: item.titulo.trim(),
    descripcion: item.descripcion?.trim() || '',
    contenidoTexto: item.contenidoTexto || '',
    nombreArchivoOriginal: item.nombreArchivoOriginal,
    tipoArchivo: item.tipoArchivo || 'txt',
    tamanoBytes: item.tamanoBytes || (item.contenidoTexto ? item.contenidoTexto.length : 0),
    tags: item.tags || [],
    metadatos: item.metadatos || {},
    estado: item.estado || 'activo',
    creadoPor: item.creadoPor || 'Sistema',
    creadoEn,
    actualizadoEn: now,
  };

  const idx = items.findIndex((b) => b.id === targetId);
  if (idx >= 0) {
    items[idx] = fullItem;
  } else {
    items.unshift(fullItem);
  }

  _cachedBibliografia = items;
  persistLocally(items);

  // Guardar en Supabase de forma asíncrona
  if (isSupabaseConfigured && supabaseAdmin) {
    Promise.resolve(
      supabaseAdmin
        .from('bibliografia')
        .upsert({
          id: fullItem.id,
          tipo: fullItem.tipo,
          titulo: fullItem.titulo,
          descripcion: fullItem.descripcion,
          contenido_texto: fullItem.contenidoTexto,
          nombre_archivo_original: fullItem.nombreArchivoOriginal,
          tipo_archivo: fullItem.tipoArchivo,
          tamano_bytes: fullItem.tamanoBytes,
          tags: fullItem.tags,
          metadatos: fullItem.metadatos,
          estado: fullItem.estado,
          creado_por: fullItem.creadoPor,
          created_at: fullItem.creadoEn,
          updated_at: fullItem.actualizadoEn,
        })
    ).catch(() => {});
  }

  return fullItem;
}

/**
 * Cambia el estado activo / inactivo de un documento o chat archivado.
 */
export async function toggleEstadoBibliografia(id: string): Promise<BibliografiaItem | null> {
  const items = ensureCache();
  const item = items.find((b) => b.id === id);
  if (!item) return null;

  item.estado = item.estado === 'activo' ? 'inactivo' : 'activo';
  item.actualizadoEn = new Date().toISOString();
  persistLocally(items);

  if (isSupabaseConfigured && supabaseAdmin) {
    Promise.resolve(
      supabaseAdmin
        .from('bibliografia')
        .update({ estado: item.estado, updated_at: item.actualizadoEn })
        .eq('id', id)
    ).catch(() => {});
  }

  return item;
}

/**
 * Elimina un documento o chat de la base de conocimientos.
 */
export async function deleteBibliografiaItem(id: string): Promise<boolean> {
  const items = ensureCache();
  const idx = items.findIndex((b) => b.id === id);
  if (idx === -1) return false;

  items.splice(idx, 1);
  _cachedBibliografia = items;
  persistLocally(items);

  if (isSupabaseConfigured && supabaseAdmin) {
    Promise.resolve(
      supabaseAdmin
        .from('bibliografia')
        .delete()
        .eq('id', id)
    ).catch(() => {});
  }

  return true;
}

/**
 * MOTOR DE CONSULTA RAG CON PREVALENCIA TÉCNICA OBLIGATORIA:
 * 
 * Regla de Prevalencia:
 * La Bibliografía Técnica (Normas oficiales NCh, ASTM, Manual de Carreteras MOP)
 * PREVALECE SIEMPRE sobre la Bibliografía Histórica (casos de proyectos y chats anteriores).
 */
export async function buscarBibliografiaRelevante(
  queryText: string,
  limiteTecnica: number = 2,
  limiteHistorica: number = 2
): Promise<{
  tecnica: BibliografiaItem[];
  historica: BibliografiaItem[];
  promptSnippet: string;
}> {
  const allItems = await getBibliografia({ estado: 'activo' });
  const qClean = (queryText || '').toLowerCase();

  // Filtrar y rankear por relevancia semántica léxica
  const rankItems = (list: BibliografiaItem[]) => {
    return list
      .map((item) => {
        let score = 0;
        const textToSearch = `${item.titulo} ${item.descripcion || ''} ${item.tags?.join(' ') || ''} ${item.contenidoTexto}`.toLowerCase();

        // Coincidencias de términos clave
        const terms = qClean.split(/\s+/).filter((t) => t.length > 2);
        for (const term of terms) {
          if (textToSearch.includes(term)) {
            score += 10;
          }
        }

        // Palabras geotécnicas clave
        if (/(?:roca|cantera|mar[ií]tim|los angeles|astm d7012)/i.test(qClean) && textToSearch.includes('roca')) score += 30;
        if (/(?:paviment|cbr|proctor|mop|carreter|subrasante)/i.test(qClean) && textToSearch.includes('carreteras')) score += 30;
        if (/(?:suelo|calicata|uscs|nch1508|edific)/i.test(qClean) && textToSearch.includes('nch 1508')) score += 30;

        return { item, score };
      })
      .sort((a, b) => b.score - a.score);
  };

  const tecnicasActivas = allItems.filter((i) => i.tipo === 'tecnica');
  const historicasActivas = allItems.filter((i) => i.tipo === 'historica');

  const rankedTecnica = rankItems(tecnicasActivas);
  const rankedHistorica = rankItems(historicasActivas);

  // Tomar los más relevantes según límites (si la consulta es vacía, toma los primeros disponibles)
  const selectedTecnica = rankedTecnica.slice(0, Math.max(1, limiteTecnica)).map((r) => r.item);
  const selectedHistorica = rankedHistorica.slice(0, Math.max(1, limiteHistorica)).map((r) => r.item);

  // Construir snippet con regla de prevalencia explícita para Gemini
  const snippetLines: string[] = [];

  snippetLines.push('================================================================');
  snippetLines.push('BASE DE CONOCIMIENTOS INSTITUCIONAL IDIEM (RAG TÉCNICO E HISTÓRICO)');
  snippetLines.push('================================================================');
  snippetLines.push('');
  snippetLines.push('*** REGLA DE PREVALENCIA OBLIGATORIA (NORMATIVA TÉCNICA IDIEM) ***');
  snippetLines.push('La Bibliografía Técnica oficial (Normas NCh, ASTM, Manual de Carreteras MOP) es la MÁXIMA AUTORIDAD técnica.');
  snippetLines.push('PREVALECE SIEMPRE sobre cualquier antecedente de la Bibliografía Histórica o consultas pasadas.');
  snippetLines.push('Si existe alguna discrepancia entre un caso histórico y una norma oficial, APLICA Y RESPETA SIEMPRE LA NORMA TÉCNICA.');
  snippetLines.push('');

  if (selectedTecnica.length > 0) {
    snippetLines.push('--- [1. BIBLIOGRAFÍA TÉCNICA OFICIAL (MÁXIMA AUTORIDAD)] ---');
    selectedTecnica.forEach((tech, idx) => {
      snippetLines.push(`[Doc Técnico #${idx + 1}]: "${tech.titulo}"`);
      if (tech.descripcion) snippetLines.push(`Descripción: ${tech.descripcion}`);
      // Limitar contenido a ~1500 caracteres por documento técnico para no saturar tokens
      const resumen = tech.contenidoTexto.length > 1500
        ? tech.contenidoTexto.slice(0, 1500) + '... [extracto técnico normativo]'
        : tech.contenidoTexto;
      snippetLines.push(`Contenido normativo:\n${resumen}\n`);
    });
  }

  if (selectedHistorica.length > 0) {
    snippetLines.push('--- [2. BIBLIOGRAFÍA HISTÓRICA (CASOS ANTERIORES Y EXPERIENCIA COMERCIAL)] ---');
    selectedHistorica.forEach((hist, idx) => {
      snippetLines.push(`[Caso Histórico #${idx + 1}]: "${hist.titulo}"`);
      if (hist.descripcion) snippetLines.push(`Contexto: ${hist.descripcion}`);
      const resumen = hist.contenidoTexto.length > 1200
        ? hist.contenidoTexto.slice(0, 1200) + '... [extracto histórico]'
        : hist.contenidoTexto;
      snippetLines.push(`Antecedentes:\n${resumen}\n`);
    });
  }

  snippetLines.push('----------------------------------------------------------------');

  return {
    tecnica: selectedTecnica,
    historica: selectedHistorica,
    promptSnippet: snippetLines.join('\n'),
  };
}
