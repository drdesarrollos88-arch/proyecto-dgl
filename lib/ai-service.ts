import { GoogleGenAI } from '@google/genai';
import { getTarifario, getReglasAprendidas } from './db';
import { buscarCasosHistoricosSimilares } from './rag-service';
import { buscarBibliografiaRelevante } from './bibliografia-db';
import { TarifarioItem } from './types';

export interface AiAnalisisInput {
  texto?: string;
  fileBuffer?: Buffer;
  fileMimeType?: string;
  fileName?: string;
  apiKey?: string;
}

export interface AiEnsayoSugerido {
  sku: string;
  codigo: string;
  designacion: string;
  norma: string;
  centro_costo: string;
  unidad: string;
  precio_uf: number;
  cantidad_estimada: number;
  justificacion_tecnica: string;
  seleccionado?: boolean;
}

export interface AiEnsayoNoDisponible {
  ensayo_solicitado: string;
  motivo: string;
}

export interface AiDatosProyecto {
  nombre_obra: string | null;
  empresa_cliente: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  ciudad_sede: 'Santiago' | 'Concepción' | 'Terreno / Regiones' | null;
  centro_costo_sugerido: string | null;
}

export interface AiAnalisisResponse {
  modo: 'gemini' | 'heuristico';
  datos_proyecto_detectados: AiDatosProyecto;
  resumen_tecnico_proyecto: string;
  normativa_aplicable: string[];
  ensayos_sugeridos: AiEnsayoSugerido[];
  ensayos_no_disponibles_o_especiales: AiEnsayoNoDisponible[];
  preguntas_para_el_cliente: string[];
  borrador_correo_aclaratorio: string;
  observaciones_comerciales: string;
  total_estimado_uf: number;
  advertencia_confidencialidad: string;
}

const CONFIDENTIALITY_NOTICE =
  'Confidencialidad Garantizada: Este procesamiento opera bajo la política empresarial Zero Data Training de Google Cloud / IDIEM. Ningún dato ni documento es retenido ni utilizado para entrenamiento de modelos públicos.';

// Format the official DGL laboratory catalog for Gemini context
function formatCatalogForPrompt(tarifario: TarifarioItem[]): string {
  return tarifario
    .map(
      (item) =>
        `- SKU: "${item.sku}" | Cod: "${item.code}" | CC: "${item.cc}" | Nombre: "${item.designation.replace(/\r?\n/g, ' ')}" | Norma: "${item.norm ? item.norm.replace(/\r?\n/g, ' ') : 'N/A'}" | UF: ${item.ufPrice} | Unidad: "${item.unit}"`
    )
    .join('\n');
}

const SYSTEM_PROMPT = `
ROL Y OBJETIVO:
Eres el Asistente Técnico-Comercial de Inteligencia Artificial de la División Geotecnia y Laboratorio (DGL) de IDIEM - Universidad de Chile.
Tu objetivo es analizar solicitudes de cotización de proyectos (correos de clientes, memorias técnicas, términos de referencia o especificaciones de mecánica de suelos) y transformarlas de manera rigurosa en una propuesta de cotización estructurada, seleccionando EXCLUSIVAMENTE ensayos del Catálogo Oficial DGL IDIEM que se te proporciona.

REGLAS CRÍTICAS DE OPERACIÓN (CERO ALUCINACIONES):
1. CATÁLOGO CERRADO Y OBLIGATORIO:
   Solo puedes sugerir ensayos que figuren con su "SKU" exacto en el Catálogo Oficial DGL IDIEM adjunto. Si el cliente solicita un ensayo o servicio que no está en el catálogo (ej. sondajes diamantinos no tabulados, geofísica especializada no acreditada, o pruebas especiales), NO inventes códigos ni SKUs: agrégalo obligatoriamente en la sección "ensayos_no_disponibles_o_especiales".
2. CRITERIO GEOTÉCNICO Y NORMATIVO CHILENO:
   - Aplica criterios de mecánica de suelos y geotecnia según la tipología del proyecto (ej. edificación habitacional, obras viales MOP, minería, taludes, fundaciones con subterráneo).
   - Relaciona los ensayos con la normativa técnica aplicable en Chile: NCh1508 (Geotecnia y Mecánica de Suelos), NCh433 (Diseño Sísmico), NCh1517/NCh1532/NCh1534 (Suelos), ASTM y Manual de Carreteras Volumen 8 (MOP).
   - Asigna cantidades estimadas justificadas técnicamente si el cliente no especificó el número exacto de muestras.
3. REGLA OBLIGATORIA: REVISIÓN EXHAUSTIVA DE TODAS LAS PÁGINAS Y SECCIONES (CERO OMISIONES):
   - Debes examinar minuciosamente el documento COMPLETO, de la primera a la última página (página 1, 2, 3, 4, 5, 6... y todos sus anexos o tablas).
   - En ingeniería geotécnica, obras viales y edificación, las primeras páginas suelen ser solo antecedentes o memoria descriptiva, y los ensayos específicos y cantidades SIEMPRE se detallan en páginas intermedias o finales (ej. "Programa de Ensayos", "Especificaciones Técnicas Especiales", "Batería de Laboratorio", "Cuadros de Muestreo", "Pozos y Calicatas").
   - NUNCA te detengas en la primera página o resumen ejecutivo. Extrae CADA UNO de los ensayos requeridos a lo largo de TODO el documento.
   - Si se solicitan 10, 15, 20 o más ensayos en distintas páginas (ej. granulometría en pág. 2, corte directo en pág. 4, compresión en roca en pág. 5), DEBES INCLUIRLOS TODOS en "ensayos_sugeridos".
   - Si el usuario indica páginas o secciones específicas (ej. "revisa la página 4 y 5"), enfócate especialmente en extraer los ensayos de dichas páginas sin omitir los del resto del documento.
4. IDENTIFICACIÓN COMERCIAL Y CENTRO DE COSTO:
   - Identifica el Centro de Costo (CC) predominante de la solicitud:
     * "1817 - Ensayos Básicos" (Granulometrías, USCS, Proctor, Humedades, Densidades)
     * "2339 - Ensayos Rocas" (Tracción indirecta, Compresión uniaxial, Cargas puntuales)
     * "2340 - Ensayos Especiales" (Triaxiales UU/CU/CD, Consolidaciones, Corte Directo)
     * "2341 - Ensayos Grandes Partículas"
     * "2344 - Ensayos Antofagasta"
     * "3340 - Ensayos de terreno" (Placa de carga, Densidad In Situ cono de arena, SPT)
   - Extrae del texto los datos de contacto y proyecto si están presentes (empresa, nombre del contacto, correo, teléfono, ubicación/comuna).
5. AMBIGÜEDAD Y REDACCIÓN DE CONSULTAS AL CLIENTE:
   - Si la solicitud es ambigua o le faltan definiciones técnicas clave (ej. no indica profundidad de muestras, no define número de calicatas o sondajes según NCh1508, o no especifica si el triaxial debe ser UU, CU o CD), redacta una lista concisa de "preguntas_para_el_cliente".
   - Genera además un "borrador_correo_aclaratorio" formal, redactado con el estándar y prestigio institucional de IDIEM - Universidad de Chile, listo para que el asesor comercial lo copie y envíe al cliente.
6. FORMATO DE SALIDA ESTRICTO:
   Tu respuesta debe ser ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido, sin bloques de texto conversacional antes ni después, cumpliendo exactamente el esquema definido.

ESQUEMA JSON OBLIGATORIO:
{
  "datos_proyecto_detectados": {
    "nombre_obra": string | null,
    "empresa_cliente": string | null,
    "contacto_nombre": string | null,
    "contacto_email": string | null,
    "contacto_telefono": string | null,
    "ciudad_sede": "Santiago" | "Concepción" | "Terreno / Regiones" | null,
    "centro_costo_sugerido": "1817 - Ensayos Básicos" | "2339 - Ensayos Rocas" | "2340 - Ensayos Especiales" | "2341 - Ensayos Grandes Partículas" | "2344 - Ensayos Antofagasta" | "3340 - Ensayos de terreno"
  },
  "resumen_tecnico_proyecto": string,
  "normativa_aplicable": string[],
  "ensayos_sugeridos": [
    {
      "sku": string,
      "codigo": string,
      "designacion": string,
      "norma": string,
      "centro_costo": string,
      "unidad": string,
      "precio_uf": number,
      "cantidad_estimada": number,
      "justificacion_tecnica": string
    }
  ],
  "ensayos_no_disponibles_o_especiales": [
    {
      "ensayo_solicitado": string,
      "motivo": string
    }
  ],
  "preguntas_para_el_cliente": string[],
  "borrador_correo_aclaratorio": string,
  "observaciones_comerciales": string
}
`;

