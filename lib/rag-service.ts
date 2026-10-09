import { getCotizaciones } from './db';
import { getCotizacionesAsync } from './cotizaciones-db';
import { Cotizacion, CasoReferenciaRAG } from './types';

/**
 * Casos históricos base oficiales de IDIEM para asegurar funcionamiento
 * de alta precisión desde el primer día (Bootstrap RAG).
 */
const CASOS_BASE_IDIEM: CasoReferenciaRAG[] = [
  {
    id: 'rag-base-1',
    codigoCotizacion: 'PR.DGL.2339.2026.0587',
    nombreObra: 'Caracterización Geotécnica y Mecánica de Roca - Cantera La Virgen',
    empresaCliente: 'ESVAL S.A.',
    centroCosto: '2339 - Ensayos Rocas',
    ciudad: 'Santiago / Melipilla',
    dominioGeotecnico: 'rocas',
    ensayosCotizados: [
      { codigo: '190', designacion: 'Análisis mineralógico macroscópico', cantidad: 1, ufPrice: 2.1, norma: 'Procedimiento IDIEM' },
      { codigo: '191', designacion: 'Análisis mineralógico microscópico', cantidad: 1, ufPrice: 3.4, norma: 'Procedimiento IDIEM' },
      { codigo: '189', designacion: 'Preparación de corte transparente o pulido en roca', cantidad: 1, ufPrice: 1.8, norma: 'Procedimiento IDIEM' },
      { codigo: '210', designacion: 'Compresión simple probeta testigo de roca', cantidad: 5, ufPrice: 1.25, norma: 'ASTM D7012' },
      { codigo: '229', designacion: 'Resistencia al desgaste por el método de Los Ángeles', cantidad: 1, ufPrice: 4.8, norma: 'ASTM C535 / NCh 1369' },
      { codigo: '184', designacion: 'Propiedades físicas en roca (densidad, porosidad, absorción)', cantidad: 3, ufPrice: 1.1, norma: 'ISRM' },
    ],
    observacionesClave: [
      'Toma de muestra y transporte de colpas de 5 a 6 toneladas debe ser coordinado y costeado por el cliente.',
      'Ensayos mecánicos condicionados a preparación de probetas cilíndricas según relación de esbeltez 2:1.',
    ],
    totalUf: 22.45,
    fechaEmision: '2026-08-20',
  },
  {
    id: 'rag-base-2',
    codigoCotizacion: 'PR.DGL.1817.2026.1104',
    nombreObra: 'Edificio Residencial Vista Parque - Estudio de Suelos de Fundación',
    empresaCliente: 'Constructora Andes S.A.',
    centroCosto: '1817 - Ensayos Básicos',
    ciudad: 'Santiago',
    dominioGeotecnico: 'suelos_basicos',
    ensayosCotizados: [
      { codigo: '1', designacion: 'Clasificación USCS completa (Granulometría + Límites Atterberg)', cantidad: 3, ufPrice: 1.95, norma: 'ASTM D2487' },
      { codigo: '13', designacion: 'Proctor Modificado', cantidad: 2, ufPrice: 2.2, norma: 'ASTM D1557' },
      { codigo: '29', designacion: 'Densidad in situ mediante método del cono de arena', cantidad: 5, ufPrice: 0.95, norma: 'NCh 1516' },
      { codigo: '68', designacion: 'Corte directo consolidado drenado CD', cantidad: 3, ufPrice: 3.8, norma: 'ASTM D3080' },
      { codigo: '82', designacion: 'Consolidación unidimensional edométrica', cantidad: 2, ufPrice: 4.5, norma: 'ASTM D2435' },
    ],
    observacionesClave: [
      'Plazos de entrega estándar de 10 a 12 días hábiles tras recepción en laboratorio central Salomón Sack 840.',
      'Control de compactación en terreno requiere coordinación con 48 horas de anticipación.',
    ],
    totalUf: 37.9,
    fechaEmision: '2026-08-28',
  },
  {
    id: 'rag-base-3',
    codigoCotizacion: 'PR.DGL.1817.2026.0942',
    nombreObra: 'Mejoramiento Ruta K-60 - Control de Bases y Subrasantes Viales',
    empresaCliente: 'Consorcio Vial del Sur SpA',
    centroCosto: '1817 - Ensayos Básicos',
    ciudad: 'Terreno / Regiones',
    dominioGeotecnico: 'viales_terreno',
    ensayosCotizados: [
      { codigo: '1', designacion: 'Clasificación USCS completa', cantidad: 2, ufPrice: 1.95, norma: 'ASTM D2487' },
      { codigo: '13', designacion: 'Proctor Modificado', cantidad: 2, ufPrice: 2.2, norma: 'ASTM D1557' },
      { codigo: '18', designacion: 'Razón de Soporte California (CBR)', cantidad: 2, ufPrice: 3.5, norma: 'ASTM D1883' },
      { codigo: '29', designacion: 'Densidad in situ cono de arena', cantidad: 8, ufPrice: 0.95, norma: 'NCh 1516' },
      { codigo: '253', designacion: 'Agresividad química al hormigón (Sales solubles, cloruros y sulfatos)', cantidad: 2, ufPrice: 2.8, norma: 'NCh 1444' },
    ],
    observacionesClave: [
      'Valores de densidad y humedad contrastados según especificaciones del Manual de Carreteras MOP Vol. 8.',
    ],
    totalUf: 32.5,
    fechaEmision: '2026-08-15',
  },
  {
    id: 'rag-base-4',
    codigoCotizacion: 'PR.DGL.2340.2026.0319',
    nombreObra: 'Campaña Geotécnica Especial - Subterráneo Torre Titanium Sur',
    empresaCliente: 'Ingeniería Estructural & Geotecnia Ltda.',
    centroCosto: '2340 - Ensayos Especiales',
    ciudad: 'Santiago',
    dominioGeotecnico: 'especiales',
    ensayosCotizados: [
      { codigo: '104', designacion: 'Triaxial CIU consolidado no drenado con medición de presión de poros', cantidad: 3, ufPrice: 6.2, norma: 'ASTM D4767' },
      { codigo: '82', designacion: 'Consolidación unidimensional edométrica', cantidad: 3, ufPrice: 4.5, norma: 'ASTM D2435' },
      { codigo: '68', designacion: 'Corte directo consolidado drenado', cantidad: 3, ufPrice: 3.8, norma: 'ASTM D3080' },
      { codigo: '1', designacion: 'Clasificación USCS completa', cantidad: 2, ufPrice: 1.95, norma: 'ASTM D2487' },
    ],
    observacionesClave: [
      'Ensayos triaxiales con presiones de confinamiento definidas por el calculista geotécnico.',
      'Saturación previa mediante contrapresión hasta verificar parámetro B de Skempton >= 0.95.',
    ],
    totalUf: 47.4,
    fechaEmision: '2026-08-10',
  },
];

