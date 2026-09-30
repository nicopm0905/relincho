-- =============================================================================
-- Rendimiento: chequeo de patas antes de trabajar (semaforo de aptitud).
-- Un registro por caballo y dia con calor, hinchazon y dolor por extremidad
-- (MI, MD, PI, PD) y cojera (NO, DUDOSA, SI).
-- =============================================================================

-- CreateEnum
CREATE TYPE "Lameness" AS ENUM ('NO', 'DUDOSA', 'SI');

-- CreateTable
CREATE TABLE "LimbCheck" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "heatLegs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "swellingLegs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "painLegs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lameness" "Lameness" NOT NULL DEFAULT 'NO',
    "notes" TEXT,
    "checkedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LimbCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LimbCheck_tenantId_date_idx" ON "LimbCheck"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LimbCheck_horseId_date_key" ON "LimbCheck"("horseId", "date");

-- AddForeignKey
ALTER TABLE "LimbCheck" ADD CONSTRAINT "LimbCheck_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Misma politica que el resto de `public` (ver 20260924120000_rls_y_datos_pre).
ALTER TABLE "LimbCheck" ENABLE ROW LEVEL SECURITY;