export async function analizarSolicitudConIa(input: AiAnalisisInput): Promise<AiAnalisisResponse> {
  const tarifario = getTarifario();
  const apiKey =
    input.apiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim();

  // If we have an API Key, run with Google Gemini (Zero Data Training)
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const catalogText = formatCatalogForPrompt(tarifario);

      // 1. Recuperar Bibliografía Técnica e Histórica con Prevalencia Técnica
      const fullText = (input.texto || '') + ' ' + (input.fileName || '');
      const biblioInfo = await buscarBibliografiaRelevante(fullText, 2, 2);
      const ragInfo = buscarCasosHistoricosSimilares(fullText, undefined, 2);

      // 2. Recuperar Reglas y Sinónimos Aprendidos por el equipo (Opción B)
      const reglasActivas = getReglasAprendidas({ estado: 'activo' });
      let reglasText = '';
      if (reglasActivas.length > 0) {
        reglasText = `\nREGLAS DE EQUIVALENCIA Y TERMINOLOGÍA APRENDIDA EN IDIEM (APLICAR DIRECTAMENTE):\n` +
          reglasActivas.slice(0, 10).map((r) => {
            if (r.tipo === 'observacion_frecuente' && r.observacionSugerida) {
              return `- Si detectas "${r.terminoUsuario}" -> Agregar observación particular: "${r.observacionSugerida}"`;
            }
            return `- Si detectas "${r.terminoUsuario}" -> Asignar código de ensayo "${r.codigoEnsayo}" (${r.designacion || ''})`;
          }).join('\n');
      }

      const promptUser = `
CATÁLOGO MAESTRO DE ENSAYOS OFICIALES DGL IDIEM:
${catalogText}

${biblioInfo.promptSnippet ? `${biblioInfo.promptSnippet}\n` : ''}
${ragInfo.promptSnippet ? `${ragInfo.promptSnippet}\n` : ''}
${reglasText ? `${reglasText}\n` : ''}

SOLICITUD O DOCUMENTO DEL CLIENTE A ANALIZAR:
${input.texto ? `--- TEXTO DE LA SOLICITUD / INSTRUCCIONES DEL EJECUTIVO ---\n${input.texto}\n` : ''}
${input.fileName ? `--- ARCHIVO ADJUNTO: ${input.fileName} ---` : ''}

INSTRUCCIONES CLAVE DE INSPECCIÓN:
1. REVISIÓN EXHAUSTIVA DE TODAS LAS PÁGINAS: Examina el documento COMPLETO, página por página (incluyendo páginas 1, 2, 3, 4, 5, 6... y todos sus anexos y tablas de especificaciones o calicatas). No te limites a la primera página ni al resumen general.
2. Si el texto del usuario menciona páginas o secciones específicas (ej. "en la página 4 y 5 solicitan más"), revisa con máxima atención esas páginas y extrae todos los ensayos allí requeridos.
3. Extrae CADA UNO de los ensayos requeridos en el documento que correspondan a nuestro catálogo oficial DGL, con sus cantidades respectivas.
4. Responde ÚNICAMENTE con el objeto JSON que cumpla el esquema especificado, asegurando que todos los ensayos sugeridos tengan su SKU exacto del catálogo provisto.
`;

      const contentsParts: any[] = [];

      // If a PDF or file buffer was supplied, attach as inlineData
      if (input.fileBuffer && input.fileMimeType) {
        contentsParts.push({
          inlineData: {
            mimeType: input.fileMimeType,
            data: input.fileBuffer.toString('base64'),
          },
        });
      }

      contentsParts.push({ text: promptUser });

      // Multi-Model Failover Cascade with automatic retry
      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.5-flash'];
      let response: any = null;
      let lastError: any = null;

      for (const modelName of candidateModels) {
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: contentsParts,
                },
              ],
              config: {
                systemInstruction: SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                temperature: 0.1, // High deterministic precision for technical compliance
              },
            });
            if (response && response.text) break;
          } catch (modelErr: any) {
            lastError = modelErr;
            const errMsg = String(modelErr?.message || '');
            // If 503 (high demand) or 429 (rate limit), wait briefly before retrying or switching models
            if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429')) {
              await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
            } else {
              break;
            }
          }
        }
        if (response && response.text) break;
      }

      if (!response || !response.text) {
        throw lastError || new Error('No se pudo obtener respuesta de los modelos de IA.');
      }

      const responseText = response.text || '';
      let parsed: any;
      try {
        parsed = JSON.parse(responseText);
      } catch (jsonErr) {
        // Fallback cleanup if markdown formatting was included
        const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }

      // Strict Anti-hallucination post-processor
      return postProcessGeminiResponse(parsed, tarifario);
    } catch (err: any) {
      console.error('Error invocando Gemini API, recurriendo a análisis heurístico:', err);
      // If error (e.g. invalid key or network), fall back gracefully to heuristic engine
      return ejecutarAnalisisHeuristico(input, tarifario, err.message);
    }
  }

  // Fallback: Heuristic Engine (no API key configured yet)
  return ejecutarAnalisisHeuristico(input, tarifario);
}

