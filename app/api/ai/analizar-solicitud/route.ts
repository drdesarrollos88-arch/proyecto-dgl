import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { analizarSolicitudConIa } from '@/lib/ai-service';
import { parseExcelToText, parseWordToText } from '@/lib/document-parser';

if (typeof process !== 'undefined' && typeof (process as any).umask !== 'function') {
  (process as any).umask = () => 0;
}

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';

    let texto = '';
    let apiKey: string | undefined;
    let fileBuffer: Buffer | undefined;
    let fileMimeType: string | undefined;
    let fileName: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      texto = (formData.get('texto') as string) || '';
      apiKey = (formData.get('apiKey') as string) || undefined;

      const file = formData.get('file') as File | null;
      if (file && file.size > 0) {
        // Límite de seguridad para servidores de hosting interno: 25 MB
        const MAX_FILE_SIZE = 25 * 1024 * 1024;
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { error: 'El archivo adjunto excede el tamaño máximo permitido de 25 MB.' },
            { status: 400 }
          );
        }

        fileName = file.name;
        fileMimeType = file.type || 'application/octet-stream';
        const arrayBuffer = await file.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);

        const lowerName = fileName.toLowerCase();

        // 1. Archivo Excel (.xlsx, .xls)
        if (
          lowerName.endsWith('.xlsx') ||
          lowerName.endsWith('.xls') ||
          fileMimeType.includes('spreadsheet') ||
          fileMimeType.includes('excel')
        ) {
          try {
            const excelText = await parseExcelToText(fileBuffer);
            texto = (texto ? texto + '\n\n' : '') + `[CONTENIDO DE LA PLANILLA EXCEL ADJUNTA "${fileName}"]:\n${excelText}`;
            // Se procesa como texto limpio estructurado para la IA
            fileBuffer = undefined;
            fileMimeType = undefined;
          } catch (excelErr: any) {
            console.error('Error al procesar Excel:', excelErr);
            return NextResponse.json(
              { error: `No fue posible leer la planilla Excel "${fileName}". Verifica que el archivo no esté protegido con contraseña ni dañado.` },
              { status: 400 }
            );
          }
        }
        // 2. Archivo Word (.docx, .doc)
        else if (
          lowerName.endsWith('.docx') ||
          lowerName.endsWith('.doc') ||
          fileMimeType.includes('word') ||
          fileMimeType.includes('document')
        ) {
          try {
            const wordText = await parseWordToText(fileBuffer);
            texto = (texto ? texto + '\n\n' : '') + `[CONTENIDO DEL DOCUMENTO WORD ADJUNTO "${fileName}"]:\n${wordText}`;
            // Se procesa como texto limpio para la IA
            fileBuffer = undefined;
            fileMimeType = undefined;
          } catch (wordErr: any) {
            console.error('Error al procesar Word:', wordErr);
            return NextResponse.json(
              { error: `No fue posible leer el documento Word "${fileName}". Verifica que el archivo no esté dañado ni protegido.` },
              { status: 400 }
            );
          }
        }
        // 3. Archivo de Texto plano (.txt, .csv)
        else if (
          fileMimeType.includes('text') ||
          lowerName.endsWith('.txt') ||
          lowerName.endsWith('.csv')
        ) {
          const txtContent = fileBuffer.toString('utf-8');
          texto = (texto ? texto + '\n\n' : '') + txtContent;
          fileBuffer = undefined;
          fileMimeType = undefined;
        }
        // 4. Si es PDF, se mantiene fileBuffer y se asegura mimeType 'application/pdf'
        else if (lowerName.endsWith('.pdf')) {
          fileMimeType = 'application/pdf';
        }
      }
    } else {
      const body = await req.json();
      texto = body.texto || '';
      apiKey = body.apiKey || undefined;
    }

    if (!texto.trim() && !fileBuffer) {
      return NextResponse.json(
        { error: 'Debes proporcionar un texto de solicitud o adjuntar un archivo (PDF, Word, Excel o TXT).' },
        { status: 400 }
      );
    }

    const resultado = await analizarSolicitudConIa({
      texto: texto.trim(),
      fileBuffer,
      fileMimeType,
      fileName,
      apiKey: apiKey?.trim(),
    });

    return NextResponse.json(resultado);
  } catch (err: any) {
    console.error('Error en API /api/ai/analizar-solicitud:', err);
    return NextResponse.json(
      { error: err.message || 'Error al procesar la solicitud con Inteligencia Artificial.' },
      { status: 500 }
    );
  }
}

