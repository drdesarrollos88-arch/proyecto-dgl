const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// 1. Cotización Lundin Mining Chile Spa
const cotizacionLundin = {
  id: 'cot-1792590288641',
  code: 'PR.DGL.2341.2026.0672',
  correlativo: 'PR.DGL.2341.2026.0672',
  year: 2026,
  date: '2026-10-20',
  client_name: 'Lundin Mining Chile Spa',
  client_rut: '76263093-1',
  contact_name: 'David Alave',
  contact_phone: '+56987480157',
  contact_email: 'david.alberto@lundinminig.com',
  project_name: 'Caserones - Ensayos Grandes Partículas',
  project_address: 'Santiago',
  centro_costo: '2341',
  seccion: 'SLGP - Sección Laboratorio Grandes Partículas',
  sector_proyecto: 'Minería',
  subsector_proyecto: 'No Aplica',
  zona_proyecto: 'Zona Norte',
  currency: 'UF',
  uf_value: 38500,
  dollar_value: 950,
  subtotal_neto: 4695.59,
  descuento_porcentaje: 0,
  descuento_monto: 0,
  total_neto: 4695.59,
  iva: 892.16,
  total: 5587.75,
  total_usd: Number(((4695.59 * 38500) / 950).toFixed(2)),
  total_clp: Math.round(4695.59 * 38500),
  status: 'Borrador',
  version: 1,
  user_id: 'usr-1',
  user_name: 'Diego Román Araneda',
  user_email: 'diego.roman@idiem.cl',
  user_initials: 'DRA',
  validity_days: 30,
  payment_terms: '50% AL CONTADO Y 50% CONTRA ENTREGA',
  created_at: '2026-10-21T13:48:27.110Z',
  updated_at: '2026-10-21T13:48:27.110Z',
  observations: [
    'Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de su recepción.',
    'La presente propuesta está generada a carácter informativo. La determinación de ensayos y sus cantidades dependerá de la estimación del cliente, a lo cual, la propuesta deberá ser ajustada a dicho detalle de ensayo.',
    '(*) Los ensayos realizados bajo normativas específicas indicadas podrían no contar con alcance de acreditación bajo LE-304 si corresponde.',
    '¿El laboratorio tiene la capacidad y recursos para realizar las actividades?: [X] SÍ [ ] NO',
    'Condiciones Particulares Acordadas para esta Propuesta:\n• Los ensayos presentados en la propuesta económica deben ser ejecutados sobre material no lixiviado.'
  ],
  ai_chat_state: {
    commercialTitle: 'Asesor Comercial DGL',
    showTotalWeightPerItem: true,
    showSummaryUnitWeight: false,
    showSummaryTotalWeight: false,
    showTableFootWeight: false,
    showObservationsWeight: false,
    totalUnitWeightKg: 6500,
    projectMeta: {
      seccion: 'SLGP - Sección Laboratorio Grandes Partículas',
      centroCosto: '2341',
      sectorProyecto: 'Minería',
      subsectorProyecto: 'No Aplica',
      zonaProyecto: 'Zona Norte',
      reference: 'Ensayos Geotécnicos'
    }
  },
  items: [
    {
      id: 'partida-1',
      itemNumber: '1.1.1',
      code: 'PART-1.1.1',
      designation: 'TRIAXIAL 100X180 CM',
      norm: '',
      minWeightKg: 0,
      unit: '',
      ufPrice: 0,
      factor: 1,
      quantity: 0,
      subtotalUf: 3516.28,
      subtotalClp: Math.round(3516.28 * 38500),
      isDivider: true,
      dividerTitle: 'TRIAXIAL 100X180 CM'
    },
    {
      id: 'item-270-1',
      itemNumber: '1.1.1.1',
      code: '270',
      designation: 'Ensayo Triaxial para grandes partículas\nTipo CIU o CID ( probeta de 100 x 180 cm, tamaño máximo 6”, confinamiento máximo 20 kg/cm2).\nNotas: \nSe considera máx. 5 días hábiles de ejecución y corte monotónico.\nSe considera material previamente preparado según ítem de preparación de muestras.\nEl peso de material x probeta informado es referencial y considera bajo 7". El material a enviar para ensayo se debe estimar según las caracteristicas propias del material.',
      norm: 'Proced. Interno',
      minWeightKg: 5000,
      unit: 'c/probeta',
      ufPrice: 457.89,
      factor: 1,
      quantity: 6,
      subtotalUf: 2747.34,
      subtotalClp: Math.round(2747.34 * 38500)
    },
    {
      id: 'item-273-1',
      itemNumber: '1.1.1.2',
      code: '273',
      designation: 'Preparación de muestra para Triaxial Gigante probeta 100 x 180 cm\nNotas\nconsidera máximo 15 toneladas de material, material estimado necesaria para tres probetas.\nPreparación de muestras homotéticas hasta malla 1 1/2", bajo este tamiz la muestra se utiliza integral, sin modificación.',
      norm: 'Proced. Interno',
      minWeightKg: 0,
      unit: 'gl.',
      ufPrice: 271.82,
      factor: 1,
      quantity: 2,
      subtotalUf: 543.64,
      subtotalClp: Math.round(543.64 * 38500)
    },
    {
      id: 'item-276-1',
      itemNumber: '1.1.1.3',
      code: '276',
      designation: 'Granulometría Post Triaxial Gigante 100 x 180 cm',
      norm: 'Proced. Interno',
      minWeightKg: 0,
      unit: 'c/u',
      ufPrice: 37.55,
      factor: 1,
      quantity: 6,
      subtotalUf: 225.30,
      subtotalClp: Math.round(225.30 * 38500)
    },
    {
      id: 'partida-2',
      itemNumber: '1.1.2',
      code: 'PART-1.1.2',
      designation: 'TRIAXIAL 60X120',
      norm: '',
      minWeightKg: 0,
      unit: '',
      ufPrice: 0,
      factor: 1,
      quantity: 0,
      subtotalUf: 1179.31,
      subtotalClp: Math.round(1179.31 * 38500),
      isDivider: true,
      dividerTitle: 'TRIAXIAL 60X120'
    },
    {
      id: 'item-271-1',
      itemNumber: '1.1.2.1',
      code: '271',
      designation: 'Ensayo triaxial para grandes partículas\nTipo CIU o CID ( probeta de 60 x 120 cm, tamaño máximo 4”, confinamiento máximo 20 kg/cm2).\nNotas: \nSe considera máx. 5 días hábiles de ejecución y corte monotónico.\nSe considera material previamente preparado según ítem de preparación de muestras.\nEl peso de material x probeta informado es referencial y considera bajo 4". El material a enviar para ensayo se debe estimar según las caracteristicas propias del material.',
      norm: 'Proced. Interno',
      minWeightKg: 1500,
      unit: 'c/probeta',
      ufPrice: 320.72,
      factor: 1,
      quantity: 3,
      subtotalUf: 962.16,
      subtotalClp: Math.round(962.16 * 38500)
    },
    {
      id: 'item-274-1',
      itemNumber: '1.1.2.2',
      code: '274',
      designation: 'Preparación de muestra para Triaxial Gigante probeta 60 x 120 cm\nNotas\nconsidera máximo 6 toneladas de material, material estimado necesaria para tres probetas.\nPreparación de muestras homotéticas hasta malla 1 1/2", bajo este tamiz la muestra se utiliza integral, sin modificación.',
      norm: 'Proced. Interno',
      minWeightKg: 0,
      unit: 'gl.',
      ufPrice: 150.22,
      factor: 1,
      quantity: 1,
      subtotalUf: 150.22,
      subtotalClp: Math.round(150.22 * 38500)
    },
    {
      id: 'item-277-1',
      itemNumber: '1.1.2.3',
      code: '277',
      designation: 'Granulometría Post Triaxial Gigante 60 x 120 cm',
      norm: 'Proced. Interno',
      minWeightKg: 0,
      unit: 'c/u',
      ufPrice: 22.31,
      factor: 1,
      quantity: 3,
      subtotalUf: 66.93,
      subtotalClp: Math.round(66.93 * 38500)
    },
    {
      id: 'partida-3',
      itemNumber: '1.1.3',
      code: 'PART-1.1.3',
      designation: 'ENSAYOS ADICIONALES',
      norm: '',
      minWeightKg: 0,
      unit: '',
      ufPrice: 0,
      factor: 1,
      quantity: 0,
      subtotalUf: 0,
      subtotalClp: 0,
      isDivider: true,
      dividerTitle: 'ENSAYOS ADICIONALES'
    },
    {
      id: 'item-301-1',
      itemNumber: '1.1.3.1',
      code: '301-1',
      designation: 'Densidad máxima y mínima especial con compactador mecánico en molde de 100cm (Método no convencional)',
      norm: '---',
      minWeightKg: 0,
      unit: 'c/u',
      ufPrice: 93.32,
      factor: 1,
      quantity: 0,
      subtotalUf: 0,
      subtotalClp: 0
    },
    {
      id: 'item-211-1',
      itemNumber: '1.1.3.2',
      code: '211',
      designation: 'Ensaye Compresión Simple con medición de deformación axial y deformación transversal.\nIncluye Preparación de probetas (corte y refrentado).',
      norm: 'Basado en ASTM D7012-23',
      minWeightKg: 0,
      unit: 'c/probeta',
      ufPrice: 6.48,
      factor: 1,
      quantity: 0,
      subtotalUf: 0,
      subtotalClp: 0
    },
    {
      id: 'item-212-1',
      itemNumber: '1.1.3.3',
      code: '212',
      designation: 'Ensaye Carga Puntual (POINT LOAD TEST) en muestras de colpas .',
      norm: 'Basado en ASTM D5731-16',
      minWeightKg: 0,
      unit: 'c/muestra',
      ufPrice: 2.71,
      factor: 1,
      quantity: 0,
      subtotalUf: 0,
      subtotalClp: 0
    },
    {
      id: 'item-187-1',
      itemNumber: '1.1.3.4',
      code: '187',
      designation: 'Extracción de testigos de roca',
      norm: 'Proced. Interno',
      minWeightKg: 0,
      unit: 'c/testigo',
      ufPrice: 1.53,
      factor: 1,
      quantity: 0,
      subtotalUf: 0,
      subtotalClp: 0
    }
  ]
};