// Anti-hallucination verification against data/db.json
function postProcessGeminiResponse(parsed: any, tarifario: TarifarioItem[]): AiAnalisisResponse {
  const validatedEnsayos: AiEnsayoSugerido[] = [];
  const ensayosNoDisponibles: AiEnsayoNoDisponible[] = Array.isArray(
    parsed.ensayos_no_disponibles_o_especiales
  )
    ? [...parsed.ensayos_no_disponibles_o_especiales]
    : [];

  const rawEnsayos = Array.isArray(parsed.ensayos_sugeridos) ? parsed.ensayos_sugeridos : [];

  for (const item of rawEnsayos) {
    // Look up by SKU first, then by code and designation
    let realItem = tarifario.find(
      (t) => item.sku && String(t.sku).trim() === String(item.sku).trim()
    );

    if (!realItem && item.codigo) {
      realItem = tarifario.find(
        (t) =>
          String(t.code).trim() === String(item.codigo).trim() &&
          item.centro_costo &&
          t.cc.toLowerCase().includes(item.centro_costo.slice(0, 4).toLowerCase())
      );
    }

    if (!realItem && item.designacion) {
      const searchTerms = item.designacion.toLowerCase().split(' ').filter((w: string) => w.length > 3);
      realItem = tarifario.find((t) =>
        searchTerms.every((term: string) => t.designation.toLowerCase().includes(term))
      );
    }

    if (realItem) {
      validatedEnsayos.push({
        sku: realItem.sku && realItem.sku.trim() ? realItem.sku : (realItem.code ? `COD-${realItem.code}` : realItem.id),
        codigo: realItem.code,
        designacion: realItem.designation,
        norma: realItem.norm || item.norma || 'Norma Oficial IDIEM',
        centro_costo: realItem.cc,
        unidad: realItem.unit || 'c/u',
        precio_uf: realItem.ufPrice,
        cantidad_estimada: Math.max(1, Number(item.cantidad_estimada) || 1),
        justificacion_tecnica:
          item.justificacion_tecnica || 'Ensayo pertinente según tipología de obra detectada.',
        seleccionado: true,
      });
    } else {
      ensayosNoDisponibles.push({
        ensayo_solicitado: item.designacion || item.nombre || item.sku || 'Ensayo no especificado',
        motivo: 'El código o ensayo sugerido no existe en el catálogo oficial DGL IDIEM.',
      });
    }
  }

  const totalEstimadoUf = validatedEnsayos.reduce(
    (acc, curr) => acc + curr.precio_uf * curr.cantidad_estimada,
    0
  );

  return {
    modo: 'gemini',
    datos_proyecto_detectados: {
      nombre_obra: parsed.datos_proyecto_detectados?.nombre_obra || null,
      empresa_cliente: parsed.datos_proyecto_detectados?.empresa_cliente || null,
      contacto_nombre: parsed.datos_proyecto_detectados?.contacto_nombre || null,
      contacto_email: parsed.datos_proyecto_detectados?.contacto_email || null,
      contacto_telefono: parsed.datos_proyecto_detectados?.contacto_telefono || null,
      ciudad_sede: parsed.datos_proyecto_detectados?.ciudad_sede || 'Santiago',
      centro_costo_sugerido:
        parsed.datos_proyecto_detectados?.centro_costo_sugerido ||
        (validatedEnsayos[0]?.centro_costo ?? '1817 - Ensayos Básicos'),
    },
    resumen_tecnico_proyecto:
      parsed.resumen_tecnico_proyecto ||
      'Solicitud técnica de mecánica de suelos y ensayos geotécnicos analizada por el Asistente DGL.',
    normativa_aplicable: Array.isArray(parsed.normativa_aplicable)
      ? parsed.normativa_aplicable
      : ['NCh 1508', 'ASTM'],
    ensayos_sugeridos: validatedEnsayos,
    ensayos_no_disponibles_o_especiales: ensayosNoDisponibles,
    preguntas_para_el_cliente: Array.isArray(parsed.preguntas_para_el_cliente)
      ? parsed.preguntas_para_el_cliente
      : [],
    borrador_correo_aclaratorio:
      parsed.borrador_correo_aclaratorio ||
      generarBorradorCorreoGenerico(
        parsed.datos_proyecto_detectados,
        parsed.preguntas_para_el_cliente
      ),
    observaciones_comerciales:
      parsed.observaciones_comerciales ||
      'Propuesta preliminar sujeta a confirmación de volúmenes de muestreo y recepción en laboratorio.',
    total_estimado_uf: Number(totalEstimadoUf.toFixed(2)),
    advertencia_confidencialidad: CONFIDENTIALITY_NOTICE,
  };
}

