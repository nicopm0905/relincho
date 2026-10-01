-- =============================================================================
-- Peso (bascula, cinta o medidas) y condicion corporal Henneke 1-9: un
-- registro por caballo y dia. Al final, la prevision del tiempo guardada.
-- Solo anade: no toca datos existentes.
-- =============================================================================

-- CreateEnum
CREATE TYPE "WeightMethod" AS ENUM ('BASCULA', 'CINTA', 'MEDIDAS');

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "method" "WeightMethod",
    "weightKg" DECIMAL(6,1),
    "girthCm" DECIMAL(5,1),
    "lengthCm" DECIMAL(5,1),
    "bodyCondition" DECIMAL(3,1),
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyMeasurement_tenantId_date_idx" ON "BodyMeasurement"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "BodyMeasurement_horseId_date_key" ON "BodyMeasurement"("horseId", "date");

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Misma politica que el resto de `public` (ver 20260924120000_rls_y_datos_pre).
ALTER TABLE "BodyMeasurement" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Prevision del tiempo (MET Norway) guardada por punto (~1 km). No es dato de
-- ninguna yeguada: la comparten las fincas cercanas y no lleva tenantId.
-- =============================================================================

-- CreateTable
CREATE TABLE "WeatherForecast" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "timeZone" TEXT NOT NULL,
    "points" JSONB NOT NULL,
    "lastModified" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeatherForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeatherForecast_locationKey_key" ON "WeatherForecast"("locationKey");

-- Misma politica que el resto de `public` (ver 20260924120000_rls_y_datos_pre).
ALTER TABLE "WeatherForecast" ENABLE ROW LEVEL SECURITY;
