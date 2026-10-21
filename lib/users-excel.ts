import ExcelJS from 'exceljs';
import { User, UserRole, PermissionKey, SessionUser } from './types';
import { PERMISSION_DEFINITIONS, DEFAULT_PROFILES, hasPermission, isAdminRole } from './permissions';
import { hashPassword } from './auth';
import {
  getUsersAsync,
  getUserByEmailAsync,
  getUserByRutAsync,
  createUserAsync,
  updateUserAsync,
} from './users-db';

export interface BulkUserRowError {
  fila: number;
  rut?: string;
  email?: string;
  error: string;
}

export interface BulkUserImportResult {
  success: boolean;
  totalFilas: number;
  creados: number;
  actualizados: number;
  errores: BulkUserRowError[];
  usuarios: User[];
}

// Columnas fijas de datos de usuario
export const FIXED_USER_COLUMNS = [
  { key: 'rut', header: 'RUT (*)', width: 16, sample: '12.345.678-9', note: 'Obligatorio. Formato chileno o pasaporte extranjero.' },
  { key: 'name', header: 'Nombre Completo (*)', width: 28, sample: 'Juan Pérez González', note: 'Obligatorio.' },
  { key: 'email', header: 'Correo Electrónico (*)', width: 30, sample: 'juan.perez@idiem.cl', note: 'Obligatorio. Único en el sistema.' },
  { key: 'password', header: 'Contraseña Provisoria (*)', width: 22, sample: 'Dgl2026*', note: 'Mínimo 6 caracteres. Si el usuario ya existe y se deja vacío, conserva la actual.' },
  { key: 'role', header: 'Rol del Sistema (*)', width: 18, sample: 'comercial', note: 'Valores válidos: comercial | admin | superadmin' },
  { key: 'profileId', header: 'Perfil Base (*)', width: 22, sample: 'comercial_senior', note: 'comercial_senior | comercial_junior | comercial_restringido | revisor_tecnico | admin | superadmin' },
  { key: 'commercialTitle', header: 'Cargo Comercial', width: 26, sample: 'Ingeniero Geotécnico Comercial', note: 'Opcional. Aparece en firmas de cotizaciones.' },
  { key: 'phone', header: 'Teléfono Móvil', width: 18, sample: '+56 9 1234 5678', note: 'Opcional.' },
  { key: 'commercialInitials', header: 'Iniciales', width: 12, sample: 'JPG', note: 'Opcional (2 a 4 letras).' },
  { key: 'signature', header: 'Firma Oficial', width: 30, sample: 'Juan Pérez G. / Laboratorio DGL', note: 'Opcional.' },
];

/**
 * Genera la plantilla Excel oficial para la carga y actualización masiva de usuarios
 * con dos hojas de trabajo:
 * 1. 'Usuarios y Permisos': Hoja de carga interactiva con columnas base + los 26 permisos granulares.
 * 2. 'Guía de Roles y Permisos': Diccionario exhaustivo con roles, perfiles e instrucciones.
 */