// Fallback: Comprehensive Multi-Domain Geotechnical Intelligence Engine across the 358 tests
function ejecutarAnalisisHeuristico(
  input: AiAnalisisInput,
  tarifario: TarifarioItem[],
  errorMessage?: string
): AiAnalisisResponse {
  const fullText = (input.texto || '') + ' ' + (input.fileName || '');
  const lower = fullText.toLowerCase();

  // 1. Technical Domain Detection
  const isRock =
    /(?:roca|canteras?|colpas?|testigos?|litol[oó]gic[ao]|mineral[oó]gic[ao]|corte transparente|esval|mar[ií]tim[ao]|compresi[oó]n simple|point load|schimazek|abrasividad|mohs|drx|frx|edx|jar slake|petrograf|rip[- ]?rap|escoller)/i.test(
      lower
    );
  const isMarine = /(?:mar[ií]tim[ao]|puertos?|costas?|escoller|rip[- ]?rap|rompeolas)/i.test(lower);
  const isPavement = /(?:paviment|caminos?|rutas?|mop|carreter|calzadas?|sub-?bases?|bases? granular|cbr)/i.test(
    lower
  );

  // 2. Project, Client & Contact extraction
  const datosProyecto: AiDatosProyecto = {
    nombre_obra: null,
    empresa_cliente: null,
    contacto_nombre: null,
    contacto_email: null,
    contacto_telefono: null,
    ciudad_sede: 'Santiago',
    centro_costo_sugerido: isRock ? '2339 - Ensayos Rocas' : '1817 - Ensayos Básicos',
  };

  // Specific Project / Quarry / Mine extraction
  if (/cantera\s+la\s+virgen/i.test(fullText)) {
    datosProyecto.nombre_obra = 'Caracterización de Roca - Cantera La Virgen (Melipilla)';
  } else if (/los\s+olivos/i.test(fullText)) {
    datosProyecto.nombre_obra = 'Edificio Los Olivos';
  } else if (/vista\s+parque/i.test(fullText)) {
    datosProyecto.nombre_obra = 'Condominio Vista Parque';
  } else if (/ruta\s+k-?60/i.test(fullText)) {
    datosProyecto.nombre_obra = 'Mejoramiento Ruta K-60';
  } else {
    const projectMatch = fullText.match(
      /(?:proyecto|obra|edificio|condominio|construcci[oó]n|estudio|cantera)\s*[:\-]?\s*["']?([A-Za-z0-9ÁÉÍÓÚáéíóúñÑ\s\-]+?)(?:["']|\n|\.|,|$)/i
    );
    if (projectMatch && projectMatch[1]?.trim().length > 3) {
      datosProyecto.nombre_obra = projectMatch[1].trim().slice(0, 60);
    }
  }

  // Client Detection
  if (/esval/i.test(fullText)) {
    datosProyecto.empresa_cliente = 'ESVAL S.A.';
  } else if (/consorcio\s+vial/i.test(fullText)) {
    datosProyecto.empresa_cliente = 'Consorcio Vial del Sur SpA';
  } else if (/minera\s+cordillera/i.test(fullText)) {
    datosProyecto.empresa_cliente = 'Minera Cordillera Ltda.';
  } else if (/constructora\s+andes/i.test(fullText)) {
    datosProyecto.empresa_cliente = 'Constructora Andes S.A.';
  } else {
    const clientMatch = fullText.match(
      /(?:licitaci[oó]n con|cliente|empresa|raz[oó]n social|constructora|inmobiliaria)\s*[:\-]?\s*([A-Za-z0-9ÁÉÍÓÚáéíóúñÑ\s.\-]+?)(?=\n|\.|,|$)/i
    );
    if (clientMatch && clientMatch[1]?.trim().length > 2) {
      datosProyecto.empresa_cliente = clientMatch[1].trim().slice(0, 50);
    }
  }

  // Contact Name Detection
  const contactNameMatch = fullText.match(/(?:estimad[oa]|atenci[oó]n|atte\.?|contacto)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúñÑ]+)/i);
  if (contactNameMatch && contactNameMatch[1]?.trim().length > 2) {
    datosProyecto.contacto_nombre = contactNameMatch[1].trim();
  }

  // Email detection
  const emailMatch = fullText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    datosProyecto.contacto_email = emailMatch[0];
  }

  // Phone detection
  const phoneMatch = fullText.match(/(?:\+?56\s?9|\+?56\s?2|\b9)\s?\d{4}\s?\d{4}/);
  if (phoneMatch) {
    datosProyecto.contacto_telefono = phoneMatch[0];
  }

  // City detection
  if (/concepci[oó]n|biob[ií]o/i.test(lower)) {
    datosProyecto.ciudad_sede = 'Concepción';
  } else if (/antofagasta|calama|tarapac[aá]|iquique|copiap[oó]/i.test(lower)) {
    datosProyecto.ciudad_sede = 'Terreno / Regiones';
    if (!isRock) datosProyecto.centro_costo_sugerido = '2344 - Ensayos Antofagasta';
  } else if (/melipilla|santiago|providencia|las condes|rm|metropolitana/i.test(lower)) {
    datosProyecto.ciudad_sede = 'Santiago';
  }

  // 3. Multi-Domain Assay Matching Rules
  const suggestedEnsayos: AiEnsayoSugerido[] = [];
  const addedCodes = new Set<string>();

  function matchByCode(code: string, qty: number, justification: string) {
    if (addedCodes.has(code)) return;
    const item = tarifario.find((t) => String(t.code).trim() === String(code).trim());
    if (item) {
      addedCodes.add(code);
      suggestedEnsayos.push({
        sku: item.sku && item.sku.trim() ? item.sku : `COD-${item.code}`,
        codigo: item.code,
        designacion: item.designation.replace(/\r?\n/g, ' '),
        norma: item.norm || 'Norma Oficial IDIEM',
        centro_costo: item.cc,
        unidad: item.unit || 'c/u',
        precio_uf: item.ufPrice,
        cantidad_estimada: qty,
        justificacion_tecnica: justification,
        seleccionado: true,
      });
    }
  }

  // 0. Aplicar Reglas Aprendidas activas en IDIEM (Opción B)
  const reglasActivas = getReglasAprendidas({ estado: 'activo' });
  for (const r of reglasActivas) {
    if (r.codigoEnsayo && lower.includes(r.terminoUsuario.toLowerCase())) {
      matchByCode(
        r.codigoEnsayo,
        1,
        `Ensayo asignado automáticamente según regla aprendida institucional: "${r.terminoUsuario}".`
      );
    }
  }

  // ================= DOMAIN: ROCAS Y CANTERAS =================
  if (isRock) {
    // 1. Análisis Mineralógico Macroscópico (CODE 190)
    if (/macro|mineral[oó]g.*macro|litol[oó]g|descripci[oó]n micro y macro/i.test(lower)) {
      matchByCode('190', 1, 'Análisis mineralógico macroscópico y clasificación litológica de la roca para evaluar su aptitud en obra marítima.');
    }

    // 2. Análisis Mineralógico Microscópico (CODE 191)
    if (/micro|mineral[oó]g.*micro|petrograf|descripci[oó]n micro/i.test(lower)) {
      matchByCode('191', 1, 'Análisis mineralógico microscópico para evaluación de minerales secundarios, microfisuras y grado de alteración.');
    }

    // 3. Preparación de Corte Transparente (CODE 189)
    if (/corte transparente|secci[oó]n transparente|l[aá]mina delgada|pulido|micro/i.test(lower)) {
      matchByCode('189', 1, 'Preparación de corte transparente o pulido en roca para la observación petrográfica al microscopio.');
    }

    // 4. Extracción de testigos de roca / colpas (CODE 187)
    if (/testigo|colpa|extracci[oó]n/i.test(lower)) {
      matchByCode('187', 5, 'Extracción de testigos cilíndricos de roca desde colpas de 5-6 ton para ensayos mecánicos.');
    }

    // 5. Ensaye Compresión Simple en Roca (CODE 210)
    if (/compresi[oó]n|60\s*mpa|resistencia.*compresi|uniaxial/i.test(lower)) {
      matchByCode('210', 5, 'Ensaye de compresión simple en probetas de roca (ASTM D7012) para validar requisito >60 MPa.');
    }

    // 6. Desgaste Los Ángeles con preparación (CODE 206 y CODE 229)
    if (/angeles|[aá]ngeles|desgaste/i.test(lower)) {
      matchByCode('206', 1, 'Preparación de muestra grado 1 para desgaste de los Ángeles en roca.');
      matchByCode('229', 1, 'Resistencia al desgaste por el método de Los Ángeles (ASTM C535 / NCh 1369) para validar requisito <25%.');
    }

    // 7. Propiedades físicas en roca (Humedad, Porosidad, Absorción, Densidad) (CODE 184)
    if (/propiedades f[ií]sicas|densidad aparente|porosidad|absorci[oó]n|ton\/m3/i.test(lower)) {
      matchByCode('184', 3, 'Determinación de propiedades físicas: densidad aparente (>2.65 t/m3), porosidad (<6%) y absorción (<2%).');
    }

    // 8. Carga Puntual / Point Load (CODE 212)
    if (/point load|carga puntual/i.test(lower)) {
      matchByCode('212', 10, 'Ensaye de carga puntual (Point Load Test) para índice de resistencia en colpas o testigos.');
    }

    // 9. Durabilidad / Jar Slake (CODE 203)
    if (/jar slake|durabilidad|erosionabilidad/i.test(lower)) {
      matchByCode('203', 1, 'Ensayo de durabilidad y erosionabilidad Jar Slake en roca.');
    }

    // 10. Azul de Metileno en Rocas (CODE 359)
    if (/azul de metileno/i.test(lower)) {
      matchByCode('359', 1, 'Ensayo de Azul de Metileno en rocas para cuantificar arcillas deletéreas activas.');
    }
  }

  // ================= DOMAIN: SUELOS BÁSICOS & COMPACTACIÓN =================
  if (!isRock || lower.includes('suelo') || lower.includes('proctor') || lower.includes('uscs')) {
    // Clasificación USCS (CODE 1)
    if (/uscs|clasificaci[oó]n.*suelo/i.test(lower)) {
      matchByCode('1', 2, 'Clasificación de suelos según USCS (ASTM D2487) incluyendo granulometría, Atterberg y peso específico.');
    }

    // Granulometría (CODE 2)
    if (/granulometr/i.test(lower) && !addedCodes.has('1')) {
      matchByCode('2', 2, 'Distribución granulométrica de partículas según ASTM D422 / NCh 1517.');
    }

    // Límites de Atterberg (CODE 3)
    if (/l[ií]mite|atterberg|plasticidad/i.test(lower) && !addedCodes.has('1')) {
      matchByCode('3', 2, 'Límites de consistencia de Atterberg para plasticidad (ASTM D4318 / NCh 1517).');
    }

    // Proctor Modificado (CODE 13)
    if (/proctor/i.test(lower)) {
      matchByCode('13', 1, 'Determinación de la curva de compactación y humedad óptima según Proctor Modificado (ASTM D1557).');
    }

    // Densidad In Situ (CODE 29)
    if (/densidad in situ|cono de arena/i.test(lower)) {
      matchByCode('29', 3, 'Control de compactación en terreno mediante método del cono de arena (NCh 1516 / ASTM D1556).');
    }

    // Densidad Relativa (CODE 15)
    if (/densidad relativa|densidad m[aá]xima y m[ií]nima/i.test(lower)) {
      matchByCode('15', 1, 'Determinación de densidad máxima y mínima para suelos granulares (ASTM D4253 / D4254).');
    }

    // CBR (CODE 18)
    if (/cbr|raz[oó]n de soporte/i.test(lower)) {
      matchByCode('18', 1, 'Ensayo de Razón de Soporte California (CBR) para diseño de pavimentos y fundaciones (ASTM D1883).');
    }

    // Placa de Carga (CODE 32)
    if (/placa de carga/i.test(lower)) {
      matchByCode('32', 1, 'Ensayo de placa de carga estática para determinación de módulo de reacción de la subrasante (ASTM D1196).');
    }

    // Sales Solubles, Cloruros y Sulfatos (CODE 253)
    if (/cloruro|sulfato|sales solubles|agresividad qu[ií]mica/i.test(lower)) {
      matchByCode('253', 1, 'Determinación de agresividad química al hormigón (sales solubles, cloruros y sulfatos).');
    }

    // Humedad (CODE 4)
    if (/humedad|contenido de agua/i.test(lower) && !addedCodes.has('1') && !addedCodes.has('184')) {
      matchByCode('4', 2, 'Determinación del contenido de humedad natural del suelo según ASTM D2216.');
    }
  }

  // ================= DOMAIN: SUELOS ESPECIALES =================
  // Corte Directo (CODE 68)
  if (/corte directo/i.test(lower)) {
    matchByCode('68', 3, 'Ensayo de corte directo consolidado drenado (ASTM D3080) para parámetros de cohesión y fricción.');
  }

  // Consolidación Edométrica (CODE 82)
  if (/consolidaci[oó]n|edom[eé]tric/i.test(lower)) {
    matchByCode('82', 1, 'Ensayo de consolidación unidimensional edométrica (ASTM D2435) para cálculo de asentamientos.');
  }

  // Triaxiales (CODE 104 CIU, 99 UU, 115 CID)
  if (/triaxial/i.test(lower) && !isRock) {
    if (/uu/i.test(lower)) {
      matchByCode('99', 3, 'Ensayo triaxial no consolidado no drenado UU (ASTM D2850).');
    } else if (/cid|cd/i.test(lower)) {
      matchByCode('115', 3, 'Ensayo triaxial consolidado drenado CID (ASTM D7181).');
    } else {
      matchByCode('104', 3, 'Ensayo triaxial consolidado no drenado CIU con medición de presión de poros (ASTM D4767).');
    }
  }

  // Fallback if no specific match found: standard soil classification
  if (suggestedEnsayos.length === 0) {
    if (isRock) {
      matchByCode('190', 1, 'Análisis Mineralógico Macroscópico de roca.');
      matchByCode('210', 3, 'Compresión simple en roca.');
      matchByCode('184', 1, 'Propiedades físicas de roca.');
    } else {
      matchByCode('1', 2, 'Clasificación USCS completa base según NCh 1508.');
      matchByCode('13', 1, 'Proctor Modificado.');
      matchByCode('29', 3, 'Densidad In Situ.');
    }
  }

  // Infer primary Centro de Costo
  if (suggestedEnsayos.some((e) => e.centro_costo.includes('2339'))) {
    datosProyecto.centro_costo_sugerido = '2339 - Ensayos Rocas';
  } else if (suggestedEnsayos.some((e) => e.centro_costo.includes('2340'))) {
    datosProyecto.centro_costo_sugerido = '2340 - Ensayos Especiales';
  } else if (suggestedEnsayos.some((e) => e.centro_costo.includes('2341'))) {
    datosProyecto.centro_costo_sugerido = '2341 - Ensayos Grandes Partículas';
  } else if (suggestedEnsayos.some((e) => e.centro_costo.includes('3340'))) {
    datosProyecto.centro_costo_sugerido = '3340 - Ensayos de terreno';
  } else {
    datosProyecto.centro_costo_sugerido = '1817 - Ensayos Básicos';
  }

  // 4. Non-available / Special field services detection
  const ensayosNoDisponibles: AiEnsayoNoDisponible[] = [];

  if (/5\s*a\s*6\s*ton|toma de muestra|cantera|flete|transporte/i.test(lower)) {
    ensayosNoDisponibles.push({
      ensayo_solicitado: 'Toma de muestra y extracción de 5 a 6 toneladas de roca en Cantera',
      motivo:
        'Servicio logístico de terreno especial no tabulado en tarifario de laboratorio. Requiere cubicación de camión tolva, retroexcavadora y personal de terreno.',
    });
  }

  if (/sondaje.*diamantin|perforaci[oó]n diamantina/i.test(lower)) {
    ensayosNoDisponibles.push({
      ensayo_solicitado: 'Sondajes con recuperación de testigos diamantinos',
      motivo: 'Perforación profunda de sondajes requiere coordinación con la unidad de perforación y maquinaria de terreno.',
    });
  }

  // 5. Technical Questions for Client (Resolving Ambiguity)
  const preguntas: string[] = [];

  if (isRock) {
    preguntas.push(
      '¿El mandante requiere que IDIEM realice el transporte de las 5 a 6 toneladas de colpas desde la cantera al laboratorio, o serán despachadas por el cliente?'
    );
    preguntas.push(
      '¿Para condiciones de servicio marítimo, el mandante exige además ensayo de Durabilidad al Sulfato de Sodio (NCh 1328) o ensayo de Azul de Metileno (ASTM C837)?'
    );
    preguntas.push(
      '¿Desean medir módulo de deformación axial (módulo estático de Young y coeficiente de Poisson) durante los ensayos de compresión simple en roca?'
    );
    preguntas.push(
      '¿Cuántas probetas representativas requiere el mandante ensayar a compresión simple (habitualmente 5 probetas para representatividad estadística según ASTM D7012)?'
    );
  } else {
    if (!lower.includes('calicata') && !lower.includes('sondaje')) {
      preguntas.push('¿Cuál es la cantidad de calicatas o puntos de exploración previstos en el terreno según NCh 1508?');
    }
    if (!lower.includes('profundidad') && !lower.includes('cota')) {
      preguntas.push('¿A qué profundidad estimada se ubica el estrato de apoyo de fundaciones o nivel freático?');
    }
    if (lower.includes('triaxial') && !lower.includes('uu') && !lower.includes('cu') && !lower.includes('cd')) {
      preguntas.push('Para los ensayos triaxiales, ¿requiere condición no consolidada no drenada (UU), consolidada no drenada (CU) o consolidada drenada (CD)?');
    }
  }

  const totalEstimadoUf = suggestedEnsayos.reduce(
    (acc, curr) => acc + curr.precio_uf * curr.cantidad_estimada,
    0
  );

  return {
    modo: 'heuristico',
    datos_proyecto_detectados: datosProyecto,
    resumen_tecnico_proyecto: isRock
      ? 'Caracterización petrográfica, mecánica y de durabilidad en roca para evaluar su aptitud en ambiente marítimo / cantera.'
      : 'Solicitud técnica de mecánica de suelos y ensayos geotécnicos analizada por el Asistente DGL.',
    normativa_aplicable: isRock
      ? ['ASTM D7012', 'ASTM C535', 'ASTM D3967', 'NCh 1369', 'Manual de Carreteras MOP']
      : ['NCh 1508', 'NCh 433', 'ASTM D2487', 'ASTM D1557'],
    ensayos_sugeridos: suggestedEnsayos,
    ensayos_no_disponibles_o_especiales: ensayosNoDisponibles,
    preguntas_para_el_cliente: preguntas,
    borrador_correo_aclaratorio: generarBorradorCorreoGenerico(datosProyecto, preguntas),
    observaciones_comerciales: errorMessage
      ? (errorMessage.includes('503') || errorMessage.includes('high demand')
          ? 'Nota técnica: Servidores de Google en alta demanda temporal. Se ejecutó el análisis técnico con el motor experto DGL.'
          : 'Nota técnica: Se ejecutó el análisis técnico con el motor experto DGL.')
      : isRock
      ? 'Atención: La toma de muestra y transporte de 5 a 6 toneladas en cantera requiere cotización de logística/maquinaria pesada externa.'
      : 'Propuesta generada según criterios de la norma chilena NCh 1508.',
    total_estimado_uf: Number(totalEstimadoUf.toFixed(2)),
    advertencia_confidencialidad: CONFIDENTIALITY_NOTICE,
  };
}