// 2. Cotización AJGEOTECH SPA
const cotizacionAjgeotech = {
  id: 'cot-1792605238588',
  code: 'PR.DGL.2340.2026.0673',
  correlativo: 'PR.DGL.2340.2026.0673',
  year: 2026,
  date: '2026-10-20',
  client_name: 'AJGEOTECH SPA',
  client_rut: '76476318-1',
  contact_name: 'Abelardo Julio',
  contact_phone: '+56232265854',
  contact_email: 'aj@ajgeotech.cl',
  project_name: 'Minera Guanaco - 459-ROCKT-MINGUA',
  project_address: 'Santiago',
  centro_costo: '2340',
  seccion: 'SGL - Sección Laboratorio de Geotecnia',
  sector_proyecto: 'Minería',
  subsector_proyecto: 'No Aplica',
  zona_proyecto: 'Zona Norte',
  currency: 'UF',
  uf_value: 38500,
  dollar_value: 950,
  subtotal_neto: 44.85,
  descuento_porcentaje: 0,
  descuento_monto: 0,
  total_neto: 44.85,
  iva: 8.52,
  total: 53.37,
  total_usd: Number(((44.85 * 38500) / 950).toFixed(2)),
  total_clp: Math.round(44.85 * 38500),
  status: 'Finalizada',
  version: 1,
  user_id: 'usr-1',
  user_name: 'Diego Román Araneda',
  user_email: 'diego.roman@idiem.cl',
  user_initials: 'DRA',
  validity_days: 30,
  payment_terms: '50% AL CONTADO Y 50% CONTRA ENTREGA',
  created_at: '2026-10-21T17:54:45.094Z',
  updated_at: '2026-10-21T17:54:45.094Z',
  observations: [
    'Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de su recepción.',
    'La presente propuesta está generada a carácter informativo. La determinación de ensayos y sus cantidades dependerá de la estimación del cliente, a lo cual, la propuesta deberá ser ajustada a dicho detalle de ensayo.',
    '(*) Los ensayos realizados bajo normativas específicas indicadas podrían no contar con alcance de acreditación bajo LE-304 si corresponde.',
    '¿El laboratorio tiene la capacidad y recursos para realizar las actividades?: [X] SÍ [ ] NO'
  ],
  ai_chat_state: {
    commercialTitle: 'Asesor Comercial DGL',
    showTotalWeightPerItem: true,
    showSummaryUnitWeight: false,
    showSummaryTotalWeight: false,
    showTableFootWeight: false,
    showObservationsWeight: false,
    totalUnitWeightKg: 8,
    projectMeta: {
      seccion: 'SGL - Sección Laboratorio de Geotecnia',
      centroCosto: '2340',
      sectorProyecto: 'Minería',
      subsectorProyecto: 'No Aplica',
      zonaProyecto: 'Zona Norte',
      reference: 'Ensayos Geotécnicos'
    }
  },
  items: [
    {
      id: 'item-116-1',
      itemNumber: '1.1.1',
      code: '116',
      designation: 'Ensaye Triaxial CID (convencional), probeta 10,0 x 20,0 cm (hasta 6 kg/cm2) \nProbeta tallada (muestra natural) o probeta remoldeada (muestra perturbada).\nMaterial bajo 3/8 pulgada.\nNota 1: Se requiere serie de tres probetas/muestra.\nNota 2: Tiempo de ejecución de ensayos considera 3 días hábiles (2 días de saturación y consolidación y 3ª día etapa de corte hasta máximo 4 horas).',
      norm: 'Basado en ASTM D7181-20',
      minWeightKg: 8,
      unit: 'c/probeta',
      ufPrice: 14.95,
      factor: 1,
      quantity: 3,
      subtotalUf: 44.85,
      subtotalClp: Math.round(44.85 * 38500)
    }
  ]
};

