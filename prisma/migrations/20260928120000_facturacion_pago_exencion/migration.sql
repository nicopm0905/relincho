-- Datos de cobro de la yeguada, causa de exencion por linea y registro de envio.
-- Solo columnas nuevas y opcionales: no toca datos ni los triggers de inalterabilidad
-- (ninguna de ellas es un dato fiscal protegido por invoice_inalterable).

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "iban" TEXT,
ADD COLUMN "paymentTerms" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "emailedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "exemptionCause" TEXT;
