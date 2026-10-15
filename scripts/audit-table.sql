-- =========================================================================
-- TABLA: REGISTRO DE AUDITORÍA (bitácora de accesos y cambios)
-- Idempotente. Ejecutar en Supabase → SQL Editor, o con scripts/setup-audit-table.js
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.registro_auditoria (
  id          TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     TEXT,
  user_name   TEXT,
  user_email  TEXT,
  user_role   TEXT,
  action      TEXT NOT NULL,
  module      TEXT NOT NULL,
  description TEXT NOT NULL,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT
);

CREATE INDEX IF NOT EXISTS idx_auditoria_created_at ON public.registro_auditoria (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_action     ON public.registro_auditoria (action);
CREATE INDEX IF NOT EXISTS idx_auditoria_module     ON public.registro_auditoria (module);
CREATE INDEX IF NOT EXISTS idx_auditoria_user_email ON public.registro_auditoria (user_email);

-- Seguridad: RLS activo SIN políticas => solo service_role (servidor) puede leer/escribir.
ALTER TABLE public.registro_auditoria ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registro_auditoria FROM anon, authenticated;

-- Bitácora inmutable (append-only): impide modificar o borrar registros, incluso desde la app.
CREATE OR REPLACE FUNCTION public.registro_auditoria_inmutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'registro_auditoria es de solo inserción (operación % bloqueada)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_registro_auditoria_inmutable ON public.registro_auditoria;
CREATE TRIGGER trg_registro_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON public.registro_auditoria
  FOR EACH ROW EXECUTE FUNCTION public.registro_auditoria_inmutable();

-- Refrescar caché de esquema de PostgREST
NOTIFY pgrst, 'reload schema';