async function restaurar() {
  console.log('Restaurando cotización Lundin Mining Chile Spa...');
  const { data: resLundin, error: errLundin } = await supabase
    .from('cotizaciones')
    .upsert(cotizacionLundin)
    .select();

  if (errLundin) {
    console.error('Error insertando Lundin:', errLundin);
  } else {
    console.log('✓ Lundin insertada exitosamente en Supabase:', resLundin[0].code, resLundin[0].client_name, resLundin[0].total_neto);
  }

  console.log('Restaurando cotización AJGEOTECH SPA...');
  const { data: resAj, error: errAj } = await supabase
    .from('cotizaciones')
    .upsert(cotizacionAjgeotech)
    .select();

  if (errAj) {
    console.error('Error insertando AJGEOTECH:', errAj);
  } else {
    console.log('✓ AJGEOTECH insertada exitosamente en Supabase:', resAj[0].code, resAj[0].client_name, resAj[0].total_neto);
  }

  // Actualizar también db.json local para sincronización y desarrollo
  try {
    const dbPath = 'data/db.json';
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!db.cotizaciones) db.cotizaciones = [];
    
    // Mapear a camelCase para db.json
    const mapToCamel = (c) => ({
      id: c.id,
      code: c.code,
      date: c.date,
      clientName: c.client_name,
      clientRut: c.client_rut,
      clientAttention: c.contact_name,
      clientPhone: c.contact_phone,
      clientEmail: c.contact_email,
      reference: 'Ensayos Geotécnicos',
      projectName: c.project_name,
      city: c.project_address,
      paymentCondition: c.payment_terms,
      centroCosto: c.centro_costo,
      seccion: c.seccion,
      sectorProyecto: c.sector_proyecto,
      subsectorProyecto: c.subsector_proyecto,
      zonaProyecto: c.zona_proyecto,
      currency: c.currency,
      commercialName: c.user_name,
      commercialTitle: c.ai_chat_state?.commercialTitle || 'Asesor Comercial DGL',
      commercialInitials: c.user_initials,
      commercialEmail: c.user_email,
      ufValue: c.uf_value,
      dollarValue: c.dollar_value,
      items: c.items,
      totalUf: c.total_neto,
      totalClp: c.total_clp,
      totalUsd: c.total_usd,
      observations: c.observations,
      status: c.status,
      version: c.version,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      createdBy: c.user_name,
      createdById: c.user_id,
      isDeleted: false
    });

    const lundinCamel = mapToCamel(cotizacionLundin);
    const ajCamel = mapToCamel(cotizacionAjgeotech);

    // Reemplazar o insertar
    const idxL = db.cotizaciones.findIndex(c => c.id === lundinCamel.id);
    if (idxL >= 0) db.cotizaciones[idxL] = lundinCamel;
    else db.cotizaciones.unshift(lundinCamel);

    const idxA = db.cotizaciones.findIndex(c => c.id === ajCamel.id);
    if (idxA >= 0) db.cotizaciones[idxA] = ajCamel;
    else db.cotizaciones.unshift(ajCamel);

    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    console.log('✓ db.json actualizado con ambas cotizaciones restauradas.');
  } catch (err) {
    console.error('Error actualizando db.json:', err);
  }
}

restaurar();