export async function generateUsersTemplateExcel(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Laboratorio Geotécnico DGL';
  workbook.created = new Date();

  // ==========================================
  // HOJA 1: USUARIOS Y PERMISOS
  // ==========================================
  const ws = workbook.addWorksheet('Usuarios y Permisos', {
    views: [{ showGridLines: true, state: 'frozen', ySplit: 2, xSplit: 3 }],
  });

  // Fila 1: Grupos superiores (Datos Generales + Permisos por Módulo)
  // Fila 2: Encabezados de columnas individuales

  // Construir configuración de columnas
  const allColumns: { header: string; key: string; width: number }[] = [];

  // 1. Columnas fijas
  for (const col of FIXED_USER_COLUMNS) {
    allColumns.push({ header: col.header, key: col.key, width: col.width });
  }

  // 2. Columnas de permisos granulares agrupados
  for (const perm of PERMISSION_DEFINITIONS) {
    allColumns.push({
      header: `[${perm.module}] ${perm.label}`,
      key: `perm_${perm.key}`,
      width: Math.max(22, perm.label.length + 4),
    });
  }

  // Encabezados en fila 2
  const headerRowValues = allColumns.map((c) => c.header);
  
  // Fila 1: Agrupadores visuales
  const groupRowValues: string[] = new Array(allColumns.length).fill('');
  groupRowValues[0] = 'DATOS PRINCIPALES DE IDENTIFICACIÓN Y ACCESO (OBLIGATORIOS Y OPCIONALES)';
  
  const fixedCount = FIXED_USER_COLUMNS.length;
  groupRowValues[fixedCount] = 'MATRIZ DE PERMISOS GRANULARES POR MÓDULO (Dejar vacío o escribir "HEREDAR" para adoptar los permisos del Perfil Base. Escribir "SI" para otorgar o "NO" para denegar)';

  ws.addRow(groupRowValues);
  ws.addRow(headerRowValues);

  // Unir celdas de la fila 1
  ws.mergeCells(1, 1, 1, fixedCount);
  ws.mergeCells(1, fixedCount + 1, 1, allColumns.length);

  // Estilos de la fila 1 (Grupos)
  const groupCell1 = ws.getCell(1, 1);
  groupCell1.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  groupCell1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  groupCell1.alignment = { horizontal: 'center', vertical: 'middle' };

  const groupCell2 = ws.getCell(1, fixedCount + 1);
  groupCell2.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }, // Blue 900 (IDIEM DGL)
  };
  groupCell2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
  groupCell2.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.getRow(1).height = 26;

  // Estilos de la fila 2 (Encabezados de columna)
  const headerRow = ws.getRow(2);
  headerRow.height = 32;

  for (let i = 1; i <= allColumns.length; i++) {
    const cell = headerRow.getCell(i);
    const isFixed = i <= fixedCount;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isFixed ? 'FF1E293B' : 'FF2563EB' }, // Slate 800 para datos, Blue 600 para permisos
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  // Establecer anchos de columna en la hoja
  allColumns.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width;
  });

  // Filas de ejemplo pre-cargadas para guiar al usuario
  const sampleUsers = [
    {
      rut: '15.420.123-4',
      name: 'Claudio Miranda R.',
      email: 'claudio.miranda@idiem.cl',
      password: 'Temporal2026*',
      role: 'comercial',
      profileId: 'comercial_senior',
      commercialTitle: 'Ingeniero Geotécnico Comercial Senior',
      phone: '+56 9 8765 4321',
      commercialInitials: 'CMR',
      signature: 'Claudio Miranda R. / Ingeniero Geotecnia DGL',
      // Deja los permisos vacíos para ilustrar herencia automática
      perms: {},
    },
    {
      rut: '18.901.234-5',
      name: 'Valeria Castro Soto',
      email: 'valeria.castro@idiem.cl',
      password: 'Temporal2026*',
      role: 'comercial',
      profileId: 'comercial_junior',
      commercialTitle: 'Ejecutiva Comercial Junior',
      phone: '+56 9 7654 3210',
      commercialInitials: 'VCS',
      signature: 'Valeria Castro S. / Laboratorio DGL',
      // Ejemplo con permiso personalizado explícito
      perms: {
        'tarifario.descargar': 'SI', // Se le autoriza excepcionalmente descargar el tarifario
      },
    },
    {
      rut: '12.876.543-2',
      name: 'Roberto Gómez Silva',
      email: 'roberto.gomez@idiem.cl',
      password: 'Temporal2026*',
      role: 'comercial',
      profileId: 'revisor_tecnico',
      commercialTitle: 'Jefe Técnico de Laboratorio',
      phone: '+56 9 6543 2109',
      commercialInitials: 'RGS',
      signature: 'Roberto Gómez S. / Revisor Geotécnico',
      perms: {},
    },
  ];

  for (const sample of sampleUsers) {
    const rowValues: (string | number)[] = [
      sample.rut,
      sample.name,
      sample.email,
      sample.password,
      sample.role,
      sample.profileId,
      sample.commercialTitle,
      sample.phone,
      sample.commercialInitials,
      sample.signature,
    ];

    // Permisos
    for (const perm of PERMISSION_DEFINITIONS) {
      const explicitVal = (sample.perms as any)[perm.key];
      rowValues.push(explicitVal || ''); // Si está vacío, hereda del perfil base
    }

    const addedRow = ws.addRow(rowValues);
    addedRow.height = 20;

    for (let c = 1; c <= allColumns.length; c++) {
      const cell = addedRow.getCell(c);
      cell.font = { size: 9, color: { argb: 'FF334155' } };
      cell.alignment = {
        horizontal: c <= fixedCount ? 'left' : 'center',
        vertical: 'middle',
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (c > fixedCount && cell.value === 'SI') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFDCFCE7' }, // Verde claro para 'SI'
        };
        cell.font = { bold: true, color: { argb: 'FF166534' }, size: 9 };
      }
    }
  }

  // ==========================================
  // HOJA 2: GUÍA DE ROLES Y PERMISOS
  // ==========================================
  const wsGuia = workbook.addWorksheet('Guía de Perfiles y Roles', {
    views: [{ showGridLines: true }],
  });

  wsGuia.columns = [
    { width: 4 },  // A: Espaciador
    { width: 26 }, // B: Clave / Código
    { width: 34 }, // C: Nombre / Título
    { width: 70 }, // D: Descripción detallada / Alcance
  ];

  let r = 2;

  // Título Guía
  wsGuia.getCell(`B${r}`).value = 'GUÍA OFICIAL DE CARGA MASIVA DE USUARIOS Y ROLES (RBAC)';
  wsGuia.getCell(`B${r}`).font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  r += 2;

  // Instrucciones Generales
  wsGuia.getCell(`B${r}`).value = 'INSTRUCCIONES DE USO:';
  wsGuia.getCell(`B${r}`).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
  r++;

  const instructions = [
    '1. Cada fila de la hoja "Usuarios y Permisos" corresponde a un usuario. Las columnas con (*) son estrictamente obligatorias.',
    '2. Si el RUT o Correo Electrónico ya existe en la base de datos, el usuario será ACTUALIZADO en lugar de duplicarse.',
    '3. Si un usuario ya existe y se deja la columna "Contraseña Provisoria" en blanco, conservará su contraseña actual sin cambios.',
    '4. Si un usuario es nuevo, la contraseña provisoria debe tener al menos 6 caracteres.',
    '5. Regla de Permisos Inteligente: Si dejas las columnas de permisos vacías o escribes "HEREDAR", el usuario obtendrá automáticamente los permisos estándar de su "Perfil Base".',
    '6. Para personalizar permisos individuales, escribe "SI", "1" o "X" para otorgarlo, o "NO", "0" para denegarlo explícitamente.',
    '7. Jerarquía de Seguridad: Los usuarios con rol "admin" no pueden crear ni asignar roles "superadmin" (Administrador / Soporte protegido).',
  ];

  for (const inst of instructions) {
    wsGuia.getCell(`B${r}`).value = inst;
    wsGuia.getCell(`B${r}`).font = { size: 9, color: { argb: 'FF334155' } };
    wsGuia.mergeCells(r, 2, r, 4);
    r++;
  }
  r += 2;

  // Sección 1: Roles del Sistema
  wsGuia.getCell(`B${r}`).value = '1. ROLES DEL SISTEMA DISPONIBLES:';
  wsGuia.getCell(`B${r}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  r++;

  const rolesData = [
    { code: 'comercial', name: 'Comercial / Operativo', desc: 'Usuario estándar del equipo de laboratorio, ventas o revisión técnica. Acceso regulado por su Perfil y Permisos.' },
    { code: 'admin', name: 'Administrador', desc: 'Acceso total de administración general, cotizaciones, tarifas, clientes y gestión de usuarios comerciales.' },
    { code: 'superadmin', name: 'Administrador / Soporte', desc: 'Máximo nivel de control y soporte de infraestructura, acceso a auditoría de seguridad y configuraciones maestras.' },
  ];

  wsGuia.getCell(`B${r}`).value = 'Código de Rol';
  wsGuia.getCell(`C${r}`).value = 'Nombre de Rol';
  wsGuia.getCell(`D${r}`).value = 'Descripción y Nivel de Acceso';
  [wsGuia.getCell(`B${r}`), wsGuia.getCell(`C${r}`), wsGuia.getCell(`D${r}`)].forEach((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  });
  r++;

  for (const item of rolesData) {
    wsGuia.getCell(`B${r}`).value = item.code;
    wsGuia.getCell(`B${r}`).font = { bold: true, size: 9 };
    wsGuia.getCell(`C${r}`).value = item.name;
    wsGuia.getCell(`D${r}`).value = item.desc;
    r++;
  }
  r += 2;

  // Sección 2: Perfiles Base Predeterminados
  wsGuia.getCell(`B${r}`).value = '2. PERFILES BASE PREDETERMINADOS (ID DE PERFIL):';
  wsGuia.getCell(`B${r}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  r++;

  wsGuia.getCell(`B${r}`).value = 'ID del Perfil';
  wsGuia.getCell(`C${r}`).value = 'Nombre del Perfil';
  wsGuia.getCell(`D${r}`).value = 'Descripción y Permisos Incluidos';
  [wsGuia.getCell(`B${r}`), wsGuia.getCell(`C${r}`), wsGuia.getCell(`D${r}`)].forEach((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  });
  r++;

  for (const prof of DEFAULT_PROFILES) {
    wsGuia.getCell(`B${r}`).value = prof.id;
    wsGuia.getCell(`B${r}`).font = { bold: true, size: 9 };
    wsGuia.getCell(`C${r}`).value = prof.name;
    wsGuia.getCell(`D${r}`).value = `${prof.description} (Permisos base: ${prof.permissions.length})`;
    r++;
  }
  r += 2;

  // Sección 3: Diccionario Completo de Permisos Granulares
  wsGuia.getCell(`B${r}`).value = '3. DICCIONARIO COMPLETO DE PERMISOS GRANULARES (26 PERMISOS):';
  wsGuia.getCell(`B${r}`).font = { bold: true, size: 11, color: { argb: 'FF1E3A8A' } };
  r++;

  wsGuia.getCell(`B${r}`).value = 'Clave Técnica';
  wsGuia.getCell(`C${r}`).value = 'Módulo / Nombre del Permiso';
  wsGuia.getCell(`D${r}`).value = 'Alcance y Función Operativa';
  [wsGuia.getCell(`B${r}`), wsGuia.getCell(`C${r}`), wsGuia.getCell(`D${r}`)].forEach((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  });
  r++;

  for (const perm of PERMISSION_DEFINITIONS) {
    wsGuia.getCell(`B${r}`).value = perm.key;
    wsGuia.getCell(`B${r}`).font = { bold: true, size: 9, color: { argb: 'FF2563EB' } };
    wsGuia.getCell(`C${r}`).value = `[${perm.module}] ${perm.label}`;
    wsGuia.getCell(`D${r}`).value = perm.description;
    r++;
  }

  return workbook.xlsx.writeBuffer();
}

