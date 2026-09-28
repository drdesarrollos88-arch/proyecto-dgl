import { getCotizaciones, getFormatoSettings } from '../lib/db';
import { generateCotizacionPdf } from '../lib/pdf-generator';

const cots = getCotizaciones();
const formato = getFormatoSettings();
console.log('Total cotizaciones in db:', cots.length);

if (cots.length > 0) {
  for (const cot of cots) {
    const doc = generateCotizacionPdf(cot, undefined, formato);
    const pdfOutput = doc.output();
    const hasNewTitle = pdfOutput.includes('División Geotecnia Laboratorio') || pdfOutput.includes('Divisi\u00f3n Geotecnia Laboratorio');
    const hasOldTitle = pdfOutput.includes('Laboratorio de Mecánica de Suelos y Materiales') || pdfOutput.includes('Laboratorio de Mec\u00e1nica de Suelos y Materiales');
    console.log(`Cotizacion ${cot.code}: hasNewTitle = ${hasNewTitle}, hasOldTitle = ${hasOldTitle}`);
    if (!hasNewTitle || hasOldTitle) {
      throw new Error(`Failed on cotizacion ${cot.code}`);
    }
  }
}

console.log('ALL EXISTING COTIZACIONES VERIFIED WITH: División Geotecnia Laboratorio');

