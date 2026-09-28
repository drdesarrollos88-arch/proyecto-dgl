-- =========================================================================
-- ESQUEMA OFICIAL DE BASE DE DATOS DGL IDIEM EN SUPABASE (POSTGRESQL)
-- =========================================================================

-- 1. TABLA: USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  rut TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendedor',
  commercial_title TEXT,
  phone TEXT,
  commercial_initials TEXT,
  signature TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);

-- 2. TABLA: PERFILES DE USUARIO
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_system BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: TARIFARIO MAESTRO (358 Ensayos Oficiales IDIEM)
CREATE TABLE IF NOT EXISTS tarifario (
  sku TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  designation TEXT NOT NULL,
  norm TEXT,
  cc TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'c/u',
  uf_price NUMERIC(12, 4) NOT NULL DEFAULT 0,
  group_name TEXT,
  family TEXT,
  subfamily TEXT,
  sample_type TEXT,
  notes TEXT,
  days INTEGER,
  accredited BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tarifario_code ON tarifario(code);
CREATE INDEX IF NOT EXISTS idx_tarifario_cc ON tarifario(cc);
CREATE INDEX IF NOT EXISTS idx_tarifario_designation ON tarifario USING gin(to_tsvector('spanish', designation));

-- 4. TABLA: COTIZACIONES
CREATE TABLE IF NOT EXISTS cotizaciones (
  id TEXT PRIMARY KEY,
  correlativo TEXT NOT NULL,
  code TEXT NOT NULL,
  year INTEGER NOT NULL,
  date TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_rut TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  project_name TEXT,
  project_address TEXT,
  centro_costo TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  user_initials TEXT,
  currency TEXT NOT NULL DEFAULT 'UF',
  uf_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  subtotal_neto NUMERIC(12, 4) NOT NULL DEFAULT 0,
  descuento_porcentaje NUMERIC(5, 2) DEFAULT 0,
  descuento_monto NUMERIC(12, 4) DEFAULT 0,
  total_neto NUMERIC(12, 4) NOT NULL DEFAULT 0,
  iva NUMERIC(12, 4) NOT NULL DEFAULT 0,
  total NUMERIC(12, 4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Borrador',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations JSONB DEFAULT '[]'::jsonb,
  validity_days INTEGER DEFAULT 30,
  delivery_time TEXT,
  payment_terms TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_correlativo ON cotizaciones(correlativo);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_client ON cotizaciones(client_name);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_user_email ON cotizaciones(user_email);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_status ON cotizaciones(status);

-- 5. TABLA: CLIENTES (25.000+ Empresas de Chile)
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rut TEXT NOT NULL,
  comuna TEXT,
  address TEXT,
  giro TEXT,
  phone TEXT,
  payment_condition TEXT,
  email TEXT,
  contact_person TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clientes_name ON clientes(name);
CREATE INDEX IF NOT EXISTS idx_clientes_rut ON clientes(rut);
CREATE INDEX IF NOT EXISTS idx_clientes_search ON clientes USING gin(to_tsvector('spanish', name || ' ' || rut));

-- 6. TABLA: CONTACTOS
CREATE TABLE IF NOT EXISTS contactos (
  email TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  company TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contactos_name ON contactos(name);
CREATE INDEX IF NOT EXISTS idx_contactos_company ON contactos(company);

-- 7. TABLA: PROYECTOS
CREATE TABLE IF NOT EXISTS proyectos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  reference TEXT,
  city TEXT,
  client_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proyectos_name ON proyectos(name);
CREATE INDEX IF NOT EXISTS idx_proyectos_client ON proyectos(client_name);

-- 8. TABLA: REGLAS DE APRENDIZAJE IA
CREATE TABLE IF NOT EXISTS reglas_aprendidas (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  termino_usuario TEXT NOT NULL,
  codigo_ensayo TEXT,
  designacion TEXT,
  observacion_sugerida TEXT,
  origen TEXT NOT NULL DEFAULT 'chat_ia',
  estado TEXT NOT NULL DEFAULT 'activo',
  conteo_confirmaciones INTEGER DEFAULT 1,
  fecha_creacion TIMESTAMPTZ DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reglas_termino ON reglas_aprendidas(termino_usuario);

-- 9. TABLA: CASOS RAG DE REFERENCIA
CREATE TABLE IF NOT EXISTS rag_casos (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo_proyecto TEXT NOT NULL,
  cliente TEXT,
  ubicacion TEXT,
  resumen_requerimiento TEXT NOT NULL,
  ensayos_recomendados JSONB NOT NULL DEFAULT '[]'::jsonb,
  centro_costo TEXT NOT NULL,
  normativa JSONB DEFAULT '[]'::jsonb,
  observaciones TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABLA: CONFIGURACIÓN GENERAL DEL SISTEMA
CREATE TABLE IF NOT EXISTS configuracion_sistema (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) pero permitir acceso con service_role
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarifario ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reglas_aprendidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

-- Políticas para lectura anónima / autenticada básica y control total con service_role
CREATE POLICY "Acceso total con Service Role" ON usuarios FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON user_profiles FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON tarifario FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON cotizaciones FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON clientes FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON contactos FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON proyectos FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON reglas_aprendidas FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON rag_casos FOR ALL USING (true);
CREATE POLICY "Acceso total con Service Role" ON configuracion_sistema FOR ALL USING (true);