/**
 * Valida un RUT chileno o formato extranjero.
 */
function cleanRut(rutRaw: unknown): string {
  if (!rutRaw) return '';
  return String(rutRaw).trim();
}

function cleanEmail(emailRaw: unknown): string {
  if (!emailRaw) return '';
  return String(emailRaw).trim().toLowerCase();
}

/**
 * Procesa e importa un archivo Excel con usuarios y permisos.
 */
export async function parseUsersFromExcel(
  buffer: ArrayBuffer,
  authorUser: SessionUser
): Promise<BulkUserImportResult> {
  const workbook = new ExcelJS.Workbook();
  // Compatible con Node / Buffer / ArrayBuffer
  await workbook.xlsx.load(buffer as any);

  // Buscar la hoja de usuarios (puede llamarse 'Usuarios y Permisos' o la primera hoja)
  let ws = workbook.getWorksheet('Usuarios y Permisos');
  if (!ws) {
    ws = workbook.worksheets[0];
  }

  if (!ws) {
    throw new Error('El archivo Excel no contiene ninguna hoja válida.');
  }

  // Detectar la fila de encabezados:
  // Fila 1 puede ser los grupos y fila 2 los headers individuales, o fila 1 directamente los headers
  let headerRowIndex = 2;
  let headerRow = ws.getRow(headerRowIndex);

  // Si la celda A2 está vacía pero A1 tiene 'RUT', entonces la fila 1 es el header
  const cellA1 = String(ws.getCell('A1').value || '').toLowerCase();
  const cellA2 = String(ws.getCell('A2').value || '').toLowerCase();

  if (cellA1.includes('rut') && !cellA2.includes('rut')) {
    headerRowIndex = 1;
    headerRow = ws.getRow(1);
  }

  // Mapear columnas a sus índices (1-based)
  const colIndexByKey: Record<string, number> = {};
  const permColIndexByKey: Record<PermissionKey, number> = {} as any;

  headerRow.eachCell((cell, colNumber) => {
    const text = String(cell.value || '').trim();
    const lower = text.toLowerCase();

    // Columnas fijas
    if (lower.includes('rut')) colIndexByKey['rut'] = colNumber;
    else if (lower.includes('nombre')) colIndexByKey['name'] = colNumber;
    else if (lower.includes('correo') || lower.includes('email')) colIndexByKey['email'] = colNumber;
    else if (lower.includes('contrase') || lower.includes('password')) colIndexByKey['password'] = colNumber;
    else if (lower.includes('rol')) colIndexByKey['role'] = colNumber;
    else if (lower.includes('perfil')) colIndexByKey['profileId'] = colNumber;
    else if (lower.includes('cargo') || lower.includes('título') || lower.includes('titulo')) colIndexByKey['commercialTitle'] = colNumber;
    else if (lower.includes('teléfono') || lower.includes('telefono') || lower.includes('móvil') || lower.includes('movil') || lower.includes('phone')) colIndexByKey['phone'] = colNumber;
    else if (lower.includes('iniciales') || lower.includes('sigla')) colIndexByKey['commercialInitials'] = colNumber;
    else if (lower.includes('firma')) colIndexByKey['signature'] = colNumber;

    // Detectar columnas de permisos
    for (const perm of PERMISSION_DEFINITIONS) {
      if (
        lower.includes(perm.key.toLowerCase()) ||
        lower.includes(perm.label.toLowerCase())
      ) {
        permColIndexByKey[perm.key] = colNumber;
      }
    }
  });

  // Validar que existan las columnas mínimas
  if (!colIndexByKey['rut'] || !colIndexByKey['name'] || !colIndexByKey['email']) {
    throw new Error(
      'La plantilla no contiene las columnas requeridas (RUT, Nombre Completo, Correo Electrónico). Utilice la plantilla oficial descargable.'
    );
  }

  const result: BulkUserImportResult = {
    success: true,
    totalFilas: 0,
    creados: 0,
    actualizados: 0,
    errores: [],
    usuarios: [],
  };

  const startRowIndex = headerRowIndex + 1;
  const totalRows = ws.rowCount;

  for (let r = startRowIndex; r <= totalRows; r++) {
    const row = ws.getRow(r);
    
    // Si la fila está completamente vacía, saltar
    const rutVal = cleanRut(row.getCell(colIndexByKey['rut']).value);
    const nameVal = String(row.getCell(colIndexByKey['name']).value || '').trim();
    const emailVal = cleanEmail(row.getCell(colIndexByKey['email']).value);

    if (!rutVal && !nameVal && !emailVal) {
      continue; // Fila vacía
    }

    result.totalFilas++;

    // Validaciones de datos obligatorios
    if (!rutVal) {
      result.errores.push({ fila: r, error: 'El campo RUT es obligatorio.' });
      continue;
    }

    if (!nameVal) {
      result.errores.push({ fila: r, rut: rutVal, email: emailVal, error: 'El campo Nombre Completo es obligatorio.' });
      continue;
    }

    if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
      result.errores.push({ fila: r, rut: rutVal, email: emailVal, error: 'El correo electrónico no es válido.' });
      continue;
    }

    // Rol y Perfil
    const rawRole = colIndexByKey['role'] ? String(row.getCell(colIndexByKey['role']).value || '').trim().toLowerCase() : 'comercial';
    const role: UserRole = (rawRole === 'superadmin' || rawRole === 'admin') ? rawRole : 'comercial';

    // Regla de jerarquía: solo superadmin puede crear/asignar superadmin
    if (role === 'superadmin' && authorUser.role !== 'superadmin') {
      result.errores.push({
        fila: r,
        rut: rutVal,
        email: emailVal,
        error: 'Privilegio insuficiente: Solo un usuario Administrador / Soporte puede asignar el rol superadmin.',
      });
      continue;
    }

    let profileId = colIndexByKey['profileId'] ? String(row.getCell(colIndexByKey['profileId']).value || '').trim() : '';
    if (!profileId) {
      // Default según rol
      profileId = role === 'superadmin' ? 'superadmin' : role === 'admin' ? 'admin' : 'comercial_senior';
    }

    // Datos complementarios opcionales
    const commercialTitle = colIndexByKey['commercialTitle'] ? String(row.getCell(colIndexByKey['commercialTitle']).value || '').trim() : '';
    const phone = colIndexByKey['phone'] ? String(row.getCell(colIndexByKey['phone']).value || '').trim() : '';
    const commercialInitials = colIndexByKey['commercialInitials'] ? String(row.getCell(colIndexByKey['commercialInitials']).value || '').trim().toUpperCase() : '';
    const signature = colIndexByKey['signature'] ? String(row.getCell(colIndexByKey['signature']).value || '').trim() : '';

    // Password
    const rawPassword = colIndexByKey['password'] ? String(row.getCell(colIndexByKey['password']).value || '').trim() : '';

    // Buscar si el usuario ya existe por email o por rut
    const existingByEmail = await getUserByEmailAsync(emailVal);
    const existingByRut = await getUserByRutAsync(rutVal);
    const existingUser = existingByEmail || existingByRut;

    // Si es nuevo usuario, la contraseña es obligatoria y debe tener al menos 6 caracteres
    if (!existingUser) {
      if (!rawPassword || rawPassword.length < 6) {
        result.errores.push({
          fila: r,
          rut: rutVal,
          email: emailVal,
          error: 'Para crear un nuevo usuario se requiere una contraseña provisoria de al menos 6 caracteres.',
        });
        continue;
      }
    } else {
      // Si ya existe pero envió password menor a 6 caracteres
      if (rawPassword && rawPassword.length < 6) {
        result.errores.push({
          fila: r,
          rut: rutVal,
          email: emailVal,
          error: 'La nueva contraseña debe tener al menos 6 caracteres.',
        });
        continue;
      }
    }

    // Matriz de permisos granulares
    // Si el usuario especificó al menos una celda de permiso con 'SI'/'NO'/'1'/'0', armamos `customPermissions`.
    // Si dejó todo vacío o 'HEREDAR', dejamos `undefined` para heredar limpiamente del perfil.
    let hasExplicitPerms = false;
    const explicitGranted: PermissionKey[] = [];

    // Obtener permisos base del perfil por si especificó 'NO' sobre alguno
    const baseProfile = DEFAULT_PROFILES.find((p) => p.id === profileId);
    const baseProfilePerms = new Set<PermissionKey>(baseProfile ? baseProfile.permissions : []);

    // Primero verificamos si hay alguna columna de permiso explícita en esta fila
    for (const perm of PERMISSION_DEFINITIONS) {
      const colIdx = permColIndexByKey[perm.key];
      if (colIdx) {
        const rawVal = String(row.getCell(colIdx).value || '').trim().toUpperCase();
        if (rawVal === 'SI' || rawVal === 'SÍ' || rawVal === '1' || rawVal === 'TRUE' || rawVal === 'X' || rawVal === 'NO' || rawVal === '0' || rawVal === 'FALSE') {
          hasExplicitPerms = true;
          break;
        }
      }
    }

    let finalCustomPermissions: PermissionKey[] | undefined = undefined;

    if (hasExplicitPerms) {
      // Calculamos permisos basados en el perfil + sobrescrituras explícitas
      for (const perm of PERMISSION_DEFINITIONS) {
        const colIdx = permColIndexByKey[perm.key];
        const rawVal = colIdx ? String(row.getCell(colIdx).value || '').trim().toUpperCase() : '';
        
        const isExplicitYes = rawVal === 'SI' || rawVal === 'SÍ' || rawVal === '1' || rawVal === 'TRUE' || rawVal === 'X';
        const isExplicitNo = rawVal === 'NO' || rawVal === '0' || rawVal === 'FALSE';

        if (isExplicitYes) {
          explicitGranted.push(perm.key);
        } else if (!isExplicitNo && baseProfilePerms.has(perm.key)) {
          // Si no fue denegado explícitamente y el perfil base lo incluye, lo conservamos
          explicitGranted.push(perm.key);
        }
      }
      finalCustomPermissions = explicitGranted;
    }

    try {
      if (existingUser) {
        // Actualizar usuario existente
        const updates: Partial<Omit<User, 'id' | 'createdAt'>> = {
          name: nameVal,
          email: emailVal,
          rut: rutVal,
          role,
          profileId,
          commercialTitle: commercialTitle || existingUser.commercialTitle,
          phone: phone || existingUser.phone,
          commercialInitials: commercialInitials || existingUser.commercialInitials,
          signature: signature || existingUser.signature,
        };

        if (finalCustomPermissions !== undefined) {
          updates.customPermissions = finalCustomPermissions;
        }

        if (rawPassword && rawPassword.length >= 6) {
          updates.passwordHash = await hashPassword(rawPassword);
        }

        const updated = await updateUserAsync(existingUser.id, updates);
        if (updated) {
          result.actualizados++;
          result.usuarios.push(updated);
        }
      } else {
        // Crear nuevo usuario
        const passwordHash = await hashPassword(rawPassword);
        const newUser = await createUserAsync({
          rut: rutVal,
          name: nameVal,
          email: emailVal,
          passwordHash,
          role,
          profileId,
          customPermissions: finalCustomPermissions,
          commercialTitle,
          phone,
          commercialInitials,
          signature,
        });

        result.creados++;
        result.usuarios.push(newUser);
      }
    } catch (err: any) {
      result.errores.push({
        fila: r,
        rut: rutVal,
        email: emailVal,
        error: err?.message || 'Error guardando usuario en base de datos.',
      });
    }
  }

  return result;
}

