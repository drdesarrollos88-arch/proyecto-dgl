import { CotizacionCondicionesComerciales } from './types';

export const DEFAULT_OBSERVACIONES: string[] = [
  '1.2.1 Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de su recepción.',
  '1.2.2 La presente propuesta está generada a carácter informativo. La determinación de ensayos y sus cantidades dependerá de la estimación del cliente, a lo cual, la propuesta deberá ser ajustada a dicho detalle de ensayo.',
  '1.2.3 (*) Los ensayos realizados bajo normativas específicas indicadas podrían no contar con alcance de acreditación bajo LE-304 si corresponde.',
  '1.2.4 ¿El laboratorio tiene la capacidad y recursos para realizar las actividades?: [X] SÍ    [ ] NO',
];

export const DEFAULT_CLAUSULAS_ESPECIALES: string[] = [
  'De acuerdo con lo dispuesto en el artículo 40 de la Ley No 21.094 Sobre Universidades Estatales y el Oficio No 1.216, de 19.04.2023 del Servicio de Impuestos Internos, los servicios aquí ofertados se encuentran exentos de IVA.',
  'Si un cliente se encuentra en mora con IDIEM, solo podrá solicitar nuevos servicios si cancela la deuda anterior y documenta los nuevos servicios solicitados.',
  'Presupuesto elaborado en base a un total estimado, se cobrará lo efectivamente realizado.',
  'No se enviarán informes parciales o preliminares sin EDP u OC asociada.',
  'Con la aceptación de esta cotización y en caso de ser necesario vuestra empresa se compromete a proporcionar acceso a sus dependencias, obras o instalaciones a los equipos de evaluación del INN, para evaluar así el desempeño del OEC en la realización de las actividades del laboratorio IDIEM.',
];

export const DEFAULT_CLAUSULAS_FACTURACION: string[] = [
  'Se emitirá Estado de Pago mensual correspondiente a los trabajos ejecutados y se enviará al cliente para su revisión. Una vez aprobado el Estado de Pago (EDP), se emitirá Factura en pesos chilenos, con el valor de la Unidad de Fomento a la fecha emisión de la Factura.',
  'Una vez recibido EDP mensual aprobado, se emitirá informe el cual será enviado en un plazo de tres (03) días hábiles.',
  'Para la emisión de facturas se realizará con orden de compra y/o estado de pago aprobado, en el cual el cliente acepta estar de acuerdo con el servicio y el monto entregado.',
  'Para determinar la fecha de vencimiento del documento, para efectos de pago se considera la fecha de emisión del documento.',
  'En el caso que el cliente incurra en mora se aplicará un interés diario máximo permitido por ley. Si el cliente no regulariza su condición de mora se procederá a informar la deuda en el boletín comercial.',
  'Si el pago se realiza con depósito o trasferencia en cuenta corriente, este debe ser efectuado a nombre de Universidad de Chile, RUT: 60.910.000-1, en pesos chilenos en la cuenta N ° 170-006-44-01 , y si es en dólares a la cuenta N ° 03-00004-54-7, ambas del Banco de Chile. Se debe enviar el respaldo a cobranzas@idiem.cl.',
];

export const DEFAULT_CLAUSULAS_TECNICAS: string[] = [
  'La recepción de muestras se realizará sólo cuando éstas incluyan: los datos de la empresa mandante, el nombre del proyecto asociado y un contacto donde obtener información con respecto a los ensayos a realizar. Es necesario que estos datos se encuentren adjuntos a las muestras o que sean comunicados con anterioridad al correo ingresosdgl@idiem.cl. En caso que las muestras se envíen a IDIEM por cualquier medio sin esta información, no serán recepcionadas por nuestra institución, por lo anterior, no se responsabilizará por éstas.',
  'Ensayos básicos, especiales y rocas: Salomon Sack 840, Cerrillos. Las muestras enviadas en sacos no deben superar los 20 kg. Si las muestras superan dicha capacidad, se deberá informar previo a la llegada para la evaluación logística de su recepción y el cliente deberá esperar confirmación de disponibilidad de recepción.',
  'Ensayos grandes partículas: Salomón Sack 840, Cerrillos. Las muestras deben ser enviadas en maxisacos sobre camión plano para ser descargado por grúa horquilla, en caso contrario se debe considerar el equipamiento para descargar el material por parte del mandante (camión pluma o grúa de mayor capacidad), no se acepta material en granel.',
  'A contar de la fecha de recepción de las muestras en el laboratorio, los ensayos deberán ser programados en un plazo menor a 5 días hábiles. En el caso que no sea enviado el programa de ensayos, se procederá al envío de una cotización por concepto de almacenamiento, si no hubiera respuesta por parte del cliente las muestras serán eliminadas del laboratorio.',
  'Los plazos de entrega de informes dependerán de cada tipo de ensayo, los cuales serán confirmados por el laboratorio al momento de la programación de ensayos entregada por el ingeniero a cargo de las muestras.',
  'El tiempo de almacenamiento de las muestras de mecánica de suelos recepcionadas y/o ensayadas, será de 15 días corridos a partir de la fecha de emisión del informe. Posterior a este plazo las muestras serán desechadas. Si el cliente requiere que sean guardadas por un plazo posterior a lo indicado en este punto, deberá notificarlo por correo oportunamente al ingeniero de proyecto y se le enviará cotización por concepto de almacenamiento.',
];

export const PAYMENT_CONDITION_PRESETS = [
  '50% AL CONTADO Y 50% CONTRA ENTREGA',
  '100% CONTRA ENTREGA DE INFORMES',
  '30 DÍAS F/F (FECHA FACTURA)',
  '60 DÍAS F/F',
  '100% CONTADO / ANTICIPADO',
  'ESTADO DE PAGO MENSUAL A 30 DÍAS',
];

export const VIGENCIA_PRESETS = [
  '15 días',
  '30 días',
  '45 días',
  '60 días',
  '90 días',
];

export function getDefaultCondicionesComerciales(
  paymentCondition?: string
): CotizacionCondicionesComerciales {
  return {
    vigenciaDias: '30 días',
    plazoEntrega: 'Según programación y tipo de ensayo tras recepción conforme de muestras',
    condicionVenta: paymentCondition || '50% AL CONTADO Y 50% CONTRA ENTREGA',
    clausulasParticulares: [],
    clausulasEspeciales: [...DEFAULT_CLAUSULAS_ESPECIALES],
    clausulasFacturacion: [...DEFAULT_CLAUSULAS_FACTURACION],
    clausulasTecnicas: [...DEFAULT_CLAUSULAS_TECNICAS],
  };
}
