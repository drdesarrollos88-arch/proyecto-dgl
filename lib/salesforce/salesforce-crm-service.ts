import { Cliente, Contacto } from '@/lib/types';
import { getValidSalesforceClient, getStoredSalesforceAuth } from './salesforce-client';
import { sfRequest } from './salesforce-sync-service';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos de caché en memoria

function getCached<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlMs = CACHE_TTL_MS): void {
  _cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

export function clearSalesforceCrmCache(): void {
  _cache.clear();
}

/**
 * Verifica si hay una sesión activa de Salesforce configurada
 */
export async function isSalesforceCrmAvailable(): Promise<boolean> {
  try {
    const auth = await getStoredSalesforceAuth();
    return !!(auth && (auth.accessToken || auth.refreshToken));
  } catch {
    return false;
  }
}

/**
 * Transforma un registro Account de Salesforce al formato Cliente oficial del sistema
 */
function mapAccountToCliente(r: any): Cliente {
  const name = r.Razon_Social__c || r.Name || 'Sin Razón Social';
  const addressParts = [r.BillingStreet, r.BillingCity].filter(Boolean);
  const address = addressParts.join(', ');

  return {
    id: r.Id,
    name,
    rut: r.RUT__c || '',
    comuna: r.BillingState || r.BillingCity || '',
    address,
    giro: r.Giro__c || '',
    phone: r.Phone || '',
    paymentCondition:
      r.Condicion_de_Pago__c ||
      r.Condici_n_de_Pago_empresa__c ||
      '50% AL CONTADO Y 50% CONTRA ENTREGA',
    email: r.E_mail__c || '',
    contactPerson: '',
    source: 'salesforce',
    salesforceAccountId: r.Id,
    createdAt: r.CreatedDate || new Date().toISOString(),
    updatedAt: r.LastModifiedDate || new Date().toISOString(),
  };
}

/**
 * Transforma un registro Contact de Salesforce al formato Contacto oficial del sistema
 */
function mapContactToContacto(r: any): Contacto {
  const fullName =
    r.Name ||
    [r.FirstName, r.LastName].filter(Boolean).join(' ') ||
    'Sin Nombre';

  return {
    id: r.Id,
    name: fullName,
    email: r.Email || '',
    phone: r.MobilePhone || r.Phone || '',
    company: r.Account?.Name || undefined,
    accountId: r.AccountId || undefined,
    cargo: r.Cargo__c || r.Title || undefined,
    source: 'salesforce',
    createdAt: r.CreatedDate || new Date().toISOString(),
    updatedAt: r.LastModifiedDate || new Date().toISOString(),
  };
}

/**
 * Busca Cuentas (Empresas / Clientes) directamente en Salesforce por término de búsqueda (Razón Social o RUT)
 */
export async function searchSalesforceAccounts(query = '', limit = 20): Promise<Cliente[]> {
  const cleanTerm = query.trim().replace(/'/g, "\\'");
  const cacheKey = `accounts_search_${cleanTerm.toLowerCase()}_${limit}`;

  const cached = getCached<Cliente[]>(cacheKey);
  if (cached) return cached;

  const client = await getValidSalesforceClient();

  let whereClause = "Name != null";
  if (cleanTerm) {
    whereClause += ` AND (Name LIKE '%${cleanTerm}%' OR Razon_Social__c LIKE '%${cleanTerm}%' OR RUT__c LIKE '%${cleanTerm}%')`;
  }

  const soql = `
    SELECT Id, Name, Razon_Social__c, RUT__c, BillingStreet, BillingCity, BillingState, Phone, E_mail__c, Giro__c, Condicion_de_Pago__c, Condici_n_de_Pago_empresa__c, CreatedDate, LastModifiedDate
    FROM Account
    WHERE ${whereClause}
    ORDER BY Name ASC
    LIMIT ${limit}
  `.replace(/\s+/g, ' ').trim();

  const res = await sfRequest(client.instanceUrl, client.accessToken, `query?q=${encodeURIComponent(soql)}`);
  const records = res?.records || [];
  const clientes = records.map(mapAccountToCliente);

  setCached(cacheKey, clientes);
  return clientes;
}

/**
 * Obtiene una Cuenta específica de Salesforce por su Id de 18 caracteres
 */
export async function getSalesforceAccountById(id: string): Promise<Cliente | null> {
  if (!id) return null;
  const cleanId = id.trim().replace(/'/g, "\\'");
  const cacheKey = `account_${cleanId}`;

  const cached = getCached<Cliente>(cacheKey);
  if (cached) return cached;

  const client = await getValidSalesforceClient();
  const soql = `
    SELECT Id, Name, Razon_Social__c, RUT__c, BillingStreet, BillingCity, BillingState, Phone, E_mail__c, Giro__c, Condicion_de_Pago__c, Condici_n_de_Pago_empresa__c, CreatedDate, LastModifiedDate
    FROM Account
    WHERE Id = '${cleanId}'
    LIMIT 1
  `.replace(/\s+/g, ' ').trim();

  const res = await sfRequest(client.instanceUrl, client.accessToken, `query?q=${encodeURIComponent(soql)}`);
  if (!res?.records || res.records.length === 0) return null;

  const cliente = mapAccountToCliente(res.records[0]);
  setCached(cacheKey, cliente);
  return cliente;
}

/**
 * Crea una Cuenta (Account) en Salesforce
 */
export async function createSalesforceAccount(cliente: Partial<Cliente>): Promise<Cliente> {
  const client = await getValidSalesforceClient();

  const name = (cliente.name || '').trim();
  if (!name) throw new Error('El nombre de la empresa es obligatorio.');

  const body: Record<string, any> = {
    Name: name,
    Description: 'Registrado desde el Cotizador IDIEM DGL',
  };

  if (cliente.rut) {
    body.RUT__c = cliente.rut.trim();
  }
  if (cliente.name) {
    body.Razon_Social__c = cliente.name.trim();
  }
  if (cliente.address) {
    body.BillingStreet = cliente.address.trim();
  }
  if (cliente.comuna) {
    body.BillingState = cliente.comuna.trim();
    body.BillingCity = cliente.comuna.trim();
  }
  if (cliente.phone) {
    body.Phone = cliente.phone.trim();
  }
  if (cliente.email) {
    body.E_mail__c = cliente.email.trim();
  }
  if (cliente.giro) {
    body.Giro__c = cliente.giro.trim();
  }
  if (cliente.paymentCondition) {
    body.Condicion_de_Pago__c = cliente.paymentCondition.trim();
  }

  const res = await sfRequest(client.instanceUrl, client.accessToken, 'sobjects/Account', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  clearSalesforceCrmCache();

  return {
    id: res.id,
    name,
    rut: cliente.rut || '',
    comuna: cliente.comuna || '',
    address: cliente.address || '',
    giro: cliente.giro || '',
    phone: cliente.phone || '',
    paymentCondition: cliente.paymentCondition || '50% AL CONTADO Y 50% CONTRA ENTREGA',
    email: cliente.email || '',
    contactPerson: cliente.contactPerson || '',
    source: 'salesforce',
    salesforceAccountId: res.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Actualiza una Cuenta (Account) existente en Salesforce
 */
export async function updateSalesforceAccount(id: string, cliente: Partial<Cliente>): Promise<Cliente> {
  const client = await getValidSalesforceClient();
  const cleanId = id.trim();

  const body: Record<string, any> = {};

  if (cliente.name !== undefined) {
    body.Name = cliente.name.trim();
    body.Razon_Social__c = cliente.name.trim();
  }
  if (cliente.rut !== undefined) {
    body.RUT__c = cliente.rut.trim();
  }
  if (cliente.address !== undefined) {
    body.BillingStreet = cliente.address.trim();
  }
  if (cliente.comuna !== undefined) {
    body.BillingState = cliente.comuna.trim();
    body.BillingCity = cliente.comuna.trim();
  }
  if (cliente.phone !== undefined) {
    body.Phone = cliente.phone.trim();
  }
  if (cliente.email !== undefined) {
    body.E_mail__c = cliente.email.trim();
  }
  if (cliente.giro !== undefined) {
    body.Giro__c = cliente.giro.trim();
  }
  if (cliente.paymentCondition !== undefined) {
    body.Condicion_de_Pago__c = cliente.paymentCondition.trim();
  }

  await sfRequest(client.instanceUrl, client.accessToken, `sobjects/Account/${cleanId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

  clearSalesforceCrmCache();

  // Consultar y devolver el estado actualizado
  const updated = await getSalesforceAccountById(cleanId);
  if (!updated) {
    throw new Error('No se pudo recuperar la cuenta actualizada de Salesforce');
  }
  return updated;
}

/**
 * Busca Contactos (Contact) directamente en Salesforce
 * Opcionalmente filtra por `accountId` para devolver los contactos de esa empresa en particular
 */
export async function searchSalesforceContacts(
  query = '',
  accountId?: string,
  limit = 10
): Promise<Contacto[]> {
  const cleanTerm = query.trim().replace(/'/g, "\\'");
  const cleanAccountId = accountId ? accountId.trim().replace(/'/g, "\\'") : '';
  const cacheKey = `contacts_search_${cleanTerm.toLowerCase()}_${cleanAccountId}_${limit}`;

  const cached = getCached<Contacto[]>(cacheKey);
  if (cached) return cached;

  const client = await getValidSalesforceClient();

  const conditions: string[] = ["Name != null"];

  if (cleanAccountId) {
    conditions.push(`AccountId = '${cleanAccountId}'`);
  }

  if (cleanTerm) {
    conditions.push(
      `(Name LIKE '%${cleanTerm}%' OR Email LIKE '%${cleanTerm}%' OR Phone LIKE '%${cleanTerm}%' OR MobilePhone LIKE '%${cleanTerm}%' OR Account.Name LIKE '%${cleanTerm}%')`
    );
  }

  const whereClause = conditions.join(' AND ');

  const soql = `
    SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone, Title, Cargo__c, AccountId, Account.Name, CreatedDate, LastModifiedDate
    FROM Contact
    WHERE ${whereClause}
    ORDER BY Name ASC
    LIMIT ${limit}
  `.replace(/\s+/g, ' ').trim();

  const res = await sfRequest(client.instanceUrl, client.accessToken, `query?q=${encodeURIComponent(soql)}`);
  const records = res?.records || [];
  const contactos = records.map(mapContactToContacto);

  setCached(cacheKey, contactos);
  return contactos;
}

/**
 * Crea un Contacto (Contact) en Salesforce
 */
export async function createSalesforceContact(contacto: Partial<Contacto>): Promise<Contacto> {
  const client = await getValidSalesforceClient();

  const rawName = (contacto.name || '').trim();
  if (!rawName) throw new Error('El nombre del contacto es obligatorio.');

  const parts = rawName.split(/\s+/);
  let firstName = '';
  let lastName = rawName;

  if (parts.length > 1) {
    lastName = parts.pop()!;
    firstName = parts.join(' ');
  }

  const body: Record<string, any> = {
    LastName: lastName,
  };

  if (firstName) {
    body.FirstName = firstName;
  }
  if (contacto.email) {
    body.Email = contacto.email.trim();
  }
  if (contacto.phone) {
    body.MobilePhone = contacto.phone.trim();
    body.Phone = contacto.phone.trim();
  }
  if (contacto.cargo) {
    body.Title = contacto.cargo.trim();
  }
  if (contacto.accountId) {
    body.AccountId = contacto.accountId.trim();
  }

  const res = await sfRequest(client.instanceUrl, client.accessToken, 'sobjects/Contact', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  clearSalesforceCrmCache();

  return {
    id: res.id,
    name: rawName,
    email: contacto.email || '',
    phone: contacto.phone || '',
    company: contacto.company,
    accountId: contacto.accountId,
    cargo: contacto.cargo,
    source: 'salesforce',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

