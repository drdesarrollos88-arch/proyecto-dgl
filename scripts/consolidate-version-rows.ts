import fs from 'fs';
import path from 'path';
import { supabaseAdmin, isSupabaseConfigured } from '../lib/supabase';
import { mapSupabaseToCotizacion } from '../lib/cotizaciones-db';
import { CotizacionVersionSnapshot } from '../lib/types';

// Leer .env.local si no está cargado
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

async function consolidatePairs() {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client no está disponible.');
    return;
  }

  console.log('🔍 Buscando pares duplicados de cotizaciones (V1 y V2)...');

  const { data: allQuotes, error } = await supabaseAdmin
    .from('cotizaciones')
    .select('*')
    .order('created_at', { ascending: true });

  if (error || !allQuotes) {
    console.error('❌ Error al obtener cotizaciones de Supabase:', error);
    return;
  }

  console.log(`📋 Total cotizaciones en Supabase: ${allQuotes.length}`);

  // Pares identificados
  const pairsToConsolidate = [
    { baseCorrelativo: '0656', v1Id: 'cot-1791405010836', v2Id: 'cot-1791458986868' },
    { baseCorrelativo: '0653', v1Id: 'cot-1791225456327', v2Id: 'cot-1791466742551' },
    { baseCorrelativo: '0654', v1Id: 'cot-1791228677187', v2Id: 'cot-1791397527449' },
    { baseCorrelativo: '0578', v1Id: 'cot-1788540915548', v2Id: 'cot-1788545690754' },
  ];

  for (const pair of pairsToConsolidate) {
    const v1Row = allQuotes.find((q) => q.id === pair.v1Id);
    const v2Row = allQuotes.find((q) => q.id === pair.v2Id);

    if (!v1Row || !v2Row) {
      console.log(`⚠️ No se encontraron ambas filas para ${pair.baseCorrelativo} (v1: ${Boolean(v1Row)}, v2: ${Boolean(v2Row)})`);
      continue;
    }

    console.log(`\n🔄 Consolidando ${pair.baseCorrelativo}:`);
    console.log(`   - V1: ${v1Row.id} (${v1Row.code})`);
    console.log(`   - V2: ${v2Row.id} (${v2Row.code})`);

    const v1Mapped = mapSupabaseToCotizacion(v1Row);
    const v2Mapped = mapSupabaseToCotizacion(v2Row);

    const snapshotV1: CotizacionVersionSnapshot = {
      versionNumber: 1,
      versionCode: v1Mapped.code,
      savedAt: v1Mapped.createdAt || v1Row.created_at,
      savedBy: v1Mapped.createdBy || v1Row.user_name || 'Comercial',
      status: v1Mapped.status,
      totalUf: v1Mapped.totalUf,
      totalClp: v1Mapped.totalClp,
      totalUsd: v1Mapped.totalUsd,
      totalWeightKg: v1Mapped.totalWeightKg,
      ufValue: v1Mapped.ufValue,
      dollarValue: v1Mapped.dollarValue,
      items: v1Mapped.items,
      observations: v1Mapped.observations,
      condicionesComerciales: v1Mapped.condicionesComerciales,
      showEconomicIndicators: v1Mapped.showEconomicIndicators,
      salesforceOpportunityId: v1Mapped.salesforceOpportunityId,
      salesforceQuoteId: v1Mapped.salesforceQuoteId,
    };

    const currentHistory = Array.isArray(v2Row.ai_chat_state?.versionHistory)
      ? v2Row.ai_chat_state.versionHistory
      : [];

    const updatedHistory = [
      snapshotV1,
      ...currentHistory.filter((h: any) => h.versionCode !== v1Mapped.code),
    ];

    const updatedAiChatState = {
      ...(v2Row.ai_chat_state || {}),
      versionHistory: updatedHistory,
    };

    // Actualizar registro V2
    const { error: updateError } = await supabaseAdmin
      .from('cotizaciones')
      .update({
        version: 2,
        ai_chat_state: updatedAiChatState,
      })
      .eq('id', v2Row.id);

    if (updateError) {
      console.error(`❌ Error al actualizar V2 ${v2Row.id}:`, updateError.message);
      continue;
    }

    console.log(`   ✓ V2 ${v2Row.id} actualizado con versión 2 y snapshot V1 en historial.`);

    // Eliminar fila obsoleta V1
    const { error: deleteError } = await supabaseAdmin
      .from('cotizaciones')
      .delete()
      .eq('id', v1Row.id);

    if (deleteError) {
      console.error(`❌ Error al eliminar V1 ${v1Row.id}:`, deleteError.message);
    } else {
      console.log(`   ✓ Fila V1 ${v1Row.id} eliminada exitosamente.`);
    }
  }

  // Limpiar también en data/db.json si existe
  const dbJsonPath = path.join(process.cwd(), 'data', 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(dbJsonPath, 'utf-8'));
      if (Array.isArray(raw.cotizaciones)) {
        const deletedIds = new Set(pairsToConsolidate.map((p) => p.v1Id));
        const filtered = raw.cotizaciones.filter((c: any) => !deletedIds.has(c.id));
        raw.cotizaciones = filtered;
        fs.writeFileSync(dbJsonPath, JSON.stringify(raw, null, 2), 'utf-8');
        console.log(`✓ Archivo data/db.json sincronizado.`);
      }
    } catch (e) {
      console.warn('Aviso sincronizando db.json:', e);
    }
  }

  console.log('\n🎉 Consolidación finalizada con éxito.');
}

consolidatePairs();

