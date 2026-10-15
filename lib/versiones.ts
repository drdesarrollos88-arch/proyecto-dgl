export interface VersionRegistro {
  version: string;
  tag: string;
  fecha: string;
  fechaFormato: string;
  estado: 'activa' | 'previa';
  titulo: string;
  modulos: string[];
  descripcion: string;
  detalles: string[];
  autor?: string;
}

export const HISTORIAL_VERSIONES: VersionRegistro[] = [
  {
    version: '2.4.2',
    tag: 'v2.4.2',
    fecha: '2026-10-15',
    fechaFormato: '15 de Octubre, 2026',
    estado: 'activa',
    titulo: 'Cálculo y Visualización Opcional de Masa de Muestras en Cotizaciones y PDF',
    modulos: ['Cotizador', 'Formatos', 'PDF Oficial'],
    descripcion:
      'Incorporación de cálculo de kilos totales por ensayo (masa unitaria × cantidad), desglose de muestra unitaria total y masa total acumulada en resumen inferior, con controles independientes para mostrar u ocultar cada uno de los 3 ítems en la propuesta comercial y PDF oficial.',
    detalles: [
      'Columna opcional "Masa Tot. (kg)" en tabla interactiva y PDF oficial calculada automáticamente como masa unitaria × cantidad de ensayos solicitados.',
      'Indicador de cantidad de muestra unitaria total (considerando 1 solo ensayo de cada tipo listado) en el resumen inferior y notas oficiales de laboratorio.',
      'Indicador de cantidad total estimada de muestra (masa acumulada total a entregar en laboratorio) en el resumen inferior y notas oficiales.',
      'Panel interactivo de 3 selectores en el Cotizador para activar u omitir cada elemento de muestra de forma independiente.',
      'Nota técnica aclaratoria institucional ("Cantidad de material indicado es estimativo y se deberá confirmar con laboratorio la cantidad por enviar") integrada directamente en la tarjeta de Masa de Muestras del Cotizador y en la Sección 1.2 del PDF Oficial.',
      'Persistencia de la configuración de visualización de muestras en base de datos y versionado histórico de cotizaciones.',
      'Adaptación geométrica automática de columnas en el PDF oficial Letter garantizando márgenes y legibilidad institucional.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.1',
    tag: 'v2.4.1',
    fecha: '2026-10-15',
    fechaFormato: '15 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Cuentas Internacionales, Filtro por Usuario en Auditoría y Permisos Granulares RBAC',
    modulos: ['Auditoría', 'Salesforce', 'Cotizador', 'Seguridad RBAC', 'Formatos'],
    descripcion:
      'Actualización integral con soporte de cuentas internacionales en Salesforce y documentos oficiales, filtrado de eventos por usuario en bitácora de auditoría, control de permisos granulares RBAC para todos los módulos y filtrado contextual de centros de costo.',
    detalles: [
      'Omisión automática de RUT comodín 5555555-5 en PDF y Excel para clientes extranjeros e internacionales.',
      'Sincronización a Salesforce por Razón Social real en cuentas internacionales, evitando vinculaciones erróneas por RUT genérico.',
      'Filtrado dinámico de Centros de Costo en Cotizador según Sección DGL seleccionada (SGL, SLGP, Sin Sección DGL).',
      'Filtro por usuario registrado en Bitácora de Auditoría para trazabilidad individual de interacciones y modificaciones.',
      'Expansión del sistema de permisos RBAC para nuevos módulos: Conciliador de Ventas, Cierre de Oportunidades, Estructura Tarifaria, Asistente IA, RAG y Auditoría.',
      'Mejoras ergonómicas consolidadas: redacción de notas con espacios/saltos de línea (Shift+Enter/Alt+Enter), cierre con X en visor PDF y modificación porcentual masiva de tarifas.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.0',
    tag: 'v2.4.0',
    fecha: '2026-10-15',
    fechaFormato: '15 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Módulo de Auditoría Integral y Control de Versiones',
    modulos: ['Auditoría', 'Seguridad', 'Infraestructura Nube'],
    descripcion:
      'Implementación de bitácora de auditoría inmutable en Supabase con trazabilidad de eventos en tiempo real, registro histórico de cotizaciones, descargas oficiales y módulo de control de versiones desplegadas.',
    detalles: [
      'Persistencia de bitácora en PostgreSQL Supabase con protección contra modificaciones o eliminaciones accidentales (trigger inmutable).',
      'Trazabilidad de inicios de sesión, cambios en propuestas comerciales, tarifas, usuarios y clientes.',
      'Nueva sección de "Historial de Versiones" para visualización ejecutiva de cambios y despliegues en producción.',
      'Exportación certificada de auditoría a CSV/Excel con protección contra inyección de fórmulas.',
      'Paginación del lado del servidor y filtros combinados por fechas, usuario y módulo.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.3.1',
    tag: 'v2.3.1',
    fecha: '2026-10-14',
    fechaFormato: '14 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Actualización Masiva Porcentual de Tarifario',
    modulos: ['Tarifario', 'Comercial'],
    descripcion:
      'Herramienta de modificación masiva de precios mediante selección múltiple de ensayos y aplicación controlada de porcentaje.',
    detalles: [
      'Selección individual o grupal de partidas del tarifario oficial para ajuste rápido de valores.',
      'Aplicación de incremento o decremento porcentual (%) con recálculo automático de subtotales en UF y CLP.',
      'Validación preventiva de márgenes comerciales antes de confirmar cambios en base de datos.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.3.0',
    tag: 'v2.3.0',
    fecha: '2026-10-13',
    fechaFormato: '13 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Ergonomía en Observaciones Técnicas y Visor de PDF',
    modulos: ['Cotizador', 'Propuestas Técnicas', 'UI/UX'],
    descripcion:
      'Mejoras ergonómicas en la redacción de notas por ensayo y optimización del visor documental de cotizaciones.',
    detalles: [
      'Soporte completo para espacios tipográficos y saltos de línea (Shift+Enter / Alt+Enter) en observaciones técnicas de ensayos.',
      'Botón de cierre directo (✕) y tecla Escape en el modal de visualización de PDFs oficiales y borradores.',
      'Mejoras de rendimiento en renderizado de documentos extensos.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.2.0',
    tag: 'v2.2.0',
    fecha: '2026-10-12',
    fechaFormato: '12 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Integración Salesforce IDIEM: Planilla Interactiva y Cuentas Comerciales',
    modulos: ['Salesforce', 'Conciliador', 'Ventas'],
    descripcion:
      'Visualizador comercial tipo planilla de cálculo y filtrado selectivo de oportunidades por Cuenta Comercial de Salesforce.',
    detalles: [
      'Vista en columnas tipo tabla Excel para visualización y conciliación rápida de oportunidades comerciales.',
      'Filtro inteligente para incluir o excluir oportunidades que contengan la etiqueta "Cuenta Comercial Salesforce".',
      'Integración directa con contactos y cuentas corporativas de Salesforce para evitar duplicidad con la base de datos local.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.1.0',
    tag: 'v2.1.0',
    fecha: '2026-10-09',
    fechaFormato: '09 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Arquitectura Nube Resiliente y Base de Datos Supabase',
    modulos: ['Infraestructura', 'Base de Datos', 'Rendimiento'],
    descripcion:
      'Migración completa de datos a Supabase PostgreSQL y despliegue optimizado en edge workers de Cloudflare.',
    detalles: [
      'Base de datos relacional robusta en la nube con pooler de conexiones de alta concurrencia.',
      'Políticas de seguridad por filas (RLS) y aislamiento multi-rol.',
      'Parches de compatibilidad de runtime para compatibilidad 100% con Cloudflare Workers.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.0.0',
    tag: 'v2.0.0',
    fecha: '2026-10-02',
    fechaFormato: '02 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Motor de Inteligencia Artificial para Ensayos y Normativa Geotécnica',
    modulos: ['Inteligencia Artificial', 'Bibliografía', 'Cotizador'],
    descripcion:
      'Incorporación del asistente IA para análisis semántico de solicitudes de ensayo y correlación con normas NCh y ASTM.',
    detalles: [
      'Búsqueda semántica (RAG) sobre repositorio bibliográfico y especificaciones técnicas IDIEM.',
      'Desglose predictivo de ensayos requeridos según tipo de suelo y proyecto vial o minero.',
      'Chat interactivo contextualizado para formulación rápida de cotizaciones.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '1.0.0',
    tag: 'v1.0.0',
    fecha: '2026-09-15',
    fechaFormato: '15 de Septiembre, 2026',
    estado: 'previa',
    titulo: 'Lanzamiento Inicial del Sistema de Cotizaciones DGL',
    modulos: ['Cotizador', 'Tarifario', 'Clientes', 'Formatos'],
    descripcion:
      'Versión fundacional del sistema web de cotizaciones del Departamento de Geotecnia y Laboratorio (DGL).',
    detalles: [
      'Catálogo maestro de ensayos clasificados por especialidad (Mecánica de Suelos, Rocas, Asfaltos, Hormigones).',
      'Generación oficial de propuestas en formato PDF y hojas de cálculo Excel.',
      'Control de correlativos automáticos por centro de costo DGL (1817, 2339, 2340, 2341).',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
];

export function getVersionActual(): VersionRegistro {
  return HISTORIAL_VERSIONES.find((v) => v.estado === 'activa') || HISTORIAL_VERSIONES[0];
}

export function getHistorialVersiones(): VersionRegistro[] {
  return HISTORIAL_VERSIONES;
}