/**
 * Transforma una cotización guardada en el sistema a un objeto CasoReferenciaRAG.
 */
function cotizacionToRagCase(cot: Cotizacion): CasoReferenciaRAG | null {
  if (!cot || !cot.items || cot.items.length === 0) return null;

  const fullText = `${cot.projectName || ''} ${cot.clientName || ''} ${cot.centroCosto || ''} ${cot.items.map((i) => i.designation).join(' ')}`.toLowerCase();

  let dominio: 'rocas' | 'suelos_basicos' | 'especiales' | 'viales_terreno' = 'suelos_basicos';
  if (/(?:roca|cantera|colpa|testigo|point load|los angeles)/i.test(fullText)) {
    dominio = 'rocas';
  } else if (/(?:triaxial|consolidaci|corte directo|especial)/i.test(fullText)) {
    dominio = 'especiales';
  } else if (/(?:paviment|camin|ruta|cbr|mop|carreter)/i.test(fullText)) {
    dominio = 'viales_terreno';
  }

  const observaciones: string[] = [];
  if (cot.condicionesComerciales?.clausulasParticulares && cot.condicionesComerciales.clausulasParticulares.length > 0) {
    observaciones.push(...cot.condicionesComerciales.clausulasParticulares);
  }

  return {
    id: `rag-db-${cot.id}`,
    codigoCotizacion: cot.code || 'PR.DGL.OFICIAL',
    nombreObra: cot.projectName || 'Proyecto Geotécnico',
    empresaCliente: cot.clientName || 'Cliente Confidencial',
    centroCosto: cot.centroCosto || '1817 - Ensayos Básicos',
    ciudad: cot.city || 'Santiago',
    dominioGeotecnico: dominio,
    ensayosCotizados: cot.items.map((i) => ({
      codigo: i.code,
      designacion: i.designation,
      cantidad: i.quantity || 1,
      ufPrice: i.ufPrice || 0,
      norma: i.norm,
    })),
    observacionesClave: observaciones.length > 0 ? observaciones : undefined,
    totalUf: cot.totalUf || 0,
    fechaEmision: cot.updatedAt || cot.createdAt || new Date().toISOString(),
  };
}

function buildCasosFromCotizaciones(cotizaciones: Cotizacion[]): CasoReferenciaRAG[] {
  const dbCases: CasoReferenciaRAG[] = [];

  // Considerar EXCLUSIVAMENTE cotizaciones finalizadas (o aprobadas/enviadas formalmente).
  // Los borradores ('Borrador') quedan terminantemente excluidos de la memoria y aprendizaje RAG
  // para no contaminar el criterio de la IA con propuestas provisionales o en borrador.
  for (const c of cotizaciones) {
    const isFinalizada = c.status === 'Finalizada' || c.status === 'Aprobada' || c.status === 'Enviada';
    if (isFinalizada && c.status !== 'Borrador') {
      const ragCase = cotizacionToRagCase(c);
      if (ragCase) dbCases.push(ragCase);
    }
  }

  // Si en la base de datos hay pocos casos históricos, sumar los casos base de bootstrap
  const combined = [...dbCases];
  for (const base of CASOS_BASE_IDIEM) {
    if (!combined.some((c) => c.nombreObra === base.nombreObra)) {
      combined.push(base);
    }
  }

  return combined;
}

