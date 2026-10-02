/**
 * ==============================================================================
 * COTIZADOR DGL IDIEM - COMPLEMENTO DE GMAIL (GOOGLE WORKSPACE)
 * División Geotecnia y Laboratorio (DGL) - IDIEM Universidad de Chile
 * ==============================================================================
 */

// Endpoint oficial de producción desplegado en Cloudflare Workers
var API_ENDPOINT = 'https://dgl-cotizador.dr-desarrollos88.workers.dev/api/ai/inbound-email';
var API_SECRET_TOKEN = 'dgl_secret_workspace_2026';

/**
 * Función principal que se dispara automáticamente al abrir cualquier correo en Gmail.
 * Construye la interfaz visual en el panel lateral derecho.
 */
function buildAddOn(e) {
  var messageId = e.gmail.messageId;
  var message = GmailApp.getMessageById(messageId);
  var subject = message.getSubject() || 'Sin Asunto';
  var from = message.getFrom() || 'Desconocido';
  var attachments = message.getAttachments();
  var currentUserEmail = Session.getActiveUser().getEmail().toLowerCase();

  // Determinar analista por defecto según la sesión actual
  var isXimena = currentUserEmail.indexOf('ximena.garrido') !== -1;

  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('IDIEM DGL • Cotizador IA')
      .setSubtitle('División Geotecnia y Laboratorio')
      .setImageStyle(CardService.ImageStyle.SQUARE)
  );

  // Sección 1: Datos de la Solicitud
  var secCorreo = CardService.newCardSection().setHeader('📩 Solicitud del Cliente');
  
  secCorreo.addWidget(
    CardService.newKeyValue()
      .setTopLabel('De:')
      .setContent(from)
      .setMultiline(true)
  );

  secCorreo.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Asunto:')
      .setContent(subject)
      .setMultiline(true)
  );

  if (attachments && attachments.length > 0) {
    var names = [];
    for (var i = 0; i < attachments.length; i++) {
      names.push(attachments[i].getName());
    }
    secCorreo.addWidget(
      CardService.newKeyValue()
        .setTopLabel('📎 Adjuntos Detectados (' + attachments.length + '):')
        .setContent(names.slice(0, 3).join(', ') + (names.length > 3 ? '...' : ''))
        .setMultiline(true)
    );
  } else {
    secCorreo.addWidget(
      CardService.newTextParagraph().setText('ℹ️ No se detectaron archivos adjuntos. Se analizará el texto del correo.')
    );
  }
  card.addSection(secCorreo);

  // Sección 2: Configuración del Analista y Acción
  var secAccion = CardService.newCardSection().setHeader('👤 Asignación Comercial');

  var selectAnalista = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setTitle('Analista Responsable:')
    .setFieldName('analista_seleccionado');

  selectAnalista.addItem('Diego Román Araneda (diego.roman@idiem.cl)', 'diego.roman@idiem.cl', !isXimena);
  selectAnalista.addItem('Ximena Garrido (ximena.garrido@idiem.cl)', 'ximena.garrido@idiem.cl', isXimena);

  secAccion.addWidget(selectAnalista);

  var btnAction = CardService.newAction()
    .setFunctionName('onGenerarBorrador')
    .setParameters({ messageId: messageId });

  var btnGenerar = CardService.newTextButton()
    .setText('⚡ Crear Borrador en DGL')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#E20000')
    .setOnClickAction(btnAction);

  secAccion.addWidget(btnGenerar);
  card.addSection(secAccion);

  return card.build();
}

/**
 * Procesa el correo seleccionado, empaqueta el contenido y los archivos adjuntos,
 * e invoca a la IA en la plataforma DGL para crear el borrador oficial.
 */
