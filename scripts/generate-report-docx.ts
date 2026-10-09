import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import fs from 'fs';
import path from 'path';

async function generateDocx() {
  const primaryRed = 'C00000';
  const darkNavy = '0F172A';
  const slateText = '334155';
  const lightBg = 'F8FAFC';
  const headerBg = '1E293B';

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22, // 11pt
            color: slateText,
          },
          paragraph: {
            spacing: {
              line: 360, // 1.15 line spacing
              after: 120, // 6pt after
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'IDIEM — División de Geotecnia Laboratorio (DGL) | Propuesta Estratégica',
                    size: 16,
                    color: '94A3B8',
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.BOTH,
                children: [
                  new TextRun({
                    text: 'Confidencial — Para revisión de Dirección General y Jefatura DGL',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    text: '          Página ',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '94A3B8',
                    bold: true,
                  }),
                  new TextRun({
                    text: ' de ',
                    size: 16,
                    color: '94A3B8',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '94A3B8',
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // PORTADA / TÍTULO PRINCIPAL
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 120 },
            children: [
              new TextRun({
                text: 'INFORME TÉCNICO-COMERCIAL Y PLAN DE VIABILIDAD ESTRATÉGICA',
                size: 36, // 18pt
                bold: true,
                color: primaryRed,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [
              new TextRun({
                text: 'Plataforma Integral de Cotización, Inteligencia Comercial y Sincronización Automatizada con Salesforce e Intranet de Facturación',
                size: 26, // 13pt
                bold: true,
                color: darkNavy,
              }),
            ],
          }),

          // TABLA DE METADATOS EJECUTIVOS
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Destinatarios:', bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    width: { size: 75, type: WidthType.PERCENTAGE },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Dirección General, Gerencia de Administración y Finanzas, Jefatura de División DGL', size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Líder / Autor:', bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Diego Román A. / Equipo de Desarrollo e Innovación Comercial DGL', size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Fecha & Versión:', bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Octubre de 2026 — Versión 1.0 (Viabilidad Operativa y Roadmap V2)', size: 20 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Estado del Sistema:', bold: true, size: 20 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'V1 Operativa en Producción (Cloudflare Workers + Supabase + Salesforce IDIEM)', size: 20, bold: true, color: '15803D' })] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // SECCIÓN 1: RESUMEN EJECUTIVO
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 240, after: 120 },
            children: [new TextRun({ text: '1. Resumen Ejecutivo', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'El presente informe expone la viabilidad técnica, operativa y financiera de la Plataforma Integral de Cotización y Gestión de Ventas DGL, concebida para modernizar y blindar el ciclo comercial de la División de Geotecnia Laboratorio del IDIEM.'
              ),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'Históricamente, la operación comercial ha enfrentado tres fricciones que generan costos ocultos, retrasos e inconsistencias:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Dispersión y demora en la emisión de ofertas: ', bold: true }),
              new TextRun('Confección manual de cotizaciones en planillas desconectadas, con riesgo de tarifas obsoletas y errores de cálculo.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Carga duplicada y fricción en Salesforce: ', bold: true }),
              new TextRun('Los ejecutivos debían redigitar manualmente la Oportunidad, la Cotización oficial (Quote), los servicios del Pricebook, subir el PDF y tipear una a una las cuotas de facturación.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Desfase estructural entre Salesforce y la Intranet de Facturación (Descuadre del EERR): ', bold: true }),
              new TextRun('La Intranet factura en base a la ejecución real de ensayos y emite el Estado de Resultados (EERR) contable. Sin embargo, las cuotas en Salesforce son manuales y estáticas. Al no existir integración, Salesforce queda desfasado y el EERR contable no coincide con lo reportado comercialmente.'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'La plataforma desarrollada ya resuelve de raíz los dos primeros problemas en su Versión 1 (V1), reduciendo los tiempos de emisión en un 80% y sincronizando con Salesforce en 1 solo clic. Este documento propone su oficialización y presenta la Versión 2 (V2), diseñada para conectar la Intranet de Facturación y lograr la cuadratura automática del Estado de Resultados en tiempo real.'
              ),
            ],
          }),

          // SECCIÓN 2: DIAGNÓSTICO Y PROBLEMÁTICA DEL EERR
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '2. Diagnóstico de la Problemática Actual: La Brecha del EERR', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'Actualmente la división opera con dos islas de información desvinculadas:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Salesforce IDIEM (Visión Comercial / Forecast): ', bold: true }),
              new TextRun('Almacena las Oportunidades "Cerradas ganadas" y sus cuotas de facturación teóricas (Cuotas de Facturación).'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Intranet de Facturación IDIEM (Visión Contable / Facturación Real): ', bold: true }),
              new TextRun('Emite los documentos tributarios (facturas) a medida que los ensayos concluyen o se aprueban estados de pago. Esta base alimenta el EERR mensual.'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '¿Por qué no cuadran actualmente? ',
                bold: true,
                color: darkNavy,
              }),
              new TextRun(
                'Cuando un cliente posterga la entrega de muestras, suspende una faena o solicita facturar montos parciales distintos a los previstos, la Intranet emite la factura con los datos reales de ese mes. No obstante, nadie entra a Salesforce a reprogramar las cuotas comprometidas hace 3 o 6 meses. La consecuencia es que a fin de mes el Estado de Resultados real y el pipeline comercial de Salesforce muestran desviaciones sistemáticas.'
              ),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Hallazgo Crítico en la Auditoría de Salesforce: ',
                bold: true,
                color: primaryRed,
              }),
              new TextRun(
                'Al auditar el modelo de datos de Salesforce en este proyecto se detectó que el objeto de cuotas ya cuenta con campos para conciliación contable (N° de Factura, Fecha Real de Facturación, Monto Real Facturado y Diferencia de Monto). Estos campos están vacíos hoy en día únicamente porque falta un puente automatizado entre la Intranet y Salesforce.'
              ),
            ],
          }),

          // SECCIÓN 3: CAPACIDADES V1
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '3. Capacidades y Ventajas Actuales de la Plataforma (V1 Operativa)', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'La plataforma ya se encuentra completamente funcional, probada con la API de producción de Salesforce IDIEM y desplegada en la nube de alta velocidad de Cloudflare Workers:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Tarifario Maestro Oficial Blindado: ', bold: true }),
              new TextRun('Gestión centralizada de precios en UF para los centros de costo 2340 (UEB), 1817 (UGB), 2339 (UER), 2341 (UGE) y 3340 (USM), con control de acceso por roles (superadmin, admin, comercial).'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Inteligencia Artificial Técnica Integrada: ', bold: true }),
              new TextRun('Asistente Gemini con arquitectura RAG conectado a la biblioteca de normas técnicas (NCh, ASTM, ISRM) para analizar solicitudes complejas y sugerir ensayos pertinentes.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Generación Documental Homologada: ', bold: true }),
              new TextRun('Exportación instantánea en PDF oficial bajo la norma de calidad DGL-FA-193 V3 con membrete corporativo, firmas digitales e indicadores UF/CLP, además de planillas Excel editables.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Sincronización Total con Salesforce en 1 Clic: ', bold: true }),
              new TextRun('Búsqueda de Cuentas por RUT chileno, generación de Oportunidad, Cotización oficial (Quote), asociación de Pricebook Standard IDIEM, adjunto automático del PDF y asignación del correlativo PR.DGL.CCCC.2026.XXXX.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Módulo de Cierre Comercial y Cuotas Flexibles: ', bold: true }),
              new TextRun('Permite ajustar el monto final de cierre (negociación comercial con descuento o alza) y proyectar de 1 a 120 cuotas mensuales con balanceo automático al 100%, o registrar motivos estandarizados de pérdida.'),
            ],
          }),

          // SECCIÓN 4: ROADMAP
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '4. Potencialidad y Roadmap de Evolución', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Corto Plazo (0 - 3 meses): ', bold: true }),
              new TextRun('Oficialización en DGL, reemplazo total de archivos Excel manuales, unificación del correlativo comercial y capacitación del equipo comercial.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Mediano Plazo (3 - 6 meses) — Fase V2: ', bold: true }),
              new TextRun('Conexión con la Intranet de Facturación mediante API/Webhook para cuadratura automática del Estado de Resultados (EERR) y alertas de cuotas vencidas sin facturar.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Largo Plazo (6 - 12 meses): ', bold: true }),
              new TextRun('Escalamiento a otras divisiones de IDIEM (Materiales, Metalurgia, Calidad), analítica predictiva de demanda y balanceo de carga en laboratorio.'),
            ],
          }),

          // SECCIÓN 5: LA SOLUCIÓN V2
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '5. Propuesta V2: Solución al Descuadre entre Intranet, Salesforce y EERR', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'La versión 2 propone un flujo automatizado de circuito cerrado donde la Intranet de Facturación y Salesforce conversan mediante la plataforma:'
              ),
            ],
          }),

          // TABLA COMPARATIVA FLUJO ACTUAL VS V2
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    shading: { fill: headerBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Hito del Proceso', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    shading: { fill: headerBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Proceso Actual (Manual)', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    shading: { fill: headerBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Propuesta V2 (Automatizada)', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: '1. Cotización', bold: true, size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Planillas locales desvinculadas, riesgo de tarifas desactualizadas.', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Centralizada en plataforma DGL con tarifas oficiales y asistencia IA.', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: '2. Registro Salesforce', bold: true, size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Manual campo por campo (15 a 25 min por propuesta).', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '1 Clic: Oportunidad + Quote + Cuotas + PDF adjunto sincronizados.', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: '3. Facturación Real', bold: true, size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Intranet emite factura, pero el dato no sale de la intranet.', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Intranet emite factura y envía Webhook con el código de cotización.', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: '4. Actualización SF', bold: true, size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Omitida o digitada con meses de retraso por saturación operativa.', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Automática: Completa N° Factura, Fecha real y Monto real en Salesforce.', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: '5. Impacto en EERR', bold: true, size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Descuadre continuo entre el forecast de SF y la contabilidad real.', size: 18, color: primaryRed, bold: true })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Cuadratura 100% en tiempo real. Forecast comercial ajustado a la realidad contable.', size: 18, color: '15803D', bold: true })] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // SECCIÓN 6: REQUISITOS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '6. Requisitos Técnicos, Administrativos, Equipos y Personas', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            children: [
              new TextRun(
                'Gracias al diseño moderno "Cloud-Native" de la plataforma, los costos de infraestructura y requerimientos de soporte son extraordinariamente bajos:'
              ),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Infraestructura & Servidores: ', bold: true }),
              new TextRun('Cero servidores físicos requeridos. La plataforma corre sobre Cloudflare Workers (costo mensual de $0 a nivel de uso actual) y Supabase PostgreSQL ($0 a $25/mes según crecimiento).'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Equipo Humano Necesario: ', bold: true }),
              new TextRun('Administrador de producto (Diego Román, dedicación dentro de funciones comerciales habituales) y apoyo puntual de 1 ingeniero de sistemas de TI IDIEM (15 a 20 horas de desarrollo) para habilitar el Webhook de la Intranet.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Capacitación y Adopción: ', bold: true }),
              new TextRun('Una sesión de capacitación de 45 minutos para el equipo comercial de DGL. La interfaz fue diseñada de forma intuitiva, minimizando la curva de aprendizaje.'),
            ],
          }),

          // SECCIÓN 7: ROI Y BENEFICIOS
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '7. Análisis de Retorno de Inversión (ROI) y Beneficios Cuantitativos', bold: true, color: primaryRed, size: 28 })],
          }),

          // TABLA RESUMEN ROI
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    shading: { fill: headerBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Métrica Operativa', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: headerBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Antes (Proceso Manual)', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    shading: { fill: headerBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Con Plataforma DGL', bold: true, color: 'FFFFFF', size: 18 })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Tiempo por cotización emitida', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '35 a 50 minutos', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '5 a 8 minutos (Ahorro > 80%)', size: 18, bold: true, color: '15803D' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Tiempo de ingreso a Salesforce', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '15 a 25 minutos', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '10 segundos (1 clic automático)', size: 18, bold: true, color: '15803D' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Errores de precios o cálculo', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Frecuentes en Excel local', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '0% (Tarifario centralizado)', size: 18, bold: true })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Cuadratura EERR vs. Salesforce', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Descuadrada sistemáticamente', size: 18, color: primaryRed })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: 'Cuadrada en tiempo real', size: 18, bold: true, color: '15803D' })] })],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: lightBg, type: ShadingType.CLEAR },
                    children: [new Paragraph({ children: [new TextRun({ text: 'Ahorro mensual horas-hombre', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '0 hrs', size: 18 })] })],
                  }),
                  new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: '> 45 horas comerciales/mes', size: 18, bold: true, color: '15803D' })] })],
                  }),
                ],
              }),
            ],
          }),

          new Paragraph({ spacing: { after: 240 } }),

          // SECCIÓN 8: CONCLUSIONES Y RECOMENDACIONES
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 280, after: 120 },
            children: [new TextRun({ text: '8. Conclusiones y Recomendaciones para la Dirección', bold: true, color: primaryRed, size: 28 })],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Proyecto Maduro y Operativo: ', bold: true }),
              new TextRun('La plataforma V1 no es un prototipo conceptual; es un sistema en producción con pruebas exitosas en la API de producción de Salesforce IDIEM, demostrando total estabilidad y cumplimiento de estándares corporativos.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Solución Definitiva a la Brecha del EERR: ', bold: true }),
              new TextRun('La arquitectura V2 elimina el histórico problema de conciliación entre la facturación real y las proyecciones de Salesforce, entregando por primera vez a Dirección un Estado de Resultados confiable y consistente.'),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            children: [
              new TextRun({ text: 'Pasos a Seguir Recomendados: ', bold: true }),
              new TextRun('1) Formalizar la plataforma como canal exclusivo de cotización en DGL. 2) Autorizar la mesa técnica con el equipo de TI IDIEM para coordinar el Webhook de la Intranet de Facturación.'),
            ],
          }),

          new Paragraph({ spacing: { before: 360 } }),

          // FIRMAS
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: '_____________________________________\n', bold: true }),
                          new TextRun({ text: 'Diego Román A.\n', bold: true, size: 20 }),
                          new TextRun({ text: 'Asesor Comercial & Líder de Proyecto\nDivisión Geotecnia Laboratorio (DGL)\nIDIEM — Universidad de Chile', size: 18, color: '64748B' }),
                        ],
                      }),
                    ],
                  }),
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: {
                      top: { style: BorderStyle.NONE },
                      bottom: { style: BorderStyle.NONE },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: '_____________________________________\n', bold: true }),
                          new TextRun({ text: 'Dirección General / Jefatura DGL\n', bold: true, size: 20 }),
                          new TextRun({ text: 'Aprobación & Patrocinio Institucional\nIDIEM — Universidad de Chile', size: 18, color: '64748B' }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  // Guardar en el directorio del proyecto
  const projectPath = path.join(process.cwd(), 'INFORME_TECNICO_COMERCIAL_PROYECTO_DGL_SALESFORCE.docx');
  fs.writeFileSync(projectPath, buffer);
  console.log('✓ Documento Word guardado en:', projectPath);

  // Guardar también en el directorio de artefactos
  const artifactDir = 'C:\\Users\\Diego\\.gemini\\antigravity\\brain\\21e4b930-b3ce-4131-95ac-5c6fc09f3ae2';
  const artifactPath = path.join(artifactDir, 'INFORME_TECNICO_COMERCIAL_PROYECTO_DGL_SALESFORCE.docx');
  try {
    fs.writeFileSync(artifactPath, buffer);
    console.log('✓ Documento Word guardado en artefactos:', artifactPath);
  } catch {}
}

generateDocx().catch((err) => {
  console.error('Error generando documento DOCX:', err);
  process.exit(1);
});