/**
 * Obtiene todas las cotizaciones históricas elegibles para el RAG de forma asíncrona desde Supabase.
 */
export async function getCasosHistoricosRAGAsync(): Promise<CasoReferenciaRAG[]> {
  const cotizaciones = await getCotizacionesAsync();
  return buildCasosFromCotizaciones(cotizaciones);
}

/**
 * Obtiene todas las cotizaciones históricas elegibles para el RAG desde la memoria o almacenamiento local.
 */
export function getCasosHistoricosRAG(): CasoReferenciaRAG[] {
  const cotizaciones = getCotizaciones();
  return buildCasosFromCotizaciones(cotizaciones);
}

function scoreAndFormatCasos(
  casos: CasoReferenciaRAG[],
  queryText: string,
  centroCostoSugerido?: string,
  limit: number = 2
): {
  casos: CasoReferenciaRAG[];
  promptSnippet: string;
} {
  if (casos.length === 0) {
    return { casos: [], promptSnippet: '' };
  }

  const text = (queryText || '').toLowerCase();

  // Detección de dominio de la consulta
  const isRock = /(?:roca|cantera|colpa|testigo|litol|point load|los angeles|mar[ií]tim)/i.test(text);
  const isSpecial = /(?:triaxial|consolidaci|corte directo|asentamiento|arcilla)/i.test(text);
  const isPavement = /(?:paviment|camin|ruta|cbr|sub-?base|carreter|mop)/i.test(text);

  const scored = casos.map((c) => {
    let score = 0;

    // Coincidencia de dominio
    if (isRock && c.dominioGeotecnico === 'rocas') score += 50;
    if (isSpecial && c.dominioGeotecnico === 'especiales') score += 50;
    if (isPavement && c.dominioGeotecnico === 'viales_terreno') score += 50;
    if (!isRock && !isSpecial && !isPavement && c.dominioGeotecnico === 'suelos_basicos') score += 40;

    // Coincidencia de Centro de Costo
    if (centroCostoSugerido && c.centroCosto.includes(centroCostoSugerido.slice(0, 4))) {
      score += 30;
    }

    // Coincidencia léxica por palabras clave
    const keywords = [
      'edificio', 'condominio', 'cantera', 'puente', 'ruta', 'fundacion',
      'subterraneo', 'calicata', 'sondaje', 'esval', 'melipilla', 'concepcion'
    ];
    for (const kw of keywords) {
      if (text.includes(kw) && (c.nombreObra.toLowerCase().includes(kw) || c.empresaCliente.toLowerCase().includes(kw))) {
        score += 20;
      }
    }

    return { caso: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = scored.slice(0, Math.max(1, limit)).map((s) => s.caso);

  // Formatear bloque textual estructurado para Gemini
  const snippetLines: string[] = [
    'CASOS HISTÓRICOS REALES APROBADOS POR INGENIEROS SENIOR DE IDIEM (REFERENCIA):',
  ];

  selected.forEach((c, idx) => {
    snippetLines.push(
      `\n[CASO DE REFERENCIA #${idx + 1} - ${c.codigoCotizacion}]`
    );
    snippetLines.push(`Proyecto: "${c.nombreObra}" | Cliente: "${c.empresaCliente}" | CC: ${c.centroCosto}`);
    snippetLines.push(`Batería de ensayos aprobada por IDIEM:`);
    c.ensayosCotizados.forEach((e) => {
      snippetLines.push(`  - [Cód ${e.codigo}] ${e.designacion} | Cantidad: ${e.cantidad} | Precio: ${e.ufPrice} UF (${e.norma || 'Norma IDIEM'})`);
    });
    if (c.observacionesClave && c.observacionesClave.length > 0) {
      snippetLines.push(`Observaciones particulares acordadas:`);
      c.observacionesClave.forEach((obs) => {
        snippetLines.push(`  * ${obs}`);
      });
    }
  });

  snippetLines.push('\nInstrucción: Utiliza el criterio técnico y los patrones de estos casos aprobados para guiar tu propuesta.');

  return {
    casos: selected,
    promptSnippet: snippetLines.join('\n'),
  };
}

/**
 * Motor de recuperación de casos similares de forma asíncrona (Supabase directo).
 */
export async function buscarCasosHistoricosSimilaresAsync(
  queryText: string,
  centroCostoSugerido?: string,
  limit: number = 2
): Promise<{
  casos: CasoReferenciaRAG[];
  promptSnippet: string;
}> {
  const casos = await getCasosHistoricosRAGAsync();
  return scoreAndFormatCasos(casos, queryText, centroCostoSugerido, limit);
}

/**
 * Motor de recuperación de casos similares (RAG Geotécnico sincrónico).
 */
export function buscarCasosHistoricosSimilares(
  queryText: string,
  centroCostoSugerido?: string,
  limit: number = 2
): {
  casos: CasoReferenciaRAG[];
  promptSnippet: string;
} {
  const casos = getCasosHistoricosRAG();
  return scoreAndFormatCasos(casos, queryText, centroCostoSugerido, limit);
}
