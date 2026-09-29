import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Cotizacion, FormatoSettings } from './types';

const DEFAULT_FORMATO: FormatoSettings = {
  formatCode: 'DGL-FA-193 V3',
  officeTitle: 'Oficina central',
  officeAddress: 'Plaza Ercilla 883, Santiago, Chile',
  contactPhone: '+56 2 2978 4800',
  contactEmail: 'contacto@idiem.cl',
  contactWeb: 'www.idiem.cl',
  budgetTitle: 'PRESUPUESTO ENSAYOS DE LABORATORIO',
  divisionTitle: 'División Geotecnia Laboratorio',
};

function getBase64ImageDimensions(dataUri: string): { width: number; height: number } | null {
  try {
    const commaIdx = dataUri.indexOf(',');
    if (commaIdx === -1) return null;
    const base64 = dataUri.slice(commaIdx + 1, commaIdx + 70);
    let binary = '';
    if (typeof atob === 'function') {
      binary = atob(base64);
    } else if (typeof Buffer !== 'undefined') {
      binary = Buffer.from(base64, 'base64').toString('binary');
    }
    if (
      binary.length >= 24 &&
      binary.charCodeAt(1) === 0x50 &&
      binary.charCodeAt(2) === 0x4e &&
      binary.charCodeAt(3) === 0x47
    ) {
      const w =
        ((binary.charCodeAt(16) & 0xff) << 24) |
        ((binary.charCodeAt(17) & 0xff) << 16) |
        ((binary.charCodeAt(18) & 0xff) << 8) |
        (binary.charCodeAt(19) & 0xff);
      const h =
        ((binary.charCodeAt(20) & 0xff) << 24) |
        ((binary.charCodeAt(21) & 0xff) << 16) |
        ((binary.charCodeAt(22) & 0xff) << 8) |
        (binary.charCodeAt(23) & 0xff);
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  } catch {}
  return null;
}

export function generateCotizacionPdf(
  cotizacion: Cotizacion,
  logoBase64?: string,
  formatoConfig?: Partial<FormatoSettings>,
  options?: { isDraft?: boolean; showEconomicIndicators?: boolean }
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const formato: FormatoSettings = {
    ...DEFAULT_FORMATO,
    ...(formatoConfig || {}),
  };

  const isDraft = options?.isDraft ?? (cotizacion.status === 'Borrador');
  const showIndicators =
    options?.showEconomicIndicators ?? (cotizacion.showEconomicIndicators !== false);

  const pageWidth = doc.internal.pageSize.getWidth(); // 215.9 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 279.4 mm
  const marginX = 14;

  // Inicio de contenido en la página 1 debajo del área del logotipo institucional
  let currentY = 27;

  // 1. Metadatos superiores / Código y Fecha (Alineados a la derecha en Página 1)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  const codeText = cotizacion.code || 'PR.DGL.2339.2026.XXXX';
  const displayCode = isDraft ? `${codeText} [BORRADOR]` : codeText;
  const dateFormatted = cotizacion.date
    ? new Date(cotizacion.date).toLocaleDateString('es-CL', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('es-CL');

  doc.text(displayCode, pageWidth - marginX, 12, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Fecha: ${dateFormatted}`, pageWidth - marginX, 16.5, { align: 'right' });
  if (cotizacion.city) {
    doc.text(`Sede: ${cotizacion.city}`, pageWidth - marginX, 21, { align: 'right' });
  }

  // 2. Cuadro de datos del Cliente (Alineado a la izquierda)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.text('Señores', marginX, currentY);
  currentY += 4.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);
  doc.text(cotizacion.clientName || 'RAZÓN SOCIAL', marginX, currentY);
  currentY += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  if (cotizacion.clientRut) {
    doc.text(`RUT: ${cotizacion.clientRut}`, marginX, currentY);
    currentY += 4.2;
  }
  doc.text('Presente', marginX, currentY);
  currentY += 5.5;

  // Tabla y detalles de contacto
  const clientDetails = [
    ['Atención', `: ${cotizacion.clientAttention || '---'}`],
    ['N° Teléfono Móvil', `: ${cotizacion.clientPhone || '---'}`],
    ['E-Mail', `: ${cotizacion.clientEmail || '---'}`],
    ['Referencia', `: ${cotizacion.reference || 'Ensayos Geotécnicos'}`],
    ['Nombre Obra/Proyecto', `: ${cotizacion.projectName || '---'}`],
  ];

  clientDetails.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginX, currentY);
    doc.setFont('helvetica', 'normal');
    doc.text(val, marginX + 38, currentY);
    currentY += 3.8;
  });

  currentY += 2;

  // 3. Saludo e introducción comercial
  doc.text('De nuestra consideración:', marginX, currentY);
  currentY += 3.8;
  doc.text(
    'Adjunto a la presente, presupuesto solicitado por ensayos de la referencia.',
    marginX,
    currentY
  );
  currentY += 3.8;
  doc.text(
    'Quedando atento a aclarar cualquier consulta relacionada con la presente información,',
    marginX,
    currentY
  );
  currentY += 3.8;
  doc.text('Saluda atentamente a Ud.,', marginX, currentY);
  currentY += 4.5;

  // Línea del emisor comercial
  doc.setFont('helvetica', 'bold');
  doc.text(cotizacion.commercialName || 'Diego Román Araneda', marginX, currentY);
  currentY += 3.5;
  doc.setFont('helvetica', 'normal');
  doc.text(cotizacion.commercialTitle || 'Analista Comercial', marginX, currentY);
  currentY += 5;

  // Línea informativa de moneda de referencia (opcional en el PDF según preferencia del usuario)
  if (showIndicators) {
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    const ufStr = `Valor UF Ref.: $${(cotizacion.ufValue || 40879.04).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const usdStr = cotizacion.dollarValue
      ? ` | Valor Dólar Ref.: $${cotizacion.dollarValue.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '';
    const refCode = cotizacion.commercialInitials ? ` | Ref: ${cotizacion.commercialInitials}` : '';
    doc.text(`${ufStr}${usdStr}${refCode}`, marginX, currentY);
    currentY += 6;
  } else if (cotizacion.commercialInitials) {
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(`Ref: ${cotizacion.commercialInitials}`, marginX, currentY);
    currentY += 5;
  }

  // 4. Título del Presupuesto (Alineado a la izquierda, azul marino institucional)
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 68, 124); // Azul marino profundo institucional
  const rawBudgetTitle = formato.budgetTitle || 'PRESUPUESTO ENSAYOS DE LABORATORIO';
  const displayBudgetTitle = rawBudgetTitle.startsWith('1.1')
    ? rawBudgetTitle
    : `1.1 ${rawBudgetTitle}`;
  doc.text(displayBudgetTitle, marginX, currentY);
  currentY += 4.5;

  // 5. Tabla de Ensayos según formato oficial (8 columnas en UF o USD)
  const isUsd = cotizacion.currency === 'USD';
  const ufVal = cotizacion.ufValue || 40879.04;
  const usdVal = cotizacion.dollarValue || 933.47;

  const tableRows: (string | number)[][] = cotizacion.items.map((item, idx) => {
    const itemNum = `1.1.${idx + 1}`;
    const unitPriceUf = Number(item.ufPrice || 0);
    const factor = Number(item.factor || 1);
    const finalPriceUf = unitPriceUf * factor;
    const qty = Number(item.quantity || 0);
    const subtotalUf = finalPriceUf * qty;

    const unitPrice = isUsd ? (finalPriceUf * ufVal) / usdVal : finalPriceUf;
    const subtotal = isUsd ? (subtotalUf * ufVal) / usdVal : subtotalUf;

    return [
      itemNum,
      item.designation,
      item.norm || '---',
      item.minWeightKg ? `${item.minWeightKg} kg` : '-',
      item.unit || 'c/u',
      unitPrice.toFixed(2),
      qty.toString(),
      subtotal.toFixed(2),
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { top: 28, left: marginX, right: marginX, bottom: 26 },
    head: [
      [
        'Item',
        'Designación Ensayo',
        'Norma o Proced.',
        'Masa Mín.\n(kg)',
        'Unidad',
        isUsd ? 'Precio\n(USD)' : 'Precio\n(UF)',
        'Cant.',
        isUsd ? 'Subtotal\n(USD)' : 'Subtotal\n(UF)',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [0, 68, 124], // Deep navy blue matching reference Image 1
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'center',
      valign: 'middle',
      lineColor: [220, 220, 220],
      lineWidth: 0.15,
      cellPadding: 1.6,
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [20, 20, 20],
      cellPadding: 1.6,
      lineColor: [210, 210, 210],
      lineWidth: 0.15,
    },
    columnStyles: {
      0: { cellWidth: 11, halign: 'center' }, // Item
      1: { cellWidth: 63.9 }, // Designación Ensayo
      2: { cellWidth: 39, fontSize: 6.8 }, // Norma o Proced.
      3: { cellWidth: 16, halign: 'center' }, // Masa Mín. (kg)
      4: { cellWidth: 12, halign: 'center' }, // Unidad
      5: { cellWidth: 17, halign: 'right' }, // Precio (UF/USD)
      6: { cellWidth: 11, halign: 'center' }, // Cant.
      7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' }, // Subtotal (UF/USD)
    },
    foot: [
      [
        '',
        'Total Ensayos',
        '',
        cotizacion.totalWeightKg ? `${cotizacion.totalWeightKg.toFixed(1)} kg` : '',
        '',
        '',
        '',
        isUsd
          ? `${(cotizacion.totalUsd ?? (cotizacion.totalUf * ufVal) / usdVal).toFixed(2)} USD`
          : `${(cotizacion.totalUf || 0).toFixed(2)} UF`,
      ],
    ],
    footStyles: {
      fillColor: [240, 245, 250],
      textColor: [0, 68, 124],
      fontStyle: 'bold',
      fontSize: 7.8,
      halign: 'right',
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
      cellPadding: 1.8,
    },
  });

  // Posición vertical tras la tabla de ensayos
  const lastTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable;
  currentY = (lastTable ? lastTable.finalY : currentY) + 5;

  const maxContentY = pageHeight - 26; // 253.4 mm: margen inferior seguro antes del pie de página

  // Comprobar si las observaciones de geotécnica caben en la página actual (~36 mm requeridas)
  const requiredObsHeight = 36;
  if (currentY + requiredObsHeight > maxContentY) {
    doc.addPage();
    currentY = 28;
  }

  // 6. Observaciones de ensayos y capacidad de laboratorio según formato oficial
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('1.2 Observaciones de ensayos de Geotécnia', marginX, currentY);
  currentY += 4.2;

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);

  const defaultObservations = [
    '1.2.1 Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de su recepción.',
    '1.2.2 La presente propuesta está generada a carácter informativo. La determinación de ensayos y sus cantidades dependerá de la estimación del cliente, a lo cual, la propuesta deberá ser ajustada a dicho detalle de ensayo.',
    '1.2.3 (*) Los ensayos realizados bajo normativas específicas podrían no contar con alcance de acreditación bajo LE-304 si corresponde.',
    'El laboratorio tiene la capacidad y recursos para realizar las actividades?       SI  [ X ]       NO  [   ]',
  ];

  const obsToRender =
    cotizacion.observations && cotizacion.observations.length > 0
      ? cotizacion.observations
      : formato.observations && formato.observations.length > 0
      ? formato.observations
      : defaultObservations;

  obsToRender.forEach((obs) => {
    const lines = doc.splitTextToSize(obs, pageWidth - marginX * 2);
    doc.text(lines, marginX, currentY);
    currentY += lines.length * 3.4;
  });

  if (cotizacion.totalWeightKg && cotizacion.totalWeightKg > 0) {
    currentY += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 20, 20);
    doc.text(
      `Masa total estimada de muestras a entregar en laboratorio: ${cotizacion.totalWeightKg.toFixed(
        1
      )} kg aproximadamente.`,
      marginX,
      currentY
    );
    currentY += 4;
  }

  // ==========================================
  // 8. PÁGINA ADICIONAL: CONDICIONES ESPECIALES Y CLÁUSULAS COMERCIALES
  // ==========================================
  doc.addPage();
  let condY = 28;

  // Título del encabezado de condiciones
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('CONDICIONES GENERALES Y ESPECIALES DEL SERVICIO', marginX, condY);
  condY += 4;

  doc.setFontSize(7.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Anexo Oficial de Presupuesto - Código: ${cotizacion.code || 'PR.DGL.CCCC.2026.XXXX'} | Cliente: ${cotizacion.clientName || 'RAZÓN SOCIAL'}`,
    marginX,
    condY
  );
  condY += 5;

  const renderSectionHeader = (title: string) => {
    if (condY + 10 > maxContentY) {
      doc.addPage();
      condY = 28;
    }
    doc.setFontSize(7.8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(226, 0, 0); // IDIEM Red section headings
    doc.text(title, marginX, condY);
    condY += 3.4;
  };

  const renderParagraph = (
    text: string,
    isBullet = false,
    highlightPrefix = '',
    highlightValue = ''
  ) => {
    doc.setFontSize(6.7);
    const indent = isBullet ? 3 : 0;
    const bulletSymbol = isBullet ? '• ' : '';
    const textWidth = pageWidth - marginX * 2 - indent;

    if (highlightPrefix && highlightValue) {
      if (condY + 6 > maxContentY) {
        doc.addPage();
        condY = 28;
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 30);
      const prefixWidth = doc.getTextWidth(highlightPrefix);
      doc.text(highlightPrefix, marginX + indent, condY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(226, 0, 0);
      doc.text(highlightValue, marginX + indent + prefixWidth, condY);
      condY += 3.2;
      return;
    }

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(45, 45, 45);
    const lines = doc.splitTextToSize(bulletSymbol + text, textWidth);
    const neededH = lines.length * 2.8 + 0.8;
    if (condY + neededH > maxContentY) {
      doc.addPage();
      condY = 28;
    }
    doc.text(lines, marginX + indent, condY);
    condY += neededH;
  };

  const customCond = cotizacion.condicionesComerciales;

  // Section 1: Condiciones Especiales
  renderSectionHeader('Condiciones Especiales:');
  if (customCond?.clausulasEspeciales && customCond.clausulasEspeciales.length > 0) {
    customCond.clausulasEspeciales.forEach((c) => renderParagraph(c));
  } else {
    renderParagraph(
      'De acuerdo con lo dispuesto en el artículo 40 de la Ley No 21.094 Sobre Universidades Estatales y el Oficio No 1.216, de 19.04.2023 del Servicio de Impuestos Internos, los servicios aquí ofertados se encuentran exentos de IVA.'
    );

    // Dynamic payment condition matching company list / form / custom conditions
    const resolvedPayment =
      customCond?.condicionVenta ||
      cotizacion.paymentCondition ||
      '50% AL CONTADO Y 50% CONTRA ENTREGA';
    renderParagraph('', false, 'La condición de venta a este servicio es: ', resolvedPayment);

    renderParagraph(
      'Si un cliente se encuentra en mora con IDIEM, solo podrá solicitar nuevos servicios si cancela la deuda anterior y documenta los nuevos servicios solicitados.'
    );
    const vigencia = customCond?.vigenciaDias || '30 días';
    renderParagraph(`La vigencia de este presupuesto es de ${vigencia}.`);

    if (customCond?.plazoEntrega && customCond.plazoEntrega.trim()) {
      renderParagraph('', false, 'Plazo estimado de entrega de informes: ', customCond.plazoEntrega.trim());
    }

    renderParagraph('Presupuesto elaborado en base a un total estimado, se cobrará lo efectivamente realizado.');
    renderParagraph('No se enviarán informes parciales o preliminares sin EDP u OC asociada.');
    renderParagraph(
      'Con la aceptación de esta cotización y en caso de ser necesario vuestra empresa se compromete a proporcionar acceso a sus dependencias, obras o instalaciones a los equipos de evaluación del INN, para evaluar así el desempeño del OEC en la realización de las actividades del laboratorio IDIEM.'
    );
  }
  condY += 1.5;

  // Optional Section: Condiciones Particulares de esta Propuesta
  if (customCond?.clausulasParticulares && customCond.clausulasParticulares.length > 0) {
    const validParticulares = customCond.clausulasParticulares.filter((p) => p && p.trim().length > 0);
    if (validParticulares.length > 0) {
      renderSectionHeader('Condiciones Particulares Acordadas para esta Propuesta:');
      validParticulares.forEach((p) => {
        renderParagraph(p.trim(), true);
      });
      condY += 1.5;
    }
  }

  // Section 2: Condiciones de Facturación
  renderSectionHeader('Condiciones de Facturación:');
  if (customCond?.clausulasFacturacion && customCond.clausulasFacturacion.length > 0) {
    customCond.clausulasFacturacion.forEach((f) => renderParagraph(f));
  } else {
    renderParagraph(
      'Se emitirá Estado de Pago mensual correspondiente a los trabajos ejecutados y se enviará al cliente para su revisión. Una vez aprobado el Estado de Pago (EDP), se emitirá Factura en pesos chilenos, con el valor de la Unidad de Fomento a la fecha emisión de la Factura.'
    );
    renderParagraph(
      'Una vez recibido EDP mensual aprobado, se emitirá informe el cual será enviado en un plazo de tres (03) días hábiles.'
    );
    renderParagraph(
      'Para la emisión de facturas se realizará con orden de compra y/o estado de pago aprobado, en el cual el cliente acepta estar de acuerdo con el servicio y el monto entregado.'
    );
    renderParagraph(
      'Para determinar la fecha de vencimiento del documento, para efectos de pago se considera la fecha de emisión del documento.'
    );
    renderParagraph(
      'En el caso que el cliente incurra en mora se aplicará un interés diario máximo permitido por ley. Si el cliente no regulariza su condición de mora se procederá a informar la deuda en el boletín comercial.'
    );
    renderParagraph(
      'Si el pago se realiza con depósito o trasferencia en cuenta corriente, este debe ser efectuado a nombre de Universidad de Chile, RUT: 60.910.000-1, en pesos chilenos en la cuenta N ° 170-006-44-01 , y si es en dólares a la cuenta N ° 03-00004-54-7, ambas del Banco de Chile. Se debe enviar el respaldo a cobranzas@idiem.cl.'
    );
  }
  condY += 1.5;

  // Section 3: Condiciones Técnicas
  renderSectionHeader('Condiciones Técnicas:');
  if (customCond?.clausulasTecnicas && customCond.clausulasTecnicas.length > 0) {
    customCond.clausulasTecnicas.forEach((t) => renderParagraph(t));
  } else {
    renderParagraph(
      'La recepción de muestras se realizará sólo cuando éstas incluyan: los datos de la empresa mandante, el nombre del proyecto asociado y un contacto donde obtener información con respecto a los ensayos a realizar. Es necesario que estos datos se encuentren adjuntos a las muestras o que sean comunicados con anterioridad al correo ingresosdgl@idiem.cl. En caso que las muestras se envíen a IDIEM por cualquier medio sin esta información, no serán recepcionadas por nuestra institución, por lo anterior, no se responsabilizará por éstas.'
    );
    renderParagraph('Las muestras deberán ser enviadas a las direcciones según corresponda:');
    renderParagraph(
      'Ensayos básicos, especiales y rocas: Salomon Sack 840, Cerrillos. Las muestras enviadas en sacos no deben superar los 20 kg. Si las muestras superan dicha capacidad, se deberá informar previo a la llegada para la evaluación logística de su recepción y el cliente deberá esperar confirmación de disponibilidad de recepción.',
      true
    );
    renderParagraph(
      'Ensayos grandes partículas: Salomón Sack 840, Cerrillos. Las muestras deben ser enviadas en maxisacos sobre camión plano para ser descargado por grúa horquilla, en caso contrario se debe considerar el equipamiento para descargar el material por parte del mandante (camión pluma o grúa de mayor capacidad), no se acepta material en granel.',
      true
    );
    renderParagraph(
      'A contar de la fecha de recepción de las muestras en el laboratorio, los ensayos deberán ser programados en un plazo menor a 5 días hábiles. En el caso que no sea enviado el programa de ensayos, se procederá al envío de una cotización por concepto de almacenamiento, si no hubiera respuesta por parte del cliente las muestras serán eliminadas del laboratorio.'
    );
    renderParagraph(
      'Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de la programación de ensayos entregada por el ingeniero a cargo de las muestras.'
    );
    renderParagraph(
      'El tiempo de almacenamiento de las muestras de mecánica de suelos recepcionadas y/o ensayadas, será de 15 días corridos a partir de la fecha de emisión del informe. Posterior a este plazo las muestras serán desechadas. Si el cliente requiere que sean guardadas por un plazo posterior a lo indicado en este punto, deberá notificarlo por correo oportunamente al ingeniero de proyecto y se le enviará cotización por concepto de almacenamiento.'
    );
  }
  condY += 1.5;

  // Section 4: Confidencialidad
  renderSectionHeader('Confidencialidad del servicio:');
  renderParagraph(
    'Toda la información obtenida o creada durante o con ocasión de la prestación del servicio, tiene carácter confidencial, por lo cual no será revelada a terceras partes sin el consentimiento escrito del cliente. Cuando sea requerido por ley o autorizado por las disposiciones contractuales, para revelar información confidencial, IDIEM notificará al cliente o la persona interesada, salvo que esté prohibido por ley.'
  );
  renderParagraph(
    'La información acerca del cliente, obtenida de fuentes diferentes del cliente, será tratada de forma confidencial por el laboratorio. El proveedor fuente de esta información, se mantendrá como confidencial por el laboratorio y no se compartirá con el cliente a menos que se haya acordado con la fuente.'
  );

  // ==========================================
  // Bloque de Firma y Emisor Comercial (Final de Condiciones Generales y Especiales del Servicio)
  // Posicionado en el lado DERECHO de la página, con todo el texto centrado respecto a la línea de firma.
  // ==========================================
  condY += 6;
  const estimatedSigHeight = 46;
  if (condY + estimatedSigHeight > maxContentY) {
    doc.addPage();
    condY = 28;
  }

  const sigBlockWidth = 72; // Ancho de la línea de firma
  const sigStartX = pageWidth - marginX - sigBlockWidth; // Alineado al margen derecho
  const sigCenterX = sigStartX + sigBlockWidth / 2; // Punto central para imagen y textos

  // Renderizar firma digital si el emisor la proporcionó
  const hasValidSignature = !!(
    cotizacion.commercialSignature &&
    cotizacion.commercialSignature.length > 200 &&
    cotizacion.commercialSignature.startsWith('data:image/')
  );

  if (hasValidSignature) {
    try {
      const dims = getBase64ImageDimensions(cotizacion.commercialSignature!);
      let drawW = 38;
      let drawH = 22;
      if (dims && dims.width > 0 && dims.height > 0) {
        const aspect = dims.width / dims.height;
        const maxW = 42;
        const maxH = 24;
        if (aspect > maxW / maxH) {
          drawW = maxW;
          drawH = drawW / aspect;
        } else {
          drawH = maxH;
          drawW = drawH * aspect;
        }
      }
      const imgX = sigCenterX - drawW / 2;
      const imgFormat =
        cotizacion.commercialSignature!.startsWith('data:image/jpeg') ||
        cotizacion.commercialSignature!.startsWith('data:image/jpg')
          ? 'JPEG'
          : 'PNG';
      doc.addImage(cotizacion.commercialSignature!, imgFormat, imgX, condY, drawW, drawH);
      condY += drawH + 1.5;
    } catch (err) {
      console.warn('Could not add signature image to PDF:', err);
      condY += 15;
    }
  } else {
    condY += 16;
  }

  // Línea de firma (centrada en el bloque derecho)
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.35);
  doc.line(sigStartX, condY, sigStartX + sigBlockWidth, condY);
  condY += 3.8;

  // Nombre, Cargo, Institución - TODOS CENTRADOS RESPECTO A LA FIRMA
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(20, 20, 20);
  doc.text(cotizacion.commercialName || 'Diego Román Araneda', sigCenterX, condY, { align: 'center' });
  condY += 3.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(70, 70, 70);
  doc.text(cotizacion.commercialTitle || 'Asesor Comercial DGL', sigCenterX, condY, { align: 'center' });
  condY += 3.0;

  doc.text(formato.divisionTitle || 'División Geotecnia Laboratorio', sigCenterX, condY, { align: 'center' });
  condY += 3.0;
  doc.text('IDIEM - Universidad de Chile', sigCenterX, condY, { align: 'center' });

  // =========================================================
  // 9. ENCABEZADO Y PIE DE PÁGINA EN CADA PÁGINA (Según formato institucional)
  // =========================================================
  const totalPages = doc.getNumberOfPages();

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // 9.0 Marca de agua diagonal semitransparente para presupuestos en borrador
    if (isDraft) {
      try {
        doc.saveGraphicsState();
        const docWithGState = doc as unknown as {
          GState?: new (opts: { opacity: number }) => unknown;
          setGState?: (state: unknown) => void;
        };
        if (docWithGState.GState && docWithGState.setGState) {
          docWithGState.setGState(new docWithGState.GState({ opacity: 0.12 }));
        }
        doc.setTextColor(190, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(38);
        doc.text('BORRADOR - NO OFICIAL', pageWidth / 2, pageHeight / 2 + 10, {
          align: 'center',
          angle: 35,
        });
        doc.restoreGraphicsState();
      } catch {
        doc.setTextColor(225, 205, 205);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(36);
        doc.text('BORRADOR - NO OFICIAL', pageWidth / 2, pageHeight / 2 + 10, {
          align: 'center',
          angle: 35,
        });
      }
    }

    // 9.1. Logotipo IDIEM en la esquina superior izquierda de cada página
    const effectiveLogo = formato.headerImage || logoBase64;
    if (effectiveLogo) {
      try {
        const imgFormat = effectiveLogo.startsWith('data:image/jpeg') || effectiveLogo.startsWith('data:image/jpg')
          ? 'JPEG'
          : 'PNG';
        // Dimensiones del logo: 38 mm ancho x 16.2 mm alto
        doc.addImage(effectiveLogo, imgFormat, marginX, 7, 38, 16.2);
      } catch (err) {
        console.warn('Could not draw logo on page', p, err);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(226, 0, 0);
        doc.text('idiem', marginX, 15);
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('125 años', marginX + 15, 15);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(226, 0, 0);
      doc.text('idiem', marginX, 15);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('125 años', marginX + 15, 15);
    }

    // 9.1.1 Encabezado superior derecho en páginas 2 en adelante para mantener identidad y trazabilidad
    if (p > 1) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(displayCode, pageWidth - marginX, 12, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`Fecha: ${dateFormatted}`, pageWidth - marginX, 16.5, { align: 'right' });
      if (cotizacion.city) {
        doc.text(`Sede: ${cotizacion.city}`, pageWidth - marginX, 21, { align: 'right' });
      }
    }

    // 9.2. Línea divisoria superior del pie de página para delimitar claramente el contenido
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 16, pageWidth - marginX, pageHeight - 16);

    // 9.3. Pie de página en tres columnas institucionales
    const footerBaseY = pageHeight - 13.5;

    doc.setFontSize(6.8);
    doc.setTextColor(60, 60, 60);

    // Columna izquierda: Oficina central
    doc.setFont('helvetica', 'bold');
    doc.text(formato.officeTitle || 'Oficina central', marginX, footerBaseY);
    doc.setFont('helvetica', 'normal');
    doc.text(
      formato.officeAddress || 'Plaza Ercilla 883, Santiago, Chile',
      marginX,
      footerBaseY + 3.4
    );

    // Columna central: Contacto
    doc.setFont('helvetica', 'normal');
    const phoneDisplay = formato.contactPhone.toLowerCase().startsWith('tel')
      ? formato.contactPhone
      : `Teléfono: ${formato.contactPhone}`;
    const emailDisplay = formato.contactEmail.toLowerCase().startsWith('correo')
      ? formato.contactEmail
      : `Correo electrónico: ${formato.contactEmail}`;

    doc.text(phoneDisplay, pageWidth / 2, footerBaseY, { align: 'center' });
    doc.text(emailDisplay, pageWidth / 2, footerBaseY + 3.4, { align: 'center' });

    // www.idiem.cl en rojo oficial IDIEM
    doc.setTextColor(226, 0, 0); // #E20000
    doc.setFont('helvetica', 'bold');
    doc.text(formato.contactWeb || 'www.idiem.cl', pageWidth / 2, footerBaseY + 6.8, {
      align: 'center',
    });

    // Columna derecha: Código de formato y número de página
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(formato.formatCode || 'DGL-FA-193 V3', pageWidth - marginX, footerBaseY, {
      align: 'right',
    });
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - marginX, footerBaseY + 3.4, {
      align: 'right',
    });

    // 9.3. Barra inferior oscura en todo el ancho de página
    doc.setFillColor(26, 26, 26); // #1A1A1A
    doc.rect(0, pageHeight - 3.8, pageWidth, 3.8, 'F');
  }

  return doc;
}
