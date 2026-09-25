-- =============================================================================
-- Reproduccion F3/F4: vigilancia preparto, datos del parto y del potro, lotes
-- de semen y tareas generadas por el sistema (hitos de gestacion).
-- =============================================================================

-- AlterTable
ALTER TABLE "Covering" ADD COLUMN     "dosesUsed" INTEGER,
ADD COLUMN     "externalStallionName" TEXT,
ADD COLUMN     "semenBatchId" TEXT;

-- AlterTable
ALTER TABLE "Foaling" ADD COLUMN     "birthWeightKg" DECIMAL(5,1),
ADD COLUMN     "complications" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "foalIggMgDl" INTEGER,
ADD COLUMN     "foalStoodMinutes" INTEGER,
ADD COLUMN     "foalSuckledMinutes" INTEGER,
ADD COLUMN     "meconiumPassed" BOOLEAN,
ADD COLUMN     "placentaMinutes" INTEGER;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "sourceKey" TEXT;

-- CreateTable
CREATE TABLE "FoalingWatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "coveringId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "udderScore" INTEGER,
    "wax" BOOLEAN NOT NULL DEFAULT false,
    "milkCalciumPpm" INTEGER,
    "relaxation" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoalingWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemenBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stallionId" TEXT,
    "externalStallionName" TEXT,
    "semenType" TEXT NOT NULL,
    "provider" TEXT,
    "dosesTotal" INTEGER NOT NULL,
    "collectedAt" TIMESTAMP(3),
    "location" TEXT,
    "costPerDose" DECIMAL(10,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SemenBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoalingWatch_tenantId_coveringId_idx" ON "FoalingWatch"("tenantId", "coveringId");

-- CreateIndex
CREATE INDEX "SemenBatch_tenantId_idx" ON "SemenBatch"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_tenantId_sourceKey_key" ON "Task"("tenantId", "sourceKey");

-- AddForeignKey
ALTER TABLE "Covering" ADD CONSTRAINT "Covering_semenBatchId_fkey" FOREIGN KEY ("semenBatchId") REFERENCES "SemenBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoalingWatch" ADD CONSTRAINT "FoalingWatch_coveringId_fkey" FOREIGN KEY ("coveringId") REFERENCES "Covering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenBatch" ADD CONSTRAINT "SemenBatch_stallionId_fkey" FOREIGN KEY ("stallionId") REFERENCES "Horse"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Misma politica que el resto de `public` (ver 20260924120000_rls_y_datos_pre).
ALTER TABLE "FoalingWatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SemenBatch" ENABLE ROW LEVEL SECURITY;
