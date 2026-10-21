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
    version: '2.7.1',
    tag: 'v2.7.1',
    fecha: '2026-10-21',
    fechaFormato: '21 de Octubre, 2026',
    estado: 'activa',
    titulo: 'Motor Unificado de Cálculo y Cuadre Matemático Estricto de Cotizaciones (UF, CLP, USD)',
    modulos: ['Cotizador', 'Motor de Cálculo', 'Generador PDF', 'Generador Excel', 'Supabase DB'],
    descripcion:
      'Refactorización exhaustiva del cálculo de montos en cotizaciones con biblioteca canónica centralizada (lib/cotizacion-calculations.ts). Garantiza cuadre aritmético exacto entre ítems, subtotales por partida y totales consolidados en UF, CLP y USD, eliminando descalces por variaciones de indicadores económicos, factores o cambios de moneda.',
    detalles: [
      'Librería Canónica de Cálculo: Centralización de reglas aritméticas en calculateItemSubtotals, recalculateCotizacionItems y calculateCotizacionTotals.',
      'Sincronización Dinámica de Monedas: Al modificar el valor de la UF o del Dólar, o cambiar la divisa de la cotización, todos los ítems recalculan sus equivalencias preservando la integridad de los valores de referencia sin pérdidas de precisión.',
      'Cuadre de Subtotales y Totales: Eliminación de desajustes de centavos en USD y pesos en CLP mediante sumatoria aditiva estricta (Total Partida = Suma de ítems; Total General = Suma de partidas).',
      'Paridad Total en Exportaciones: Actualización de los generadores de PDF y Excel para compartir exactamente el mismo pipeline de cálculo que la interfaz web y la base de datos.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.7.0',
    tag: 'v2.7.0',
    fecha: '2026-10-19',
    fechaFormato: '19 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Módulo de Tickets & Soporte Técnico y Paneles Detallados Salesforce DGL',
    modulos: ['Tickets & Soporte', 'Oportunidades & CRM', 'Salesforce Dashboards', 'Gestión Comercial'],
    descripcion:
      'Lanzamiento del nuevo sistema integral de Tickets y Soporte Técnico para reporte y seguimiento de incidencias, mejoras y solicitudes operativas, junto con la incorporación de paneles detallados de Salesforce estilo presentación comercial oficial para análisis exhaustivo de Ventas Ganadas y Cotizaciones/Pipeline de la División DGL.',
    detalles: [
      'Sistema de Tickets & Soporte: Módulo completo (/tickets) con registro de incidencias, categorización por tipo (Error, Mejora, Soporte, Otro), prioridades (Urgente, Alta, Media, Baja), estados (Abierto, En Progreso, Resuelto, Cerrado) y gestión administrativa.',
      'Paneles Detallados Salesforce: Incorporación de modales analíticos SalesforceVentasDashboardModal y SalesforceCotizacionesDashboardModal con acceso directo desde las tarjetas de KPI del módulo de Oportunidades.',
      'Precisión Cronológica Salesforce: Disociación rigurosa entre la fecha oficial de cierre de negocio (fechaCierreNegocio) y la fecha de última emisión de cotización (fechaUltimoEnvioCotizacion), con cálculo nativo de montos en UF.',
      'Acceso Rápido en Navbar: Enlace directo y dinámico con badge de administración para el seguimiento de tickets en tiempo real.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.6.2',
    tag: 'v2.6.2',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Dashboard Dual 50/50 (Ventas vs Cotizaciones), Metas Multi-Año y Fix Salesforce SOQL',
    modulos: ['Oportunidades & CRM', 'Metas Comerciales', 'Salesforce SOQL', 'Dashboard Dual'],
    descripcion:
      'Refactorización profunda del módulo de Oportunidades: división fija en DGL, selector de año sincronizado con años presupuestados creados, creación dinámica de años futuros para asignación de metas, dashboard dual 50/50 (mitad Ventas Ganadas vs mitad Cotizaciones/Pipeline) con gráficos de 12 meses y rankings independientes, y corrección en SOQL de Salesforce para importación masiva sin errores.',
    detalles: [
      'División DGL Exclusiva: Se removieron los selectores de otras divisiones, anclando el CRM exclusivamente a la División DGL.',
      'Dashboard Dual 50/50: Panel izquierdo especializado en Ventas Facturadas/Ganadas (KPIs, cumplimiento de meta de venta, evolución 12 meses y ranking de vendedores) y panel derecho especializado en Cotizaciones & Pipeline (KPIs de emisión, meta de cotización, evolución 12 meses y ranking de cotizadores).',
      'Gestión Dinámica de Años Presupuestarios: Capacidad de añadir nuevos años de objetivos (ej. 2027, 2028), desplegando inmediatamente los 12 meses para definir metas y sincronizando el selector global superior.',
      'Fix de Consulta SOQL en Salesforce: Eliminada la relación inválida Cuotas_de_facturacion__r para importar oportunidades limpiamente y mapearlas en Cerradas ganadas, Propuesta enviada y Cerradas perdidas.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.6.1',
    tag: 'v2.6.1',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Conexión Directa del Pipeline con Supabase (Paridad Total con Histórico)',
    modulos: ['Oportunidades & CRM', 'Base de Datos', 'Supabase'],
    descripcion:
      'Alineación 1 a 1 entre el nuevo Pipeline Comercial y el Histórico de Cotizaciones: el servicio de oportunidades ahora lee directamente desde Supabase en tiempo real (getCotizacionesAsync), eliminando registros residuales o de prueba y aplicando un parser tolerante de fechas (DD-MM-YYYY y YYYY-MM-DD) con ordenamiento cronológico descendente.',
    detalles: [
      'Fuente única de verdad: El pipeline comercial ahora consulta directamente la tabla de cotizaciones en Supabase, garantizando paridad absoluta con el histórico oficial.',
      'Normalización de fechas: Detección y normalización de formatos DD-MM-YYYY para asignación precisa de mes y año en los filtros y métricas YTD.',
      'Ordenamiento cronológico: Las cotizaciones más recientes de 2026 aparecen inmediatamente al tope del pipeline.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.6.0',
    tag: 'v2.6.0',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Módulo Principal de Oportunidades & Pipeline Comercial (CRM Unificado)',
    modulos: ['Oportunidades & CRM', 'Salesforce Sync', 'Control de Gestión', 'Metas Comerciales'],
    descripcion:
      'Lanzamiento del nuevo Módulo Principal de Oportunidades & Pipeline Comercial como pantalla de inicio del sistema (al ingresar y al pinchar Laboratorio Geotécnico DGL). Permite la importación y sincronización masiva de oportunidades históricas de Salesforce vía SOQL, listado unificado distinguiendo entre cotizaciones creadas en el portal y registros de Salesforce, dashboards mensuales y acumulados (YTD) y comparativa en tiempo real de metas presupuestadas vs ventas reales.',
    detalles: [
      'Punto de entrada principal: Redirección automática de la raíz y del branding superior "Laboratorio Geotécnico DGL" hacia el nuevo módulo /oportunidades.',
      'Sincronización histórica con Salesforce: Extracción SOQL en vivo de oportunidades y cuotas de períodos y años anteriores con almacenamiento resiliente.',
      'Doble distinción de origen: Identificación clara mediante badges [Web DGL] (con acceso a abrir la cotización técnica) y [Salesforce] (con identificador y cuotas).',
      'Dashboards ejecutivos YTD: Indicadores de cumplimiento de ventas (% y gap), pipeline en curso, volumen cotizado, tasa de conversión y ticket promedio.',
      'Metas y Presupuestos: Soporte para configurar y evaluar metas comerciales mensuales y acumuladas con gráfico de evolución de los 12 meses del año.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.5.0',
    tag: 'v2.5.0',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Conciliador EERR vs Salesforce v2.0: Motor Multicriterio N:M, Mesa de Cirugía 50/50 y Staging Auditable',
    modulos: ['Conciliador v2.0', 'Salesforce API', 'Control de Gestión', 'Arquitectura Modular'],
    descripcion:
      'Refactorización profunda (Versión 2.0) del Módulo de Conciliación EERR vs Salesforce de IDIEM (DGL): soporte nativo para relaciones N:M, aislamiento de Traspasos Internos (TI) y Notas de Crédito (NC), solver Subset-Sum para clientes corporativos, matriz de scoring ponderado con penalización de colisión de proyectos, Workbench 50/50 y Pre-Flight Check con blindaje de Oportunidad__c obligatorio.',
    detalles: [
      'Motor Multicriterio Determinista v2.0: Fase 0 de higiene contable (aislamiento TI y neteo NC), extractor Regex tolerante de código completo y núcleo de proyecto, Fase 1 de Pre-Clustering N:M por RUT + Núcleo, Fase 2 con solver Subset-Sum (±2.5% UF) y Fase 3 con matriz de scoring (0-100 pts) y penalización crítica (-100 pts) ante códigos de proyecto distintos en holdings mineros.',
      'Arquitectura UI Modular Inbox Zero: Descomposición del monolito en 4 componentes especializados (ConciliadorHeaderBalance, ConciliadorStepperTabs, TabMesaCirugiaSplit y StagingPreFlightModal) y orquestador limpio (< 350 líneas).',
      'Mesa de Cirugía Split-Screen 50/50: Vinculación manual N:M interactiva con auto-filtrado por RUT, sugerencias Top 3 con ScoreBreakdown, postergación masiva de cuotas por comercial y análisis IA Gemini On-Demand en batch.',
      'Blindaje de Integridad Salesforce (Pre-Flight Check): Carrito de acciones tipado con uniones discriminadas (UPDATE_MONTO, UPDATE_FECHA, CREATE_CUOTA), validación estricta de opportunityId obligatorio, exportación previa a CSV/Excel y log auditable valorAnterior -> valorNuevo.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.6',
    tag: 'v2.4.6',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Tema Oscuro Inspirado en Jira Software (Atlassian Design System)',
    modulos: ['UI / Tema', 'Cotizador', 'Accesibilidad', 'Dashboard'],
    descripcion:
      'Reconfiguración completa de la paleta de modo oscuro adoptando la estética y profundidad oficial de Jira Software (Atlassian Design System): fondo deep slate #1D2125, columnas y sub-bloques sunken #161A1D, tarjetas elevadas #22272B, acento Jira Blue #579DFF y etiquetas nítidas #9FADBC.',
    detalles: [
      'Jerarquía visual de 3 capas Jira: Canvas base (#1D2125), contenedores y columnas tipo Kanban/DGL (#161A1D) y tarjetas elevadas con modales (#22272B).',
      'Bordes y separadores de alta definición: trazos sutiles en #2C333A y #3B444C que delimitan con elegancia cada módulo sin saturar la vista.',
      'Tipografía calibrada Atlassian: títulos y valores principales en blanco marfil (#F1F2F4) y etiquetas/subtextos en gris pizarra (#9FADBC).',
      'Acentos y badges funcionales: azul Jira (#579DFF) para interactividad y botones clave, teal/verde (#164547/#57D9A3) estilo MAC OS para UF e indicadores, y ámbar (#382800/#F5CD47) para muestras.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.5',
    tag: 'v2.4.5',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Alto Contraste y Legibilidad en Casillas Grises para Modo Oscuro',
    modulos: ['UI / Tema', 'Cotizador', 'Accesibilidad'],
    descripcion:
      'Calibración de tipografía de alto contraste (#0f172a / #1e293b) en todas las casillas, bloques y elementos con fondos o tonalidades grises en modo oscuro, garantizando máxima legibilidad en etiquetas de clasificación DGL, Salesforce, indicadores oficiales y tablas.',
    detalles: [
      'Contraste garantizado en bloques grises: todas las etiquetas (Sección DGL, Unidad/CC, Sector, Subsector, Zona), títulos y textos descriptivos sobre contenedores grises (slate/gray/zinc con o sin opacidad) ahora utilizan texto oscuro profundo de alto contraste (#0f172a).',
      'Compatibilidad anidada: las tarjetas oscuras interiores (.bg-white -> #252526) e inputs/selects mantienen su tipografía clara y bordes minimalistas sin verse afectadas por las reglas del contenedor padre.',
      'Indicadores económicos destacados: valores numéricos de UF y divisas en modo oscuro calibrados con tonos esmeralda brillantes (#34d399) para lectura inmediata.',
      'Soporte transversal en todo el sistema: aplica automáticamente a casillas de cotizador, conciliador, opciones de muestras y encabezados de tablas.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.4',
    tag: 'v2.4.4',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Estructura Jerárquica en Salesforce, Configuración de Masa y Tema Oscuro Minimalista',
    modulos: ['Salesforce', 'Cotizador', 'Formatos', 'UI / Tema'],
    descripcion:
      'Carga estricta y jerárquica de datos guardados hacia Salesforce (filtrado contextual de Centros de Costo según Sección DGL), nuevos valores predeterminados para visualización de muestras con control maestro de activación y diseño minimalista con soporte para Tema Claro y Tema Oscuro.',
    detalles: [
      'Sincronización jerárquica con Salesforce: el modal de envío a Salesforce carga con precisión los datos guardados en la cotización y filtra los Centros de Costo en función de la Sección DGL seleccionada (SGL, SLGP, Sin Sección).',
      'Persistencia de clasificación DGL: normalización de códigos de centros de costo (4 dígitos) evitando desajustes y fallbacks obsoletos en bases de datos.',
      'Configuración de Masa (kg): las notas de material y observaciones técnicas vienen desactivadas por defecto, manteniendo activada únicamente la columna de masa individual por ensayo.',
      'Control maestro de activación de masa: incorporación de un switch global "Activar todo / Desactivar todo" para alternar con un solo clic los 5 controles de kilos de muestra.',
      'Tema Claro y Oscuro Minimalista: interruptor toggle compacto integrado en la barra superior junto al perfil de usuario, con persistencia local y calibración exacta al esquema de color carbón/neutral de Antigravity (#1e1e1f, #252526, #333335).',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.3',
    tag: 'v2.4.3',
    fecha: '2026-10-16',
    fechaFormato: '16 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Cargo Comercial Dinámico por Perfil y Asignación Directa de Ensayos a Partidas',
    modulos: ['Cotizador', 'PDF Oficial', 'Usuarios / Perfil', 'Base de Datos'],
    descripcion:
      'Resolución de asignación dinámica de cargo comercial según el perfil del usuario emisor (evitando fallbacks hardcodeados en cotizaciones y PDF), e incorporación de un sistema ergonómico para buscar y agregar ensayos directamente a una partida o subdivisión específica.',
    detalles: [
      'Cargo Comercial Dinámico: el cargo del usuario emisor se obtiene directamente de su perfil configurado (ej. "Jefe División Geotecnia Laboratorio") tanto en la cabecera como en la firma del PDF Oficial y Cotizador.',
      'Persistencia de cargo en base de datos: corrección en la deserialización y persistencia de cotizaciones para evitar sobrescrituras con valores genéricos predeterminados.',
      'Asignación directa de ensayos a partidas: nuevo selector de destino integrado en la barra de búsqueda ("Destino: [Partida X / Al final]") para dirigir las búsquedas de tarifario.',
      'Acceso contextual en cada partida: botón "+ Agregar ensayo aquí" en la cabecera de cada partida y al pie de sus subtotales, enfocando automáticamente el buscador y preseleccionando esa sección.',
      'Inserción inteligente y renumeración: los ensayos se insertan exactamente al final de la partida seleccionada (antes de la siguiente) recalculando en tiempo real la numeración jerárquica (1.1.X.Y).',
      'Despliegue automático: si la partida destino se encontraba colapsada, se expande automáticamente al agregar el ensayo para confirmación visual inmediata del usuario.',
    ],
    autor: 'Equipo de Desarrollo DGL',
  },
  {
    version: '2.4.2',
    tag: 'v2.4.2',
    fecha: '2026-10-15',
    fechaFormato: '15 de Octubre, 2026',
    estado: 'previa',
    titulo: 'Cálculo y Visualización Opcional de Masa de Muestras en Cotizaciones y PDF',
    modulos: ['Cotizador', 'Formatos', 'PDF Oficial'],
    descripcion:
      'Incorporación de cálculo de kilos totales por ensayo (masa unitaria × cantidad), desglose de muestra unitaria total y masa total acumulada en resumen inferior, con 5 controles y gatillantes independientes para activar u ocultar columnas, cifras en pie de tabla ("Total Ensayos") y notas explicativas en Observaciones 1.2.',
    detalles: [
      'Columna opcional "Masa Tot. (kg)" en tabla interactiva y PDF oficial calculada automáticamente como masa unitaria × cantidad de ensayos solicitados.',
      'Indicador de cantidad de muestra unitaria total (considerando 1 solo ensayo de cada tipo listado) en el resumen inferior y notas oficiales de laboratorio.',
      'Indicador de cantidad total estimada de muestra (masa acumulada total a entregar en laboratorio) en el resumen inferior y notas oficiales.',
      'Gatillante independiente para cifras en pie de tabla: control para mostrar u ocultar los kilos en la fila de cierre "Total Ensayos" del PDF.',
      'Gatillante independiente para observaciones técnicas (Sección 1.2): control para mostrar u omitir las líneas de notas de masa bajo la tabla.',
      'Control de paginación de tabla (showFoot: lastPage): el Total General de Ensayos solo se imprime al final de todo el presupuesto en la última página, evitando repeticiones prematuras en páginas intermedias y garantizando que cada sección o partida presente su subtotal correspondiente.',
      'Nota técnica aclaratoria institucional ("Cantidad de material indicado es estimativo y se deberá confirmar con laboratorio la cantidad por enviar") integrada directamente en la tarjeta de Masa de Muestras del Cotizador y en la Sección 1.2 del PDF Oficial.',
      'Panel interactivo de 5 selectores en el Cotizador organizados en cálculos y ubicaciones independientes.',
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

