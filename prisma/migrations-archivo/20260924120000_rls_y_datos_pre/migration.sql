-- =============================================================================
-- 1. Datos PRE: numero del Libro Genealogico y criador; caballo en eventos.
-- =============================================================================

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "horseId" TEXT;

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "breederId" TEXT,
ADD COLUMN     "lgNumber" TEXT;

-- AddForeignKey
ALTER TABLE "Horse" ADD CONSTRAINT "Horse_breederId_fkey" FOREIGN KEY ("breederId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =============================================================================
-- 2. Cerrar la Data API de Supabase.
--
-- Supabase expone el esquema `public` por PostgREST a los roles `anon` y
-- `authenticated`, que tenian todos los permisos sobre todas las tablas y la
-- RLS desactivada en 37 de 39: con la clave anonima del proyecto se podia leer
-- cualquier tabla (usuarios, facturas, NIF...). La app no usa esa API (entra
-- por Prisma como `postgres`), asi que se cierra entera.
--
-- Ojo: `postgres` tiene BYPASSRLS, asi que la RLS NO aisla yeguadas entre si
-- para la app; eso lo hacen los filtros por tenantId del codigo.
-- =============================================================================

-- RLS en todas las tablas de `public`, existentes y sin politicas: para
-- cualquier rol sin BYPASSRLS, sin politica no se ve ninguna fila.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END
$$;

-- Sin permisos para los roles de la Data API, tambien en lo que se cree despues.
-- Solo si existen: en una base que no sea de Supabase no hay `anon`.
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END
$$;
