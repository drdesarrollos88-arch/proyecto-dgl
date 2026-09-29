// Polyfill for process.umask in serverless / Edge runtimes (Cloudflare Workers)
if (typeof process !== 'undefined' && typeof (process as any).umask !== 'function') {
  (process as any).umask = () => 0;
}

/**
 * Extrae el contenido tabular y textual de un archivo Excel (.xlsx, .xls)
 * organizando cada hoja con sus columnas y filas en formato texto estructurado.
 */
export async function parseExcelToText(buffer: Buffer): Promise<string> {
  try {
    if (typeof process !== 'undefined' && typeof (process as any).umask !== 'function') {
      (process as any).umask = () => 0;
    }
    const ExcelJSModule = await import('exceljs');
    const ExcelJS = (ExcelJSModule as any).default || ExcelJSModule;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);

    const sheetsText: string[] = [];

    workbook.eachSheet((worksheet: any) => {
      const rows: string[] = [];

      worksheet.eachRow({ includeEmpty: false }, (row: any) => {
        const rawValues = row.values as any[];
        if (Array.isArray(rawValues)) {
          // row.values en ExcelJS es 1-indexed
          const cleanValues = rawValues.slice(1).map((val) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'object') {
              if (val.result !== undefined) return String(val.result);
              if (val.text !== undefined) return String(val.text);
              if (Array.isArray(val.richText)) {
                return val.richText.map((r: any) => r.text || '').join('');
              }
              if (val instanceof Date) {
                return val.toISOString().split('T')[0];
              }
              return JSON.stringify(val);
            }
            return String(val).trim();
          });

          // Solo incluir filas que tengan al menos un valor no vacío
          if (cleanValues.some((v) => v.length > 0)) {
            rows.push(cleanValues.join(' | '));
          }
        }
      });

      if (rows.length > 0) {
        sheetsText.push(`[Hoja de Cálculo: "${worksheet.name}"]\n${rows.join('\n')}`);
      }
    });

    return sheetsText.join('\n\n');
  } catch (err: any) {
    console.error('Error al parsear archivo Excel con ExcelJS:', err);
    throw new Error(`No se pudo leer la planilla Excel: ${err?.message || 'Formato no soportado'}`);
  }
}

/**
 * Extrae el texto y tablas de un documento Word (.docx, .doc)
 */
export async function parseWordToText(buffer: Buffer): Promise<string> {
  try {
    if (typeof process !== 'undefined' && typeof (process as any).umask !== 'function') {
      (process as any).umask = () => 0;
    }
    const mammothModule = await import('mammoth');
    const mammoth = (mammothModule as any).default || mammothModule;
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value ? result.value.trim() : '';

    if (!text) {
      // Intento de fallback para caracteres legibles si el archivo tiene formato particular
      const rawStr = buffer.toString('utf-8');
      const printable = rawStr.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (printable.length > 50) {
        return printable;
      }
    }

    return text;
  } catch (err: any) {
    console.error('Error al extraer texto de documento Word con Mammoth:', err);
    throw new Error(`No se pudo leer el documento Word: ${err?.message || 'Formato no compatible'}`);
  }
}