function generarBorradorCorreoGenerico(
  datos: AiDatosProyecto,
  preguntas: string[]
): string {
  const saludo = datos.contacto_nombre
    ? `Estimado(a) ${datos.contacto_nombre}:`
    : 'Estimado(a) Cliente:';

  const ref = datos.nombre_obra
    ? `Presupuesto Ensayos de Geotecnia - Proyecto ${datos.nombre_obra}`
    : 'Presupuesto Ensayos de Laboratorio Geotécnico';

  const listaPreguntas =
    preguntas.length > 0
      ? preguntas.map((p, i) => `   ${i + 1}. ${p}`).join('\n')
      : '   1. Confirmar el número definitivo de muestras o calicatas a ensayar.\n   2. Indicar si requieren plazos de entrega expeditos o estándar.';

  return `De: IDIEM - División Geotecnia y Laboratorio (DGL)
Para: ${datos.contacto_email || '[correo del cliente]'}
Asunto: IDIEM DGL | ${ref}

${saludo}

Junto con saludar cordialmente desde IDIEM (Universidad de Chile), acusamos recibo de su solicitud de cotización para el proyecto de referencia.

Con el objetivo de emitir una propuesta técnico-económica precisa y ajustada estrictamente a la normativa chilena vigente (NCh 1508 / ASTM), le agradeceríamos clarificar los siguientes puntos técnicos:

${listaPreguntas}

Quedamos a su entera disposición para coordinar la recepción de muestras en nuestras sedes o resolver cualquier inquietud geotécnica.

Atentamente,

Área Técnico-Comercial
División Geotecnia y Laboratorio (DGL)
IDIEM - Universidad de Chile
Plaza Ercilla 883, Santiago, Chile | www.idiem.cl`;
}

