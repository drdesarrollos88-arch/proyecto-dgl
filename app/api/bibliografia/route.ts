import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getBibliografia, saveBibliografiaItem } from '@/lib/bibliografia-db';
import { registrarAuditoria } from '@/lib/audit-db';
import { parseExcelToText, parseWordToText } from '@/lib/document-parser';
import { TipoBibliografia } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo') as TipoBibliografia | null;
  const estado = searchParams.get('estado') as 'activo' | 'inactivo' | null;
  const query = searchParams.get('q') || undefined;

  try {
    const items = await getBibliografia({
      tipo: tipo || undefined,
      estado: estado || undefined,
      query,
    });

    return NextResponse.json({ success: true, items });
  } catch (err: any) {
    console.error('Error al listar bibliografía:', err);
    return NextResponse.json({ error: 'Error al consultar la bibliografía' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

    let tipo: TipoBibliografia = 'tecnica';
    let titulo = '';
    let descripcion = '';
    let contenidoTexto = '';
    let nombreArchivoOriginal: string | undefined;
    let tipoArchivo: string = 'txt';
    let tamanoBytes = 0;
    let tags: string[] = [];
    let metadatos: any = {};

    // 1. Carga de archivo multipart/form-data (PDF, Word, TXT)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      tipo = (formData.get('tipo') as TipoBibliografia) || 'tecnica';
      titulo = (formData.get('titulo') as string) || '';
      descripcion = (formData.get('descripcion') as string) || '';
      const tagsRaw = (formData.get('tags') as string) || '';
      if (tagsRaw) {
        tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);
      }

      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        nombreArchivoOriginal = file.name;
        tamanoBytes = file.size;
        const lowerName = file.name.toLowerCase();
        const arrayBuf = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);

        if (!titulo) {
          titulo = file.name.replace(/\.[^/.]+$/, '');
        }

        if (lowerName.endsWith('.pdf')) {
          tipoArchivo = 'pdf';
          // Para PDF, tomar una muestra representativa acotada (máx 128 KB) para extraer texto
          // de forma ultra rápida sin exceder el límite de CPU (50ms) en Cloudflare Workers
          const sampleSize = Math.min(buffer.length, 128 * 1024);
          const sampleBuffer = buffer.subarray(0, sampleSize);
          const rawStr = sampleBuffer.toString('latin1');
          const textChunks: string[] = [];

          // Extraer secuencias entre paréntesis en operadores Tj / TJ
          const matches = rawStr.match(/\(([^)]+)\)\s*Tj/g);
          if (matches && matches.length > 5) {
            matches.slice(0, 300).forEach((m) => {
              const cleaned = m.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
              if (cleaned.length > 1) textChunks.push(cleaned);
            });
            contenidoTexto = textChunks.join(' ');
          }

          if (!contenidoTexto || contenidoTexto.length < 50) {
            // Extraer caracteres ASCII imprimibles solo de la muestra acotada
            const printable = sampleBuffer.toString('utf-8').replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ');
            contenidoTexto = printable.replace(/\s+/g, ' ').trim().slice(0, 10000);
          }

          if (!contenidoTexto || contenidoTexto.length < 30) {
            contenidoTexto = descripcion
              ? `${descripcion}\n\nDocumento técnico normativo: "${file.name}".`
              : `Documento técnico normativo IDIEM: "${file.name}". Referencia de laboratorio geotécnico DGL.`;
          }
        } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
          tipoArchivo = 'docx';
          try {
            contenidoTexto = await parseWordToText(buffer);
          } catch {
            const sample = buffer.subarray(0, 128 * 1024);
            contenidoTexto = sample.toString('utf-8').slice(0, 10000);
          }
        } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
          tipoArchivo = 'excel';
          try {
            contenidoTexto = await parseExcelToText(buffer);
          } catch {
            const sample = buffer.subarray(0, 128 * 1024);
            contenidoTexto = sample.toString('utf-8').slice(0, 10000);
          }
        } else {
          tipoArchivo = 'txt';
          const sample = buffer.subarray(0, 128 * 1024);
          contenidoTexto = sample.toString('utf-8').slice(0, 10000);
        }
      } else {
        contenidoTexto = (formData.get('contenidoTexto') as string) || '';
      }
    } else {
      // 2. Carga en JSON directo (ej. Guardar chat del asistente o caso histórico)
      const body = await req.json();
      tipo = body.tipo || 'historica';
      titulo = body.titulo || 'Registro de Bibliografía';
      descripcion = body.descripcion || '';
      contenidoTexto = body.contenidoTexto || '';
      tipoArchivo = body.tipoArchivo || (tipo === 'historica' ? 'chat' : 'txt');
      tags = body.tags || [];
      metadatos = body.metadatos || {};
      tamanoBytes = contenidoTexto.length;
    }

    if (!titulo) {
      titulo = nombreArchivoOriginal?.replace(/\.[^/.]+$/, '') || 'Documento sin título';
    }
    if (!contenidoTexto) {
      contenidoTexto = descripcion || `Documento: "${titulo}". Referencia de laboratorio geotécnico DGL.`;
    }

    const saved = await saveBibliografiaItem({
      tipo,
      titulo,
      descripcion,
      contenidoTexto,
      nombreArchivoOriginal,
      tipoArchivo,
      tamanoBytes,
      tags,
      metadatos,
      estado: 'activo',
      creadoPor: currentUser.name,
    });

    // Registrar en auditoría
    await registrarAuditoria({
      userId: currentUser.id,
      userName: currentUser.name,
      userEmail: currentUser.email,
      userRole: currentUser.role,
      action: tipo === 'tecnica' ? 'BIBLIOGRAFIA_SUBIR' : 'ASISTENTE_CHAT_ARCHIVADO',
      module: tipo === 'tecnica' ? 'Bibliografía' : 'Asistente IA',
      description:
        tipo === 'tecnica'
          ? `Carga de nuevo documento en Bibliografía Técnica: "${saved.titulo}"`
          : `Guardado de interacción/caso en Bibliografía Histórica: "${saved.titulo}"`,
      details: { id: saved.id, tipo: saved.tipo, archivo: saved.nombreArchivoOriginal, tamano: saved.tamanoBytes },
      ip,
    });

    return NextResponse.json({ success: true, item: saved });
  } catch (err: any) {
    console.error('Error al guardar ítem de bibliografía:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al procesar el documento en la base de conocimientos' },
      { status: 500 }
    );
  }
}

