import { getUsers, getTarifario, saveCotizacion, getCotizaciones, deleteCotizacion } from '../lib/db';
import { verifyPassword, findUserByIdentifier, createSessionToken, verifySessionToken } from '../lib/auth';
import { checkRateLimit, recordFailedAttempt, resetLoginAttempts } from '../lib/security';
import { generateCotizacionExcel } from '../lib/excel-generator';
import { generateCotizacionPdf } from '../lib/pdf-generator';
import fs from 'fs';
import path from 'path';

async function runTests() {
  console.log('--- TEST 1: Database & Seed ---');
  const users = getUsers();
  console.log(`Users count: ${users.length}`);
  if (users.length === 0) throw new Error('No users found in database');

  const tarifario = getTarifario();
  console.log(`Tarifario items count: ${tarifario.length}`);
  if (tarifario.length !== 358) throw new Error(`Expected 358 items, got ${tarifario.length}`);

  console.log('--- TEST 2: Authentication ---');
  const user = findUserByIdentifier('diego.roman@idiem.cl');
  if (!user) throw new Error('User diego.roman@idiem.cl not found');

  const correctMatch = await verifyPassword('Diego.1988', user.passwordHash);
  console.log('Password verification with correct password:', correctMatch);
  if (!correctMatch) throw new Error('Password verification failed for Diego.1988');

  const wrongMatch = await verifyPassword('WrongPassword123', user.passwordHash);
  console.log('Password verification with wrong password:', wrongMatch);
  if (wrongMatch) throw new Error('Wrong password erroneously matched!');

  // Test JWT token
  const token = await createSessionToken({
    id: user.id,
    rut: user.rut,
    name: user.name,
    email: user.email,
    role: user.role,
  });
  const decoded = await verifySessionToken(token);
  console.log('Decoded session user:', decoded?.email, decoded?.role);
  if (decoded?.email !== user.email) throw new Error('JWT verification failed');

  console.log('--- TEST 3: Rate Limiting ---');
  const testIp = '192.168.1.100';
  resetLoginAttempts(testIp);
  for (let i = 0; i < 4; i++) {
    recordFailedAttempt(testIp);
    const check = checkRateLimit(testIp);
    if (!check.allowed) throw new Error(`Should allow attempt ${i + 1}`);
  }
  recordFailedAttempt(testIp); // 5th attempt
  const lockedCheck = checkRateLimit(testIp);
  console.log('Rate limit check after 5 failed attempts allowed:', lockedCheck.allowed);
  if (lockedCheck.allowed) throw new Error('Rate limit failed to lock after 5 attempts!');
  resetLoginAttempts(testIp);

  console.log('--- TEST 4: Cotizacion Creation ---');
  const sampleItem = tarifario[0]; // Clasificacion USCS
  const sampleCot = saveCotizacion({
    code: 'PR.DGL.CCCC.2026.0001',
    date: '2026-09-04',
    clientName: 'Ingeniería y Construcción Test SpA',
    clientRut: '76.999.888-7',
    clientAttention: 'Juan Pérez',
    clientPhone: '+56 9 1234 5678',
    clientEmail: 'jperez@constructora.cl',
    reference: 'Ensayos Geotécnicos de Suelo',
    projectName: 'Edificio Horizonte Sur',
    city: 'Santiago',
    commercialName: user.name,
    commercialTitle: 'Analista Comercial',
    commercialInitials: 'PCM/DRA',
    ufValue: 40879.04,
    dollarValue: 933.47,
    items: [
      {
        id: 'ci-1',
        itemNumber: '1.1.1',
        code: sampleItem.code,
        designation: sampleItem.designation,
        norm: sampleItem.norm,
        minWeightKg: sampleItem.minWeightKg,
        unit: sampleItem.unit,
        ufPrice: sampleItem.ufPrice,
        factor: 1.0,
        quantity: 3,
        subtotalUf: sampleItem.ufPrice * 3,
        subtotalClp: Math.round(sampleItem.ufPrice * 3 * 40879.04),
        sku: sampleItem.sku,
      },
    ],
    totalUf: sampleItem.ufPrice * 3,
    totalClp: Math.round(sampleItem.ufPrice * 3 * 40879.04),
    totalWeightKg: (Number(sampleItem.minWeightKg) || 0) * 3,
    observations: [],
    status: 'Borrador',
    createdBy: user.name,
  });

  console.log('Saved cotizacion ID:', sampleCot.id, sampleCot.code);
  const fetched = getCotizaciones();
  if (!fetched.find((c) => c.id === sampleCot.id)) throw new Error('Cotizacion not found in list');

  console.log('--- TEST 5: PDF and Excel Generation ---');
  // Banner
  let bannerBase64: string | undefined;
  const bannerPath = path.join(process.cwd(), 'public', 'banner_logo.png');
  if (fs.existsSync(bannerPath)) {
    bannerBase64 = `data:image/png;base64,${fs.readFileSync(bannerPath).toString('base64')}`;
  }

  const pdfDoc = generateCotizacionPdf(sampleCot, bannerBase64);
  const pdfBytes = pdfDoc.output('arraybuffer');
  console.log(`PDF successfully generated: ${pdfBytes.byteLength} bytes`);

  const excelBuf = await generateCotizacionExcel(sampleCot);
  console.log(`Excel successfully generated: ${excelBuf.byteLength} bytes`);

  // Clean up test quote
  deleteCotizacion(sampleCot.id);
  console.log('Cleaned up test quote.');

  console.log('\n ALL TESTS PASSED SUCCESSFULLY! ');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