export interface AiBusquedaEnsayoSugerencia {
  code: string;
  explicacion: string;
}

/**
 * Semantic AI search assistant for tests using Gemini.
 * Resolves geotechnical synonyms, dimension equivalences (e.g. 15x30 -> 15,0 x 30,0 cm),
 * and engineering project criteria.
 */
export async function buscarEnsayosConIA(
  query: string,
  customApiKey?: string
): Promise<AiBusquedaEnsayoSugerencia[]> {
  const qClean = query.trim();
  if (!qClean) return [];

  const tarifario = getTarifario();
  const apiKey =
    customApiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim();

  if (!apiKey) {
    return [];
  }

  const catalogText = tarifario
    .map(
      (item) =>
        `Cod: "${item.code}" | SKU: "${item.sku || ''}" | Nombre: "${item.designation.replace(/\r?\n/g, ' ')}" | Norma: "${item.norm ? item.norm.replace(/\r?\n/g, ' ') : 'N/A'}" | UF: ${item.ufPrice}`
    )
    .join('\n');

  const prompt = `CATÁLOGO OFICIAL DE ENSAYOS DGL IDIEM (358 ensayos):
${catalogText}

CONSULTA DEL USUARIO EN EL BUSCADOR: "${qClean}"

Tu objetivo es actuar como motor semántico para el buscador del cotizador de IDIEM DGL.
Encuentra los ensayos del catálogo oficial que corresponden conceptualmente, técnicamente o por equivalencia a la consulta del usuario.
Reglas clave:
1. Resuelve equivalencias de dimensiones (ej. "15x30" = "15,0 x 30,0 cm", "5x10" = "5,0 x 10,0 cm", "30x30" = "30,0 x 30,0 cm", "100x180" = "100 x 180 cm").
2. Reconoce abreviaturas y metodologías geotécnicas (ej. CIU, CID, UU, consolidado, proctor, cono arena, corte directo, compresión simple en roca, USCS, Atterberg, CBR, etc.).
3. Devuelve ÚNICAMENTE un array JSON válido sin texto adicional antes ni después:
[
  {
    "code": "106",
    "explicacion": "Triaxial CIU convencional probeta 15,0 x 30,0 cm"
  }
]
Máximo 8 resultados ordenados del más relevante al menos relevante.`;

  const qLower = qClean.toLowerCase();
  const reglasActivas = getReglasAprendidas({ estado: 'activo' });
  const sugerenciasDirectas: AiBusquedaEnsayoSugerencia[] = [];

  for (const r of reglasActivas) {
    if (r.codigoEnsayo && (qLower.includes(r.terminoUsuario.toLowerCase()) || r.terminoUsuario.toLowerCase().includes(qLower))) {
      sugerenciasDirectas.push({
        code: r.codigoEnsayo,
        explicacion: `🧠 Regla aprendida por uso en IDIEM: "${r.terminoUsuario}" (${r.conteoConfirmaciones} confirmaciones)`,
      });
    }
  }

  const fallbackModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
  const ai = new GoogleGenAI({ apiKey });

  for (const modelName of fallbackModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.1,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed)) {
        const geminiResults = parsed.filter((p: any) => p && typeof p.code === 'string');
        const combined = [...sugerenciasDirectas];
        for (const gr of geminiResults) {
          if (!combined.some((c) => c.code === gr.code)) {
            combined.push(gr);
          }
        }
        return combined.slice(0, 8);
      }
    } catch (err: any) {
      console.warn(`buscarEnsayosConIA fallback from ${modelName}:`, err?.message || err);
    }
  }

  return sugerenciasDirectas;
}

