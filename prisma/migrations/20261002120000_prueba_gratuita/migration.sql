-- =============================================================================
-- Prueba gratuita en lugar de plan gratis para siempre (ver src/lib/trial.ts).
-- Las yeguadas existentes quedan con NULL: conservan su plan de la beta.
-- Las nuevas reciben la fecha de fin de prueba al darse de alta.
-- =============================================================================

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
