import { Cotizacion } from '@/lib/types';
import { getValidSalesforceClient } from './salesforce-client';
import { generateCotizacionPdf } from '@/lib/pdf-generator';
import { getFormatoSettings, getUsers } from '@/lib/db';
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
 * Orquestador principal de sincronización hacia Salesforce
 */
export async function syncCotizacionToSalesforce(cotizacion: Cotizacion): Promise<SalesforceSyncResult> {
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

  // 5. Determinar unidad/centro de costo para IDIEM
  let unitCode = '2340';
  if (cotizacion.centroCosto) {
    const match = cotizacion.centroCosto.match(/^(\d{4})/);
    if (match) unitCode = match[1];
  } else if (cotizacion.code) {
    const match = cotizacion.code.match(/PR\.DGL\.(\d{4})/i);
    if (match) unitCode = match[1];
  }

  // 6. PASO 1: Crear la Oportunidad en etapa Elaboración con la cadena de dependencias oficial IDIEM
  const requestDate = (cotizacion.date ? new Date(cotizacion.date) : new Date()).toISOString().slice(0, 10);
  const oppPayload: Record<string, any> = {
    Name: `[${cotizacion.code}] ${cotizacion.projectName || cotizacion.clientName}`.slice(0, 120),
    CloseDate: closeDate,
    Fecha_de_la_Solicitud__c: requestDate,
    StageName: 'Elaboración',
    RecordTypeId: '012f4000000OfXyAAK',
    Division__c: 'DGL',
    Seccion__c: 'SLG',
    Unidad__c: unitCode,
    Tipo_de_servicio_por_CC__c: 'Ensayos',
    Subsector_del_Proyecto__c: 'No Aplica',
    Sector_del_Proyecto__c: 'Otros',
    Zona_Proyecto__c: 'Nacional',
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

  const opportunityId = oppRes.id;
  const opportunityUrl = `${instanceUrl}/lightning/r/Opportunity/${opportunityId}/view`;

  // 7. PASO 2: Crear la Cotización (POST a Quote)
  let quoteId: string | undefined;
  let quoteUrl: string | undefined;
  try {
    const quotePayload: Record<string, any> = {
      OpportunityId: opportunityId,
      Name: `Presupuesto ${cotizacion.code}`.slice(0, 120),
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
    }
  } catch (quoteErr: any) {
    console.warn('Aviso: No se pudo crear el objeto Quote (puede que no esté habilitado en esta org), adjuntando directo a Opportunity:', quoteErr?.message);
  }

  // 8. PASO 3: Generar PDF en memoria y convertir a Base64
  let base64Pdf = '';
  try {
    const formato = getFormatoSettings();
    let logoBase64: string | undefined = formato.headerImage;
    if (!logoBase64) {
      const logoPath = path.join(process.cwd(), 'public', 'logo_125.png');
      if (fs.existsSync(logoPath)) {
        const raw = fs.readFileSync(logoPath);
        logoBase64 = `data:image/png;base64,${raw.toString('base64')}`;
      }
    }

    const doc = generateCotizacionPdf(cotizacion, logoBase64, formato, {
      isDraft: cotizacion.status === 'Borrador',
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
    await saveCotizacionAsync({
      ...cotizacion,
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
    message: quoteId 
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