// ==================== ASISTENTE IA TÉCNICO-COMERCIAL DGL (CHAT INTERACTIVO) ====================

export interface AiChatAction {
  tipo:
    | 'AGREGAR'
    | 'MODIFICAR_CANTIDAD'
    | 'ELIMINAR'
    | 'APLICAR_FACTOR'
    | 'APLICAR_FACTOR_GLOBAL'
    | 'LIMPIAR_TODO';
  codigo?: string;
  cantidad?: number;
  factor?: number;
  descripcion?: string;
}

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  mensaje: string;
  acciones: AiChatAction[];
  itemsAgregadosCompletos?: TarifarioItem[];
}

/**
 * Procesa instrucciones en lenguaje natural del ejecutivo comercial para manipular
 * o consultar la cotización interactiva mediante IA (Gemini).
 */
export async function chatAsistenteTecnicoComercial(params: {
  mensaje: string;
  historial?: AiChatMessage[];
  itemsActuales?: Array<{
    code: string;
    designation: string;
    quantity: number;
    factor: number;
    ufPrice: number;
  }>;
  contexto?: {
    clientName?: string;
    projectName?: string;
    centroCosto?: string;
    currency?: string;
  };
  apiKey?: string;
}): Promise<AiChatResponse> {
  const tarifario = getTarifario();
  const apiKey =
    params.apiKey?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GOOGLE_GENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      mensaje:
        'La clave de API de Gemini no está configurada. Por favor configure GEMINI_API_KEY en el entorno para habilitar el Asistente IA.',
      acciones: [],
    };
  }

  // Formatear catálogo oficial resumido
  const catalogText = tarifario
    .map(
      (it) =>
        `Cod: "${it.code}" | SKU: "${it.sku || ''}" | CC: "${it.cc}" | Nombre: "${it.designation.replace(/\r?\n/g, ' ')}" | Norma: "${it.norm || 'N/A'}" | UF: ${it.ufPrice}`
    )
    .join('\n');

  // Formatear los ítems actualmente en el presupuesto
  const itemsText =
    params.itemsActuales && params.itemsActuales.length > 0
      ? params.itemsActuales
          .map(
            (it, idx) =>
              `${idx + 1}. [Cód: ${it.code}] "${it.designation}" - Cantidad: ${it.quantity} | Factor: ${it.factor} | Precio: ${it.ufPrice} UF`
          )
          .join('\n')
      : 'Actualmente no hay ensayos cargados en el presupuesto.';

  // Historial de conversación reciente (últimos 6 turnos)
  const historySlice = (params.historial || []).slice(-6);
  const historyText =
    historySlice.length > 0
      ? historySlice
          .map((h) => `${h.role === 'user' ? 'Usuario' : 'Asistente'}: ${h.content}`)
          .join('\n')
      : 'No hay mensajes previos en esta sesión.';

  // 1. Recuperar Bibliografía Técnica e Histórica con Prevalencia Técnica
  const biblioInfo = await buscarBibliografiaRelevante(params.mensaje, 2, 1);
  const ragInfo = buscarCasosHistoricosSimilares(params.mensaje, params.contexto?.centroCosto, 1);

  // 2. Recuperar reglas y sinónimos aprendidos (Opción B)
  const reglasActivas = getReglasAprendidas({ estado: 'activo' });
  let reglasChatText = '';
  if (reglasActivas.length > 0) {
    reglasChatText = `REGLAS DE EQUIVALENCIA Y SINÓNIMOS APRENDIDOS EN IDIEM (APLICAR DIRECTAMENTE):\n` +
      reglasActivas.slice(0, 15).map((r) => `- Si el usuario dice "${r.terminoUsuario}" -> Usar CÓDIGO "${r.codigoEnsayo}" (${r.designacion || ''})`).join('\n');
  }

  const prompt = `ROL Y OBJETIVO:
Eres el Asistente IA Técnico-Comercial de la División Geotecnia y Laboratorio (DGL) de IDIEM - Universidad de Chile.
Tu función es colaborar activamente con el ejecutivo comercial en la elaboración y ajuste en tiempo real de su cotización.
Puedes responder consultas técnicas y geotécnicas, y fundamentalmente EJECUTAR INSTRUCCIONES para agregar ensayos, modificar cantidades, eliminar ensayos o aplicar descuentos/factores.

CONTEXTO DEL PRESUPUESTO ACTUAL:
- Cliente: ${params.contexto?.clientName || 'Sin especificar'}
- Proyecto: ${params.contexto?.projectName || 'Sin especificar'}
- Centro de Costo activo: ${params.contexto?.centroCosto || 'General'}
- Moneda: ${params.contexto?.currency || 'UF'}

${biblioInfo.promptSnippet ? `${biblioInfo.promptSnippet}\n` : ''}
${reglasChatText ? `${reglasChatText}\n` : ''}
${ragInfo.promptSnippet ? `${ragInfo.promptSnippet}\n` : ''}

ENSAYOS ACTUALMENTE EN EL PRESUPUESTO:
${itemsText}

CATÁLOGO OFICIAL DE ENSAYOS DGL IDIEM (358 ensayos disponibles):
${catalogText}

HISTORIAL DE MENSAJES RECIENTES:
${historyText}

NUEVA INSTRUCCIÓN DEL USUARIO:
"${params.mensaje}"

INSTRUCCIONES CLAVE DE RESPUESTA:
1. IDENTIFICACIÓN PRECISA DE ENSAYOS:
   - Cuando el usuario solicite agregar ensayos (ej. "Agregale 3 Clasificaciones Completas y 3 Consolidaciones de 20 cm sin permeabilidad"):
     * Busca en el catálogo oficial los ensayos que coinciden exactamente con la solicitud técnica.
     * Ejemplo: "Clasificación Completa" -> Código "001" (Clasificación de Suelos USCS) o afín.
     * Ejemplo: "Consolidación de 20 cm sin permeabilidad" -> Código "114" (Célula oedométrica 20,0 cm sin permeabilidad).
     * Ejemplo: "Corte directo 30x30" -> Código correspondiente con probeta 30,0 x 30,0 cm.
     * Ejemplo: "Triaxial 15x30" -> Código de triaxial convencional 15,0 x 30,0 cm (102, 106, 117, etc.).
     * Genera la acción "AGREGAR" con el "codigo" exacto del catálogo y la "cantidad" indicada.
2. MODIFICACIÓN DE CANTIDADES O FACTORES:
   - Si el usuario pide cambiar la cantidad de un ensayo ya presente (ej. "cambia corte directo a 7 muestras"):
     * Identifica el ensayo en la lista de ensayos actuales y genera la acción "MODIFICAR_CANTIDAD" con su "codigo" y la nueva "cantidad".
   - Si pide eliminar un ensayo (ej. "elimina los conos de arena"):
     * Genera la acción "ELIMINAR" con el "codigo".
   - Si pide descuento o recargo (ej. "aplica 10% de descuento a las rocas" o factor):
     * Genera la acción "APLICAR_FACTOR" con "factor: 0.9".
3. CONSULTAS TÉCNICAS:
   - Si el usuario hace preguntas técnicas (diferencias entre ensayos, normas NCh/ASTM, recomendaciones según tipo de suelo), responde con tu sólido conocimiento geotécnico y deja la lista de "acciones" vacía.
4. TONO:
   - Responde siempre en español, con cordialidad, profesionalismo institucional IDIEM, y explica con claridad lo que hiciste o aconsejaste.

FORMATO DE SALIDA OBLIGATORIO (JSON ESTRICTO):
{
  "mensaje": "Mensaje en español explicando detalladamente lo que se hizo o la respuesta a la consulta.",
  "acciones": [
    {
      "tipo": "AGREGAR",
      "codigo": "001",
      "cantidad": 3,
      "factor": 1.0,
      "descripcion": "Clasificación de Suelos USCS"
    }
  ]
}`;

  const fallbackModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
  const ai = new GoogleGenAI({ apiKey });

  for (const modelName of fallbackModels) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (parsed && typeof parsed.mensaje === 'string') {
        const acciones: AiChatAction[] = Array.isArray(parsed.acciones) ? parsed.acciones : [];

        // Vincular los objetos completos de tarifario para los ensayos agregados
        const itemsAgregadosCompletos: TarifarioItem[] = [];
        for (const act of acciones) {
          if (act.tipo === 'AGREGAR' && act.codigo) {
            const found = tarifario.find((t) => t.code === act.codigo);
            if (found) {
              itemsAgregadosCompletos.push(found);
            }
          }
        }

        return {
          mensaje: parsed.mensaje,
          acciones,
          itemsAgregadosCompletos,
        };
      }
    } catch (err: any) {
      console.warn(`chatAsistenteTecnicoComercial fallback desde ${modelName}:`, err?.message || err);
    }
  }

  return {
    mensaje:
      'No fue posible procesar la solicitud con el asistente en este momento. Por favor reintenta en unos instantes.',
    acciones: [],
  };
}
