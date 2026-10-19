export type TicketTipo = 'error' | 'mejora' | 'consulta' | 'urgente';

export type TicketPrioridad = 'baja' | 'media' | 'alta' | 'critica';

export type TicketEstado = 'abierto' | 'en_revision' | 'en_desarrollo' | 'resuelto' | 'cerrado';

export interface TicketItem {
  id: string; // Ej: TCK-2026-0001
  numero: number;
  tipo: TicketTipo;
  prioridad: TicketPrioridad;
  estado: TicketEstado;
  modulo: string; // 'Cotizador', 'Clientes & Contactos', 'Pipeline & Oportunidades', 'Tarifario', 'Salesforce CRM', 'General / Otro'
  titulo: string;
  descripcion: string;
  capturaPantalla?: string; // Data URL base64 o URL
  // Datos automáticos del solicitante
  usuarioId?: string;
  usuarioNombre: string;
  usuarioEmail: string;
  usuarioRol: string;
  // Fechas y marcas de tiempo
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  fechaFormateada: string; // Formato legible Chile: DD/MM/YYYY HH:mm
  // Respuestas y parches del Superadmin
  notasAdmin?: string;
  resueltoPor?: string;
  resueltoEn?: string;
}

export interface TicketInput {
  tipo: TicketTipo;
  prioridad: TicketPrioridad;
  modulo: string;
  titulo: string;
  descripcion: string;
  capturaPantalla?: string;
}

