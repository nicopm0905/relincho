-- =============================================================================
-- Reproduccion: ciclo estral, exploraciones ginecologicas, perfil de la yegua
-- y parametros configurables por yeguada.
-- =============================================================================

-- AlterTable
ALTER TABLE "ReproductionCycle" ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "Covering" ADD COLUMN     "notes" TEXT;

-- Ecografias y partos pasan a llevar tenantId propio. Las filas existentes lo
-- toman de su cubricion; despues la columna es obligatoria.
ALTER TABLE "PregnancyCheck" ADD COLUMN     "heartbeat" BOOLEAN,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "vesicleMm" INTEGER;

UPDATE "PregnancyCheck" p SET "tenantId" = c."tenantId"
FROM "Covering" c WHERE c."id" = p."coveringId";

ALTER TABLE "PregnancyCheck" ALTER COLUMN "tenantId" SET NOT NULL;

ALTER TABLE "Foaling" ADD COLUMN     "tenantId" TEXT;

UPDATE "Foaling" f SET "tenantId" = c."tenantId"
FROM "Covering" c WHERE c."id" = f."coveringId";

ALTER TABLE "Foaling" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "ReproExam" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "mareId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "teasingScore" INTEGER,
    "leftFollicleMm" INTEGER,
    "rightFollicleMm" INTEGER,
    "corpusLuteum" TEXT,
    "uterineEdema" INTEGER,
    "uterineFluidMm" INTEGER,
    "cervix" TEXT,
    "ovulated" BOOLEAN NOT NULL DEFAULT false,
    "ovulationSide" TEXT,
    "treatments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReproExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MareReproProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "cycleLengthDays" INTEGER,
    "estrusLengthDays" INTEGER,
    "gestationDays" INTEGER,
    "preovulatoryFollicleMm" INTEGER,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MareReproProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReproSettings" (
    "tenantId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReproSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateIndex
CREATE INDEX "ReproExam_tenantId_mareId_date_idx" ON "ReproExam"("tenantId", "mareId", "date");

-- CreateIndex
CREATE INDEX "ReproExam_cycleId_idx" ON "ReproExam"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "MareReproProfile_horseId_key" ON "MareReproProfile"("horseId");

-- CreateIndex
CREATE INDEX "MareReproProfile_tenantId_idx" ON "MareReproProfile"("tenantId");

-- CreateIndex
CREATE INDEX "PregnancyCheck_tenantId_idx" ON "PregnancyCheck"("tenantId");

-- CreateIndex
CREATE INDEX "Foaling_tenantId_idx" ON "Foaling"("tenantId");

-- AddForeignKey
ALTER TABLE "ReproExam" ADD CONSTRAINT "ReproExam_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReproductionCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproExam" ADD CONSTRAINT "ReproExam_mareId_fkey" FOREIGN KEY ("mareId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MareReproProfile" ADD CONSTRAINT "MareReproProfile_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReproSettings" ADD CONSTRAINT "ReproSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Misma politica que el resto de `public` (ver 20260924120000_rls_y_datos_pre):
-- RLS activa y sin permisos para los roles de la Data API.
ALTER TABLE "ReproExam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MareReproProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReproSettings" ENABLE ROW LEVEL SECURITY;
