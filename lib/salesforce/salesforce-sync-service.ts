import { Cotizacion, getDGLInfoByCC } from '@/lib/types';
import { getValidSalesforceClient } from './salesforce-client';
import { generateCotizacionPdf } from '@/lib/pdf-generator';
import { getFormatoSettingsAsync } from '@/lib/configuracion-db';
import { saveCotizacionAsync } from '@/lib/cotizaciones-db';
import fs from 'fs';
import path from 'path';

export interface SalesforceSyncResult {
  success: boolean;
  message: string;
  opportunityId?: string;
  opportunityUrl?: string;
  quoteId?: string;
  quoteUrl?: string;
  contentDocumentId?: string;
  syncedQuoteApplied?: boolean;
}

/**
 * Realiza una llamada HTTP REST a la API de Salesforce
 */
async function sfRequest(
  instanceUrl: string,
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const url = `${instanceUrl.replace(/\/$/, '')}/services/data/v59.0/${endpoint.replace(/^\//, '')}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  
  if (!res.ok) {
    const errorText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = errorText;
    }
    const errMsg = Array.isArray(parsed) && parsed[0]?.message ? parsed[0].message : JSON.stringify(parsed);
    throw new Error(`Error en API de Salesforce (${res.status}): ${errMsg}`);
  }

  // Si es 204 No Content
  if (res.status === 204) return null;

  return res.json();
}

/**
 * Busca o vincula una Cuenta (Account) por RUT o Nombre en Salesforce
 */
async function findOrCreateAccount(
  instanceUrl: string,
  accessToken: string,
  clientName: string,
  clientRut?: string
): Promise<string | null> {
  try {
    const cleanName = (clientName || '').replace(/'/g, "\\'").trim();
    if (!cleanName) return null;

    // Buscar si existe por Nombre
    const query = encodeURIComponent(`SELECT Id, Name FROM Account WHERE Name LIKE '%${cleanName.slice(0, 30)}%' LIMIT 1`);
    const searchRes = await sfRequest(instanceUrl, accessToken, `query?q=${query}`);

    if (searchRes?.records && searchRes.records.length > 0) {
      return searchRes.records[0].Id;
    }

    // Si no existe, intentar crear una Cuenta básica
    try {
      const createRes = await sfRequest(instanceUrl, accessToken, 'sobjects/Account', {
        method: 'POST',
        body: JSON.stringify({
          Name: clientName,
          Description: clientRut ? `RUT: ${clientRut}` : 'Creado automáticamente desde Cotizador DGL',
        }),
      });
      if (createRes?.id) return createRes.id;
    } catch (createErr) {
      console.warn('No se pudo crear Account automáticamente en Salesforce, continuando sin AccountId:', createErr);
    }
  } catch (err) {
    console.warn('Error buscando Account en Salesforce:', err);
  }
  return null;
}

/**
 * Obtiene la etapa (StageName) por defecto de Oportunidades en la organización
 */
async function getDefaultStageName(instanceUrl: string, accessToken: string): Promise<string> {
  try {
    const desc = await sfRequest(instanceUrl, accessToken, 'sobjects/Opportunity/describe');
    const stageField = desc?.fields?.find((f: any) => f.name === 'StageName');
    if (stageField?.picklistValues && stageField.picklistValues.length > 0) {
      // Buscar alguna etapa de cotización / propuesta
      const cotizStage = stageField.picklistValues.find((p: any) => 
        p.active && /cotiz|propuest|prospect|evalua/i.test(p.value || p.label)
      );
      if (cotizStage) return cotizStage.value;
      
      const firstActive = stageField.picklistValues.find((p: any) => p.active);
      if (firstActive) return firstActive.value;
    }
  } catch (e) {
    console.warn('No se pudo describir StageName de Opportunity:', e);
  }
  return 'Propuesta / Cotización';
}

/**
 * Construye el nombre unificado estricto para Oportunidad y Cotización (Quote):
 * PR.DGL.CCCC.2026.XXXX[-VN] - NOMBRE CLIENTE - NOMBRE PROPUESTA
 */
export function buildUnifiedSalesforceName(cotizacion: Cotizacion, unitCode: string): string {
  const cleanCode = (cotizacion.code || '').replace(/[\[\]]/g, '').trim();
  let correlativoNum = '0001';

  // Buscar número de 4 dígitos y sufijo de versión si existe
  const match = cleanCode.match(/(\d{4})(-V\d+)?$/i);
  if (match) {
    const numPart = match[1];
    const versionPart = match[2] && match[2].toUpperCase() !== '-V1' ? match[2].toUpperCase() : '';
    correlativoNum = `${numPart}${versionPart}`;
  } else {
    const anyNumMatch = cleanCode.match(/\.(\d+)(-V\d+)?$/i);
    if (anyNumMatch) {
      const numPart = anyNumMatch[1].padStart(4, '0');
      const versionPart = anyNumMatch[2] && anyNumMatch[2].toUpperCase() !== '-V1' ? anyNumMatch[2].toUpperCase() : '';
      correlativoNum = `${numPart}${versionPart}`;
    }
  }

  const prefix = `PR.DGL.${unitCode}.2026.${correlativoNum}`;
  const client = (cotizacion.clientName || 'Cliente').replace(/[\[\]]/g, '').trim();
  const project = (cotizacion.projectName || cotizacion.clientName || 'Propuesta').replace(/[\[\]]/g, '').trim();

  return `${prefix} - ${client} - ${project}`.slice(0, 120);
}

/**
 * Diccionario oficial de PricebookEntries de Servicios Especiales por Centro de Costo / Unidad DGL
 * en Standard Price Book (01sf4000003UUHYAA4) de Salesforce
 */
const DGL_PBE_BY_UNIT: Record<
  string,
  { pricebookEntryId: string; product2Id: string; pricebook2Id: string; sku: string }
> = {
  '2340': {
    pricebook2Id: '01sf4000003UUHYAA4',
    pricebookEntryId: '01uf400000GVf4yAAD',
    product2Id: '01tf4000003mbfWAAQ',
    sku: '23400259', // 2340 UEB - Unidad Ensayos Básicos
  },
  '1817': {
    pricebook2Id: '01sf4000003UUHYAA4',
    pricebookEntryId: '01u5G00000LtKHxQAN',
    product2Id: '01t5G000005EeBsQAK',
    sku: '18170002', // 1817 UGB - Unidad Ensayos Geotécnicos Básicos
  },
  '2339': {
    pricebook2Id: '01sf4000003UUHYAA4',
    pricebookEntryId: '01uf400000L4mr7AAB',
    product2Id: '01tf4000004CKlbAAG',
    sku: '23390101', // 2339 UER - Unidad Ensayos Rocas
  },
  '2341': {
    pricebook2Id: '01sf4000003UUHYAA4',
    pricebookEntryId: '01uf400000L4mqxAAB',
    product2Id: '01tf4000004CKlWAAW',
    sku: '23410014', // 2341 UGE - Unidad Ensayos Geotécnicos Especiales
  },
  '3340': {
    pricebook2Id: '01sf4000003UUHYAA4',
    pricebookEntryId: '01u5G00000LtKHtQAN',
    product2Id: '01t5G000005EeBiQAK',
    sku: '33400001', // 3340 USM - Unidad Sondajes Menores
  },
  '2344': {
    pricebook2Id: '01sf4000003UUHYAA4',
    pricebookEntryId: '01uPk000001r2XnIAI',
    product2Id: '01tPk000009Sf7tIAC',
    sku: '23440001', // 2344 UGA - Unidad Geotecnia Antofagasta
  },
};

/**
 * Obtiene la Entrada de Lista de Precios (PricebookEntry) para "Servicios Especiales" en Standard Price Book
 */
async function getServiciosEspecialesPricebookEntry(
  instanceUrl: string,
  accessToken: string,
  unitCode: string
): Promise<{ pricebookEntryId: string; product2Id: string; pricebook2Id: string }> {
  // 1. Verificación directa en el mapa verificado por CC
  if (DGL_PBE_BY_UNIT[unitCode]) {
    return DGL_PBE_BY_UNIT[unitCode];
  }

  // 2. Consulta dinámica por si la unidad no está en el mapa estático
  try {
    const query = encodeURIComponent(
      `SELECT Id, Pricebook2Id, Product2Id, Product2.ProductCode, Product2.Name FROM PricebookEntry WHERE Pricebook2.IsStandard = true AND Product2.Name LIKE '%Servicios Especiales%' AND (Product2.ProductCode LIKE '${unitCode}%' OR Product2.ProductCode = '23400259') AND IsActive = true LIMIT 1`
    );
    const res = await sfRequest(instanceUrl, accessToken, `query?q=${query}`);
    if (res?.records && res.records.length > 0) {
      const rec = res.records[0];
      return {
        pricebookEntryId: rec.Id,
        product2Id: rec.Product2Id,
        pricebook2Id: rec.Pricebook2Id,
      };
    }
  } catch (err) {
    console.warn('Aviso buscando PricebookEntry dinámica, usando fallback Standard:', err);
  }

  return DGL_PBE_BY_UNIT['2340'];
}

/**
 * Orquestador principal de sincronización hacia Salesforce
 */
export async function syncCotizacionToSalesforce(cotizacion: Cotizacion): Promise<SalesforceSyncResult> {
  // 0. Validaciones de negocio IDIEM
  // Regla A: No permitir Borradores
  if (cotizacion.status === 'Borrador') {
    throw new Error(
      `La cotización ${cotizacion.code} se encuentra en estado "Borrador". Debe cambiar el estado a "Finalizada" antes de enviarla a Salesforce.`
    );
  }

  // 1. Obtener cliente activo y autenticado
  const { accessToken, instanceUrl } = await getValidSalesforceClient();

  // 2. Determinar monto y moneda
  let amount = 0;
  if (cotizacion.currency === 'USD') {
    amount = cotizacion.totalUsd || 0;
  } else if (cotizacion.currency === 'CLP') {
    amount = cotizacion.totalClp || 0;
  } else {
    // Si la cotización está en UF, usar el equivalente en CLP o UF
    amount = cotizacion.totalClp || Math.round((cotizacion.totalUf || 0) * (cotizacion.ufValue || 40000));
  }

  // 3. Fecha probable de cierre (fecha cotización + 30 días)
  const baseDate = cotizacion.date ? new Date(cotizacion.date) : new Date();
  const closeDateObj = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const closeDate = closeDateObj.toISOString().slice(0, 10);

  // 4. Buscar o crear Account
  const accountId = await findOrCreateAccount(
    instanceUrl,
    accessToken,
    cotizacion.clientName,
    cotizacion.clientRut
  );

  // 5. Determinar unidad y sección oficial IDIEM
  const dglInfo = getDGLInfoByCC(cotizacion.centroCosto || cotizacion.code || '2340');
  const unitCode = dglInfo.unitCode;

  // Determinar código API para Seccion__c ('SLG' | 'SLGP' | 'DGL')
  let seccionSfCode = dglInfo.seccionSfCode;
  if (cotizacion.seccion) {
    if (cotizacion.seccion.includes('Sin sección') || cotizacion.seccion === 'DGL') {
      seccionSfCode = 'DGL';
    } else if (cotizacion.seccion.includes('SLGP') || cotizacion.seccion.includes('Geomecánico Prat')) {
      seccionSfCode = 'SLGP';
    } else if (cotizacion.seccion.includes('SGL') || cotizacion.seccion.includes('Geotecnia')) {
      seccionSfCode = 'SLG';
    }
  }

  // 6. Obtener nombre unificado y lista de precios oficial Standard
  const unifiedName = buildUnifiedSalesforceName(cotizacion, unitCode);
  const standardPricebook = await getServiciosEspecialesPricebookEntry(instanceUrl, accessToken, unitCode);
  const ufTotal = cotizacion.totalUf || (cotizacion.ufValue ? Number((amount / cotizacion.ufValue).toFixed(2)) : 0);

  const isUpdate = Boolean(cotizacion.salesforceOpportunityId);
  let opportunityId: string | undefined = cotizacion.salesforceOpportunityId;
  let opportunityUrl: string | undefined = cotizacion.salesforceOpportunityUrl;
  let quoteId: string | undefined = cotizacion.salesforceQuoteId;
  let quoteUrl: string | undefined = cotizacion.salesforceQuoteUrl;

  if (isUpdate && opportunityId) {
    // =========================================================================
    // MODO ACTUALIZACIÓN: Sobrescribir Opportunity, Quote y QuoteLineItem existentes
    // =========================================================================
    opportunityUrl = `${instanceUrl}/lightning/r/Opportunity/${opportunityId}/view`;

    // 7A. PATCH a Opportunity existente
    const oppUpdatePayload: Record<string, any> = {
      Name: unifiedName,
      CloseDate: closeDate,
      Amount: amount,
      Division__c: 'DGL',
      Seccion__c: seccionSfCode,
      Unidad__c: unitCode,
      Tipo_de_servicio_por_CC__c: 'Ensayos',
      Sector_del_Proyecto__c: cotizacion.sectorProyecto || 'Inmobiliario',
      Subsector_del_Proyecto__c: cotizacion.subsectorProyecto || 'No Aplica',
      Zona_Proyecto__c: cotizacion.zonaProyecto || 'Región Metropolitana',
      Description: `Cotización IDIEM: ${cotizacion.code}\nCliente: ${cotizacion.clientName}\nProyecto: ${cotizacion.projectName || 'Sin especificar'}\nCentro de Costo: ${cotizacion.centroCosto || unitCode}\nTotal: ${amount} (${cotizacion.currency || 'UF'})`,
    };

    if (accountId) {
      oppUpdatePayload.AccountId = accountId;
    }

    await sfRequest(instanceUrl, accessToken, `sobjects/Opportunity/${opportunityId}`, {
      method: 'PATCH',
      body: JSON.stringify(oppUpdatePayload),
    });
    console.log(`✓ Oportunidad existente ${opportunityId} actualizada con nombre: ${unifiedName}`);

    // 8A. Localizar o actualizar Quote existente
    if (!quoteId) {
      try {
        const qQuery = encodeURIComponent(`SELECT Id FROM Quote WHERE OpportunityId = '${opportunityId}' LIMIT 1`);
        const qQueryRes = await sfRequest(instanceUrl, accessToken, `query?q=${qQuery}`);
        if (qQueryRes?.records && qQueryRes.records.length > 0) {
          quoteId = qQueryRes.records[0].Id;
        }
      } catch (err) {
        console.warn('Aviso buscando Quote existente en Salesforce:', err);
      }
    }

    if (quoteId) {
      quoteUrl = `${instanceUrl}/lightning/r/Quote/${quoteId}/view`;
      try {
        // Actualizar nombre y vigencia de la Cotización oficial en Salesforce
        await sfRequest(instanceUrl, accessToken, `sobjects/Quote/${quoteId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            Name: unifiedName,
            ExpirationDate: closeDate,
            Description: `Actualizado desde Cotizador DGL IDIEM. Correlativo: ${cotizacion.code}`,
          }),
        });
        console.log(`✓ Quote ${quoteId} actualizado con nombre: ${unifiedName}`);

        // Actualizar el servicio (QuoteLineItem) con el nuevo monto de UF y cantidad 1
        // Salesforce calcula CLP por defecto
        const qliQuery = encodeURIComponent(
          `SELECT Id, Quantity, Precio_del_Servicio_UF__c FROM QuoteLineItem WHERE QuoteId = '${quoteId}' LIMIT 1`
        );
        const qliRes = await sfRequest(instanceUrl, accessToken, `query?q=${qliQuery}`);
        if (qliRes?.records && qliRes.records.length > 0) {
          const qliId = qliRes.records[0].Id;
          await sfRequest(instanceUrl, accessToken, `sobjects/QuoteLineItem/${qliId}`, {
            method: 'PATCH',
            body: JSON.stringify({
              Quantity: 1,
              Precio_del_Servicio_UF__c: ufTotal,
            }),
          });
          console.log(`✓ QuoteLineItem ${qliId} actualizado con UF: ${ufTotal} y Cantidad: 1`);
        } else {
          // Si no existía línea, crearla
          await sfRequest(instanceUrl, accessToken, 'sobjects/QuoteLineItem', {
            method: 'POST',
            body: JSON.stringify({
              QuoteId: quoteId,
              PricebookEntryId: standardPricebook.pricebookEntryId,
              Product2Id: standardPricebook.product2Id,
              Quantity: 1,
              UnitPrice: amount,
              Precio_del_Servicio_UF__c: ufTotal,
              IsLast__c: true,
            }),
          });
        }
      } catch (qUpdateErr: any) {
        console.warn('Aviso actualizando Quote o QuoteLineItem en Salesforce:', qUpdateErr?.message);
      }
    } else {
      // Si la Oportunidad no tenía Quote aún, crearla
      try {
        const quotePayload: Record<string, any> = {
          OpportunityId: opportunityId,
          Name: unifiedName,
          Pricebook2Id: standardPricebook.pricebook2Id,
          ExpirationDate: closeDate,
          Status: 'Presentada',
          Description: `Generado desde Cotizador DGL IDIEM. Correlativo: ${cotizacion.code}`,
        };
        const quoteRes = await sfRequest(instanceUrl, accessToken, 'sobjects/Quote', {
          method: 'POST',
          body: JSON.stringify(quotePayload),
        });
        if (quoteRes?.id) {
          quoteId = quoteRes.id;
          quoteUrl = `${instanceUrl}/lightning/r/Quote/${quoteId}/view`;
          await sfRequest(instanceUrl, accessToken, 'sobjects/QuoteLineItem', {
            method: 'POST',
            body: JSON.stringify({
              QuoteId: quoteId,
              PricebookEntryId: standardPricebook.pricebookEntryId,
              Product2Id: standardPricebook.product2Id,
              Quantity: 1,
              UnitPrice: amount,
              Precio_del_Servicio_UF__c: ufTotal,
              IsLast__c: true,
            }),
          });
        }
      } catch (createQErr: any) {
        console.warn('Aviso creando Quote en modo actualización:', createQErr?.message);
      }
    }
  } else {
    // =========================================================================
    // MODO CREACIÓN: Nueva Oportunidad, Quote y QuoteLineItem
    // =========================================================================
    const requestDate = (cotizacion.date ? new Date(cotizacion.date) : new Date()).toISOString().slice(0, 10);
    const oppPayload: Record<string, any> = {
      Name: unifiedName,
      CloseDate: closeDate,
      Fecha_de_la_Solicitud__c: requestDate,
      StageName: 'Elaboración',
      RecordTypeId: '012f4000000OfXyAAK',
      Pricebook2Id: standardPricebook.pricebook2Id,
      Division__c: 'DGL',
      Seccion__c: seccionSfCode,
      Unidad__c: unitCode,
      Tipo_de_servicio_por_CC__c: 'Ensayos',
      Sector_del_Proyecto__c: cotizacion.sectorProyecto || 'Inmobiliario',
      Subsector_del_Proyecto__c: cotizacion.subsectorProyecto || 'No Aplica',
      Zona_Proyecto__c: cotizacion.zonaProyecto || 'Región Metropolitana',
      LeadSource: 'Directo División',
      Amount: amount,
      Description: `Cotización IDIEM: ${cotizacion.code}\nCliente: ${cotizacion.clientName}\nProyecto: ${cotizacion.projectName || 'Sin especificar'}\nCentro de Costo: ${cotizacion.centroCosto || unitCode}\nTotal: ${amount} (${cotizacion.currency || 'UF'})`,
    };

    if (accountId) {
      oppPayload.AccountId = accountId;
    }

    const oppRes = await sfRequest(instanceUrl, accessToken, 'sobjects/Opportunity', {
      method: 'POST',
      body: JSON.stringify(oppPayload),
    });

    if (!oppRes?.id) {
      throw new Error('Salesforce no retornó un Id al crear la Oportunidad.');
    }

    opportunityId = oppRes.id;
    opportunityUrl = `${instanceUrl}/lightning/r/Opportunity/${opportunityId}/view`;

    // 8B. PASO 2: Crear la Cotización (POST a Quote) con el MISMO nombre
    try {
      const quotePayload: Record<string, any> = {
        OpportunityId: opportunityId,
        Name: unifiedName,
        Pricebook2Id: standardPricebook.pricebook2Id,
        ExpirationDate: closeDate,
        Status: cotizacion.status === 'Finalizada' ? 'Presentada' : 'Borrador',
        Description: `Generado desde Cotizador DGL IDIEM. Correlativo: ${cotizacion.code}`,
      };

      const quoteRes = await sfRequest(instanceUrl, accessToken, 'sobjects/Quote', {
        method: 'POST',
        body: JSON.stringify(quotePayload),
      });

      if (quoteRes?.id) {
        quoteId = quoteRes.id;
        quoteUrl = `${instanceUrl}/lightning/r/Quote/${quoteId}/view`;

        // PASO 2.1: Crear el Servicio Cotización (QuoteLineItem) con Servicios Especiales
        try {
          const qliPayload: Record<string, any> = {
            QuoteId: quoteId,
            PricebookEntryId: standardPricebook.pricebookEntryId,
            Product2Id: standardPricebook.product2Id,
            Quantity: 1,
            UnitPrice: amount,
            Precio_del_Servicio_UF__c: ufTotal,
            IsLast__c: true,
          };

          await sfRequest(instanceUrl, accessToken, 'sobjects/QuoteLineItem', {
            method: 'POST',
            body: JSON.stringify(qliPayload),
          });
          console.log('✓ QuoteLineItem Servicios Especiales agregado exitosamente a Quote en Salesforce.');
        } catch (qliErr: any) {
          console.warn('Aviso: No se pudo agregar QuoteLineItem a Quote en Salesforce:', qliErr?.message);
        }
      }
    } catch (quoteErr: any) {
      console.warn('Aviso: No se pudo crear el objeto Quote, adjuntando directo a Opportunity:', quoteErr?.message);
    }
  }

  // 8. PASO 3: Generar PDF en memoria y convertir a Base64
  let base64Pdf = '';
  try {
    const formato = await getFormatoSettingsAsync();
    let logoBase64: string | undefined = formato.headerImage;
    if (!logoBase64) {
      try {
        if (typeof process !== 'undefined' && process.cwd) {
          const logoPath = path.join(process.cwd(), 'public', 'logo_125.png');
          if (fs.existsSync(logoPath)) {
            const raw = fs.readFileSync(logoPath);
            logoBase64 = `data:image/png;base64,${raw.toString('base64')}`;
          }
        }
      } catch (fsErr) {
        console.warn('No se pudo leer logo_125.png desde disco local:', fsErr);
      }
    }

    const doc = generateCotizacionPdf(cotizacion, logoBase64, formato, {
      isDraft: false,
      showEconomicIndicators: cotizacion.showEconomicIndicators !== false,
    });

    const pdfArrayBuffer = doc.output('arraybuffer');
    const buffer = Buffer.from(pdfArrayBuffer);
    base64Pdf = buffer.toString('base64');
  } catch (pdfErr) {
    console.error('Error generando PDF para Salesforce:', pdfErr);
  }

  // 9. PASO 4: Subir archivo PDF (ContentVersion)
  let contentDocumentId: string | undefined;
  if (base64Pdf) {
    try {
      const cleanFilename = `Cotizacion_${cotizacion.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const contentVersionRes = await sfRequest(instanceUrl, accessToken, 'sobjects/ContentVersion', {
        method: 'POST',
        body: JSON.stringify({
          Title: `Cotización ${cotizacion.code}`,
          PathOnClient: cleanFilename,
          VersionData: base64Pdf,
          FirstPublishLocationId: quoteId || opportunityId, // Adjuntar automáticamente a Quote o a Opportunity
        }),
      });

      if (contentVersionRes?.id) {
        // Consultar el ContentDocumentId generado por Salesforce
        try {
          const cvQuery = encodeURIComponent(`SELECT ContentDocumentId FROM ContentVersion WHERE Id = '${contentVersionRes.id}' LIMIT 1`);
          const cvQueryRes = await sfRequest(instanceUrl, accessToken, `query?q=${cvQuery}`);
          if (cvQueryRes?.records && cvQueryRes.records.length > 0) {
            contentDocumentId = cvQueryRes.records[0].ContentDocumentId;

            // PASO 5: Vincular explícitamente a Quote y a Opportunity mediante ContentDocumentLink si es necesario
            if (contentDocumentId && quoteId) {
              try {
                await sfRequest(instanceUrl, accessToken, 'sobjects/ContentDocumentLink', {
                  method: 'POST',
                  body: JSON.stringify({
                    ContentDocumentId: contentDocumentId,
                    LinkedEntityId: opportunityId,
                    ShareType: 'V',
                    Visibility: 'AllUsers',
                  }),
                });
              } catch {
                // Si ya está vinculado, ignorar
              }
            }
          }
        } catch (cvErr) {
          console.warn('Aviso: ContentDocumentId no pudo ser consultado de vuelta:', cvErr);
        }
      }
    } catch (uploadErr) {
      console.warn('Error subiendo PDF a ContentVersion en Salesforce:', uploadErr);
    }
  }

  // 10. PASO 6: Actualizar etapa de Oportunidad a 'Propuesta/Cotización Enviada' y sincronizar Cotización
  let syncedQuoteApplied = false;
  try {
    const patchPayload: Record<string, any> = {
      StageName: 'Propuesta/Cotización Enviada',
    };
    if (quoteId) {
      patchPayload.SyncedQuoteId = quoteId;
    }
    await sfRequest(instanceUrl, accessToken, `sobjects/Opportunity/${opportunityId}`, {
      method: 'PATCH',
      body: JSON.stringify(patchPayload),
    });
    syncedQuoteApplied = true;
  } catch (syncErr: any) {
    console.warn('Aviso: Error aplicando SyncedQuoteId o StageName en Opportunity:', syncErr?.message);
    try {
      await sfRequest(instanceUrl, accessToken, `sobjects/Opportunity/${opportunityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ StageName: 'Propuesta/Cotización Enviada' }),
      });
    } catch {}
  }

  // 11. PASO 7: Guardar los IDs de Salesforce en la base de datos de Cotizaciones
  try {
    const updatedStatus = cotizacion.status === 'Finalizada' ? 'Enviada' : cotizacion.status;
    await saveCotizacionAsync({
      ...cotizacion,
      status: updatedStatus,
      salesforceOpportunityId: opportunityId,
      salesforceOpportunityUrl: opportunityUrl,
      salesforceQuoteId: quoteId,
      salesforceQuoteUrl: quoteUrl,
      salesforceSyncedAt: new Date().toISOString(),
    });
  } catch (dbErr) {
    console.warn('No se pudo actualizar registro local con IDs de Salesforce:', dbErr);
  }

  return {
    success: true,
    message: isUpdate
      ? `Cotización y Oportunidad actualizadas con éxito en Salesforce (nombre, servicio UF y nuevo PDF sobrescritos sin duplicados).`
      : quoteId
      ? `Cotización cargada con éxito en Salesforce (Oportunidad y Quote enlazadas con PDF adjunto).`
      : `Oportunidad creada con éxito en Salesforce con PDF adjunto.`,
    opportunityId,
    opportunityUrl,
    quoteId,
    quoteUrl,
    contentDocumentId,
    syncedQuoteApplied,
  };
}

