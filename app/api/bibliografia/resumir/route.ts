import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { GoogleGenAI } from '@google/genai';
import { parseExcelToText, parseWordToText } from '@/lib/document-parser';

export const dynamic = 'force-dynamic';

function cleanFilenameToTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  return withoutExt
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPdfTextSnippet(buffer: Buffer, maxChars = 12000): string {
  // Limitar la muestra a máx 128 KB para procesamiento ultra rápido (< 2ms) en Cloudflare Workers
  const boundedBuf = buffer.subarray(0, Math.min(buffer.length, 128 * 1024));
  try {
    const rawStr = boundedBuf.toString('latin1');
    const matches = rawStr.match(/\(([^)]+)\)\s*Tj/g);
    if (matches && matches.length > 5) {
      const chunks: string[] = [];
      matches.slice(0, 300).forEach((m) => {
        const cleaned = m.replace(/^\(/, '').replace(/\)\s*Tj$/, '').trim();
        if (cleaned.length > 1) chunks.push(cleaned);
      });
      const res = chunks.join(' ');
      if (res.length > 50) return res.slice(0, maxChars);
    }
  } catch {}

  const printable = boundedBuf.toString('utf-8').replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ');
  return printable.replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const providedTitle = (formData.get('titulo') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 });
    }

    const originalName = file.name;
    const lowerName = originalName.toLowerCase();
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    let extractedText = '';
    let isPdf = false;

    if (lowerName.endsWith('.pdf')) {
      isPdf = true;
      extractedText = extractPdfTextSnippet(buffer);
    } else if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc')) {
      try {
        extractedText = await parseWordToText(buffer);
      } catch {
        extractedText = buffer.toString('utf-8').slice(0, 10000);
      }
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      try {
        extractedText = await parseExcelToText(buffer);
      } catch {
        extractedText = buffer.toString('utf-8').slice(0, 10000);
      }
    } else {
      extractedText = buffer.toString('utf-8').slice(0, 10000);
    }

    const defaultTitle = providedTitle.trim() || cleanFilenameToTitle(originalName);

    // Call Gemini
    const apiKey =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_API_KEY?.trim() ||
      process.env.GOOGLE_GENAI_API_KEY?.trim();

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const contentsParts: any[] = [];

        // If it's a PDF and under 4MB, send inlineData or send extracted text
        if (isPdf && buffer.length <= 4 * 1024 * 1024) {
          contentsParts.push({
            inlineData: {
              mimeType: 'application/pdf',
              data: buffer.toString('base64'),
            },
          });
        }

        const promptText = `Eres el Asistente Técnico Geotécnico de IDIEM - Universidad de Chile.
Analiza este documento técnico o norma ("${originalName}").
${extractedText && extractedText.length > 50 ? `Texto preliminar extraído:\n"${extractedText.slice(0, 4000)}"\n` : ''}

INSTRUCCIONES ESTRICTAS:
1. Genera un resumen técnico sumamente conciso de aproximadamente 20 palabras (estricto entre 15 y 25 palabras) explicando el alcance técnico de la norma/documento y su aplicación en mecánica de suelos o laboratorio geotécnico en Chile.
2. Sugiere un título normalizado, limpio y formal para el documento (por ejemplo, si el archivo se llama "NCh1508_Of_2014_rev.pdf", el título debe ser "NCh 1508:2014 Geotecnia - Estudio de mecánica de suelos").
3. Sugiere 2 a 4 tags o palabras clave técnicas separadas por comas.

Responde ÚNICAMENTE un objeto JSON válido con este formato exacto:
{
  "titulo": "Título formal sugerido",
  "resumen": "Resumen técnico de exactamente unas 20 palabras.",
  "tags": "tag1, tag2, tag3"
}`;

        contentsParts.push({ text: promptText });

        const candidateModels = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-3.5-flash'];
        let responseText = '';

        for (const model of candidateModels) {
          try {
            const resp = await ai.models.generateContent({
              model,
              contents: [{ role: 'user', parts: contentsParts }],
              config: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });
            if (resp && resp.text) {
              responseText = resp.text;
              break;
            }
          } catch (modelErr) {
            continue;
          }
        }

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);
            return NextResponse.json({
              success: true,
              titulo: parsed.titulo || defaultTitle,
              resumen: parsed.resumen || '',
              tags: parsed.tags || '',
            });
          } catch {}
        }
      } catch (geminiErr) {
        console.warn('Error al resumir con Gemini:', geminiErr);
      }
    }

    // Heuristic Fallback
    const fallbackResumen = `Normativa y procedimiento técnico de referencia para ensayos geotécnicos y caracterización de materiales en laboratorios de ingeniería y obras civiles en Chile.`;
    return NextResponse.json({
      success: true,
      titulo: defaultTitle,
      resumen: fallbackResumen,
      tags: 'Geotecnia, Laboratorio, Ensayos, Normativa',
    });
  } catch (err: any) {
    console.error('Error en /api/bibliografia/resumir:', err);
    return NextResponse.json(
      { error: err?.message || 'Error al procesar el resumen con IA' },
      { status: 500 }
    );
  }
}

