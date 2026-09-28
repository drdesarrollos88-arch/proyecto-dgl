import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@supabase/supabase-js';

// Leer .env.local si no están en process.env
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.substring(0, idx).trim();
      const v = trimmed.substring(idx + 1).trim();
      if (!process.env[k]) {
        process.env[k] = v;
      }
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('\n❌ Error: Faltan las variables de entorno de Supabase en .env.local:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY)\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runMigration() {
  console.log('🚀 Iniciando migración de datos hacia Supabase...');
  console.log(`📡 URL de Supabase: ${supabaseUrl}\n`);

  // 1. Migrar datos desde data/db.json
  const dbJsonPath = path.join(process.cwd(), 'data', 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8'));

    // A. Usuarios
    if (Array.isArray(dbData.users) && dbData.users.length > 0) {
      console.log(`👤 Migrando ${dbData.users.length} usuarios...`);
      const usersPayload = dbData.users.map((u: any) => ({
        id: u.id,
        rut: u.rut,
        name: u.name,
        email: u.email.toLowerCase(),
        password_hash: u.passwordHash,
        role: u.role || 'vendedor',
        commercial_title: u.commercialTitle || null,
        phone: u.phone || null,
        commercial_initials: u.commercialInitials || null,
        signature: u.signature || null,
        created_at: u.createdAt || new Date().toISOString(),
      }));
      const { error } = await supabase.from('usuarios').upsert(usersPayload, { onConflict: 'id' });
      if (error) console.error('  ⚠️ Error usuarios:', error.message);
      else console.log(`  ✓ ${usersPayload.length} usuarios sincronizados.`);
    }

    // B. Perfiles
    if (Array.isArray(dbData.profiles) && dbData.profiles.length > 0) {
      console.log(`🛡️ Migrando ${dbData.profiles.length} perfiles...`);
      const profilesPayload = dbData.profiles.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description || null,
        permissions: p.permissions || {},
        is_system: p.isSystem || false,
        created_at: p.createdAt || new Date().toISOString(),
      }));
      const { error } = await supabase.from('user_profiles').upsert(profilesPayload, { onConflict: 'id' });
      if (error) console.error('  ⚠️ Error perfiles:', error.message);
      else console.log(`  ✓ ${profilesPayload.length} perfiles sincronizados.`);
    }

    // C. Tarifario Maestro (358 ensayos)
    if (Array.isArray(dbData.tarifario) && dbData.tarifario.length > 0) {
      console.log(`🧪 Migrando catálogo de ${dbData.tarifario.length} ensayos IDIEM...`);
      const tarifarioPayload = dbData.tarifario.map((t: any) => ({
        sku: t.sku,
        code: t.code,
        designation: t.designation,
        norm: t.norm || null,
        cc: t.cc,
        unit: t.unit || 'c/u',
        uf_price: t.ufPrice || 0,
        group_name: t.groupName || null,
        family: t.family || null,
        subfamily: t.subfamily || null,
        sample_type: t.sampleType || null,
        notes: t.notes || null,
        days: t.days || null,
        accredited: Boolean(t.accredited),
        updated_at: t.updatedAt || new Date().toISOString(),
      }));

      // Inserción en lotes de 100
      for (let i = 0; i < tarifarioPayload.length; i += 100) {
        const batch = tarifarioPayload.slice(i, i + 100);
        const { error } = await supabase.from('tarifario').upsert(batch, { onConflict: 'sku' });
        if (error) console.error(`  ⚠️ Error tarifario lote ${i}:`, error.message);
      }
      console.log(`  ✓ ${tarifarioPayload.length} ensayos sincronizados.`);
    }

    // D. Cotizaciones
    if (Array.isArray(dbData.cotizaciones) && dbData.cotizaciones.length > 0) {
      console.log(`📄 Migrando ${dbData.cotizaciones.length} cotizaciones...`);
      const cotizacionesPayload = dbData.cotizaciones.map((c: any) => ({
        id: c.id,
        correlativo: c.correlativo || c.code || '',
        code: c.code || c.correlativo || '',
        year: c.year || new Date().getFullYear(),
        date: c.date || new Date().toISOString(),
        client_name: c.clientName || 'Cliente Particular',
        client_rut: c.clientRut || null,
        contact_name: c.contactName || null,
        contact_email: c.contactEmail || null,
        contact_phone: c.contactPhone || null,
        project_name: c.projectName || null,
        project_address: c.projectAddress || null,
        centro_costo: c.centroCosto || '1817',
        user_id: c.userId || 'usr-1',
        user_name: c.userName || 'Diego Román',
        user_email: c.userEmail || 'diego.roman@idiem.cl',
        user_initials: c.userInitials || 'DRA',
        currency: c.currency || 'UF',
        uf_value: c.ufValue || 38000,
        subtotal_neto: c.subtotalNeto || 0,
        descuento_porcentaje: c.descuentoPorcentaje || 0,
        descuento_monto: c.descuentoMonto || 0,
        total_neto: c.totalNeto || 0,
        iva: c.iva || 0,
        total: c.total || 0,
        status: c.status || 'Borrador',
        items: c.items || [],
        observations: c.observations || [],
        validity_days: c.validityDays || 30,
        delivery_time: c.deliveryTime || null,
        payment_terms: c.paymentTerms || null,
        version: c.version || 1,
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: c.updatedAt || new Date().toISOString(),
      }));

      const { error } = await supabase.from('cotizaciones').upsert(cotizacionesPayload, { onConflict: 'id' });
      if (error) console.error('  ⚠️ Error cotizaciones:', error.message);
      else console.log(`  ✓ ${cotizacionesPayload.length} cotizaciones sincronizadas.`);
    }

    // E. Reglas Aprendidas
    if (Array.isArray(dbData.reglasAprendidas) && dbData.reglasAprendidas.length > 0) {
      console.log(`🧠 Migrando ${dbData.reglasAprendidas.length} reglas aprendidas IA...`);
      const reglasPayload = dbData.reglasAprendidas.map((r: any) => ({
        id: r.id,
        tipo: r.tipo,
        termino_usuario: r.terminoUsuario,
        codigo_ensayo: r.codigoEnsayo || null,
        designacion: r.designacion || null,
        observacion_sugerida: r.observacionSugerida || null,
        origen: r.origen || 'chat_ia',
        estado: r.estado || 'activo',
        conteo_confirmaciones: r.conteoConfirmaciones || 1,
        fecha_creacion: r.fechaCreacion || new Date().toISOString(),
        fecha_actualizacion: r.fechaActualizacion || new Date().toISOString(),
      }));
      const { error } = await supabase.from('reglas_aprendidas').upsert(reglasPayload, { onConflict: 'id' });
      if (error) console.error('  ⚠️ Error reglas:', error.message);
      else console.log(`  ✓ ${reglasPayload.length} reglas sincronizadas.`);
    }

    // F. Configuraciones
    console.log('⚙️ Migrando configuraciones del sistema...');
    const configs = [
      { key: 'formato_settings', value: dbData.formatoSettings || {} },
      { key: 'correlativo_config', value: dbData.correlativoConfig || {} },
      { key: 'last_indicators', value: dbData.lastIndicators || {} },
      { key: 'tarifario_structure', value: dbData.tarifarioStructure || [] },
    ];
    for (const conf of configs) {
      await supabase.from('configuracion_sistema').upsert({
        key: conf.key,
        value: conf.value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    }
    console.log('  ✓ Configuraciones generales sincronizadas.');
  }

  // 2. Migrar datos desde data/clientes.db (SQLite)
  const sqlitePath = path.join(process.cwd(), 'data', 'clientes.db');
  if (fs.existsSync(sqlitePath)) {
    console.log('\n📊 Conectando a SQLite local (clientes.db)...');
    const sqlite = new DatabaseSync(sqlitePath);

    // A. Contactos
    const contactosRows = sqlite.prepare('SELECT * FROM contactos').all() as any[];
    if (contactosRows.length > 0) {
      console.log(`📇 Migrando ${contactosRows.length} contactos...`);
      const contactosPayload = contactosRows.map((c) => ({
        email: c.email.toLowerCase(),
        name: c.name,
        phone: c.phone || null,
        company: c.company || null,
        created_at: c.created_at || new Date().toISOString(),
        updated_at: c.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('contactos').upsert(contactosPayload, { onConflict: 'email' });
      if (error) console.error('  ⚠️ Error contactos:', error.message);
      else console.log(`  ✓ ${contactosPayload.length} contactos sincronizados.`);
    }

    // B. Proyectos
    const proyectosRows = sqlite.prepare('SELECT * FROM proyectos').all() as any[];
    if (proyectosRows.length > 0) {
      console.log(`🏗️ Migrando ${proyectosRows.length} proyectos...`);
      const proyectosPayload = proyectosRows.map((p) => ({
        id: p.id,
        name: p.name,
        reference: p.reference || null,
        city: p.city || null,
        client_name: p.client_name || null,
        created_at: p.created_at || new Date().toISOString(),
        updated_at: p.updated_at || new Date().toISOString(),
      }));
      const { error } = await supabase.from('proyectos').upsert(proyectosPayload, { onConflict: 'id' });
      if (error) console.error('  ⚠️ Error proyectos:', error.message);
      else console.log(`  ✓ ${proyectosPayload.length} proyectos sincronizados.`);
    }

    // C. Clientes (en lotes de 500)
    const clientesCount = (sqlite.prepare('SELECT COUNT(*) as c FROM clientes').get() as any).c;
    console.log(`🏢 Migrando ${clientesCount} clientes en lotes de 500...`);

    const batchSize = 500;
    let offset = 0;
    let processed = 0;

    while (offset < clientesCount) {
      const rows = sqlite.prepare(`SELECT * FROM clientes LIMIT ? OFFSET ?`).all(batchSize, offset) as any[];
      if (rows.length === 0) break;

      const clientesPayload = rows.map((cl) => ({
        id: cl.id,
        name: cl.name,
        rut: cl.rut,
        comuna: cl.comuna || null,
        address: cl.address || null,
        giro: cl.giro || null,
        phone: cl.phone || null,
        payment_condition: cl.payment_condition || null,
        email: cl.email || null,
        contact_person: cl.contact_person || null,
        created_at: cl.created_at || new Date().toISOString(),
        updated_at: cl.updated_at || new Date().toISOString(),
      }));

      const { error } = await supabase.from('clientes').upsert(clientesPayload, { onConflict: 'id' });
      if (error) {
        console.error(`  ⚠️ Error en clientes offset ${offset}:`, error.message);
      } else {
        processed += clientesPayload.length;
        process.stdout.write(`\r  Progreso clientes: ${processed} / ${clientesCount} (${Math.round((processed / clientesCount) * 100)}%)`);
      }
      offset += batchSize;
    }
    console.log('\n  ✓ Todos los clientes sincronizados exitosamente.');
  }

  console.log('\n🎉 ¡MIGRACIÓN A SUPABASE COMPLETADA CON ÉXITO!\n');
}

runMigration().catch((err) => {
  console.error('\n❌ Error fatal durante la migración:', err);
  process.exit(1);
});
