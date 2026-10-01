-- =============================================================================
-- Libro de registro de la explotacion completo (RD 804/2011, anexo IV;
-- Andalucia: Orden de 29/04/2015, anexo IV). Solo anade columnas y tablas:
-- los movimientos existentes se conservan y su causa se deduce en la app.
-- =============================================================================

-- CreateEnum
CREATE TYPE "EquineSpecies" AS ENUM ('CABALLAR', 'ASNAL', 'MULAR', 'BURDEGANO');

-- CreateEnum
CREATE TYPE "MovementCause" AS ENUM ('APERTURA', 'NACIMIENTO', 'COMPRA', 'RETORNO', 'TRASLADO_PROVISIONAL', 'VENTA', 'SACRIFICIO', 'MUERTE');

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "species" "EquineSpecies" NOT NULL DEFAULT 'CABALLAR';

-- AlterTable
ALTER TABLE "Movement" ADD COLUMN     "cause" "MovementCause",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "disposalMethod" TEXT,
ADD COLUMN     "disposalPlace" TEXT,
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "documentType" TEXT,
ADD COLUMN     "expectedReturnDate" TIMESTAMP(3),
ADD COLUMN     "notifiedAt" TIMESTAMP(3),
ADD COLUMN     "trailerPlate" TEXT,
ADD COLUMN     "transporterId" TEXT,
ADD COLUMN     "transporterName" TEXT,
ADD COLUMN     "vehiclePlate" TEXT;

-- CreateTable
CREATE TABLE "FarmBookSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "farmName" TEXT,
    "farmAddress" TEXT,
    "farmMunicipality" TEXT,
    "farmProvince" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "holderPhone" TEXT,
    "holderEmail" TEXT,
    "legalRepName" TEXT,
    "legalRepNif" TEXT,
    "adsg" TEXT,
    "classification" TEXT,
    "capacity" INTEGER,
    "surfaceHa" DECIMAL(8,2),
    "installationsM2" DECIMAL(10,2),
    "sanitaryQualification" TEXT,
    "openedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmBookSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentificationIncident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "previousId" TEXT,
    "newId" TEXT,
    "cause" TEXT NOT NULL,
    "duplicate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentificationIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "actNumber" TEXT,
    "officialName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmCaretaker" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "documentId" TEXT,
    "role" TEXT,
    "phone" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FarmCaretaker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Movement_tenantId_date_idx" ON "Movement"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FarmBookSettings_tenantId_key" ON "FarmBookSettings"("tenantId");

-- CreateIndex
CREATE INDEX "IdentificationIncident_tenantId_date_idx" ON "IdentificationIncident"("tenantId", "date");

-- CreateIndex
CREATE INDEX "FarmInspection_tenantId_date_idx" ON "FarmInspection"("tenantId", "date");

-- CreateIndex
CREATE INDEX "FarmCaretaker_tenantId_idx" ON "FarmCaretaker"("tenantId");

-- AddForeignKey
ALTER TABLE "FarmBookSettings" ADD CONSTRAINT "FarmBookSettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificationIncident" ADD CONSTRAINT "IdentificationIncident_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmInspection" ADD CONSTRAINT "FarmInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmCaretaker" ADD CONSTRAINT "FarmCaretaker_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Misma politica que el resto de `public` (ver 20260924120000_rls_y_datos_pre).
ALTER TABLE "FarmBookSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdentificationIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FarmInspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FarmCaretaker" ENABLE ROW LEVEL SECURITY;
