-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "BoardingContractExtra" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "boardingContractId" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "oneOffApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardingContractExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSeries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "InvoiceSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardingContractExtra_tenantId_boardingContractId_idx" ON "BoardingContractExtra"("tenantId", "boardingContractId");

-- CreateIndex
CREATE INDEX "InvoiceSeries_tenantId_idx" ON "InvoiceSeries"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSeries_tenantId_code_key" ON "InvoiceSeries"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "BoardingContractExtra" ADD CONSTRAINT "BoardingContractExtra_boardingContractId_fkey" FOREIGN KEY ("boardingContractId") REFERENCES "BoardingContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceSeries" ADD CONSTRAINT "InvoiceSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "InvoiceSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- RLS: este proyecto activa Row Level Security manualmente en la consola de
-- Supabase (ver README). Ejecuta lo siguiente en el SQL Editor tras aplicar
-- esta migracion para mantener el aislamiento multi-tenant en las tablas nuevas:
--
--   ALTER TABLE "InvoiceSeries" ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation_invoiceseries ON "InvoiceSeries"
--     USING ("tenantId"::text = current_setting('app.current_tenant', true));
--
--   ALTER TABLE "BoardingContractExtra" ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY tenant_isolation_boardingcontractextra ON "BoardingContractExtra"
--     USING ("tenantId"::text = current_setting('app.current_tenant', true));
-- ---------------------------------------------------------------------------
