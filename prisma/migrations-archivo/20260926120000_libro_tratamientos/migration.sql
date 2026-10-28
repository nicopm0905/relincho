-- Libro de registro de tratamientos veterinarios (RD 666/2023, art. 41).
-- Solo añade columnas opcionales: los registros que ya existen siguen igual y
-- el libro marca como incompletos los que no tengan los datos obligatorios.

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "excludedFromFoodChain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HealthEvent" ADD COLUMN     "prescriptionNumber" TEXT,
ADD COLUMN     "withdrawalDays" INTEGER,
ADD COLUMN     "durationDays" INTEGER,
ADD COLUMN     "supplier" TEXT,
ADD COLUMN     "purchaseReference" TEXT,
ADD COLUMN     "batchNumber" TEXT;

-- CreateIndex
CREATE INDEX "HealthEvent_tenantId_date_idx" ON "HealthEvent"("tenantId", "date");