function onGenerarBorrador(e) {
  var messageId = e.parameters.messageId;
  var message = GmailApp.getMessageById(messageId);
  var subject = message.getSubject() || '';
  var from = message.getFrom() || '';
  var bodyText = message.getPlainBody() || '';
  var attachments = message.getAttachments();

  // Obtener analista seleccionado en el formulario
  var formInputs = e.formInputs || {};
  var selectedAnalystEmail = 'diego.roman@idiem.cl';
  if (formInputs.analista_seleccionado && formInputs.analista_seleccionado.length > 0) {
    selectedAnalystEmail = formInputs.analista_seleccionado[0];
  }
  var selectedAnalystName = selectedAnalystEmail.indexOf('ximena') !== -1
    ? 'Ximena Garrido'
    : 'Diego Román Araneda';

  // Procesar adjuntos (límite de seguridad: hasta 15MB total)
  var processedAttachments = [];
  var totalBytes = 0;
  var MAX_BYTES = 14 * 1024 * 1024; // 14 MB

  if (attachments && attachments.length > 0) {
    for (var i = 0; i < attachments.length; i++) {
      var att = attachments[i];
      var size = att.getSize();
      if (totalBytes + size <= MAX_BYTES) {
        totalBytes += size;
        processedAttachments.push({
          filename: att.getName(),
          mimeType: att.getContentType(),
          base64: Utilities.base64Encode(att.getBytes())
        });
      }
    }
  }

  var payload = {
    senderEmail: extractEmail(from),
    senderName: extractName(from),
    analystEmail: selectedAnalystEmail,
    analystName: selectedAnalystName,
    subject: subject,
    bodyText: bodyText,
    attachments: processedAttachments
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-DGL-API-Key': API_SECRET_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(API_ENDPOINT, options);
    var status = response.getResponseCode();
    var responseText = response.getContentText();
    var data = JSON.parse(responseText);

    if (status === 200 && data.success) {
      return buildSuccessCard(data);
    } else {
      return buildErrorCard(data.error || 'Ocurrió un error inesperado al procesar la cotización.');
    }
  } catch (err) {
    return buildErrorCard('Error de conexión con la plataforma DGL: ' + err.toString());
  }
}

/**
 * Construye la tarjeta de éxito tras generar el borrador con enlace directo.
 */
function buildSuccessCard(data) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('✅ ¡Borrador Creado Exitosamente!')
      .setSubtitle(data.correlativo || 'PR.DGL Oficial')
      .setImageStyle(CardService.ImageStyle.SQUARE)
  );

  var secDetalle = CardService.newCardSection().setHeader('📊 Resumen de la Cotización');

  secDetalle.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Código Correlativo:')
      .setContent('<b>' + data.correlativo + '</b>')
  );

  secDetalle.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Cliente / Obra:')
      .setContent(data.clientName + ' • ' + data.projectName)
      .setMultiline(true)
  );

  secDetalle.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Monto Estimado:')
      .setContent('<b>' + data.totalUf + ' UF</b> (~$' + formatNumber(data.totalClp) + ' CLP)')
  );

  secDetalle.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Ensayos Detectados:')
      .setContent(data.itemsCount + ' ensayo(s) del Catálogo Oficial DGL')
  );

  secDetalle.addWidget(
    CardService.newKeyValue()
      .setTopLabel('Analista Comercial Asignado:')
      .setContent(data.analista)
  );

  if (data.enlacesDetectados && data.enlacesDetectados.length > 0) {
    secDetalle.addWidget(
      CardService.newKeyValue()
        .setTopLabel('🔗 Enlace Externo Detectado:')
        .setContent(data.enlacesDetectados[0])
        .setMultiline(true)
    );
  }

  // Botón de acceso directo a la plataforma
  var btnAbrir = CardService.newTextButton()
    .setText('🚀 Abrir y Editar en Cotizador DGL')
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setBackgroundColor('#0F172A')
    .setOpenLink(
      CardService.newOpenLink()
        .setUrl(data.urlDirecta)
        .setOpenAs(CardService.OpenAs.FULL_SIZE)
        .setOnClose(CardService.OnClose.NOTHING)
    );

  secDetalle.addWidget(btnAbrir);
  card.addSection(secDetalle);

  return card.build();
}

/**
 * Construye la tarjeta en caso de error o rechazo.
 */
function buildErrorCard(errorMsg) {
  var card = CardService.newCardBuilder();
  card.setHeader(
    CardService.newCardHeader()
      .setTitle('❌ Error al Crear Borrador')
      .setSubtitle('No se pudo completar la solicitud')
  );

  var sec = CardService.newCardSection();
  sec.addWidget(CardService.newTextParagraph().setText(errorMsg));

  card.addSection(sec);
  return card.build();
}

// ==================== UTILIDADES ====================

function extractEmail(fromStr) {
  var match = fromStr.match(/<([^>]+)>/);
  if (match) return match[1].trim();
  return fromStr.trim();
}

function extractName(fromStr) {
  var match = fromStr.match(/^([^<]+)/);
  if (match) return match[1].replace(/["']/g, '').trim();
  return fromStr.trim();
}

function formatNumber(num) {
  return (num || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
