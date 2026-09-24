-- =============================================================================
-- Rectificativas, numeracion al emitir, periodo de pupilaje y Veri*Factu.
-- =============================================================================
-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "invoiceType" TEXT NOT NULL DEFAULT 'F1',
ADD COLUMN     "periodMonth" TEXT,
ADD COLUMN     "rectificationKind" TEXT,
ADD COLUMN     "rectificationReason" TEXT,
ADD COLUMN     "rectifiesId" TEXT,
ALTER COLUMN "number" DROP NOT NULL;

-- AlterTable
ALTER TABLE "InvoiceSeries" ADD COLUMN     "isRectifying" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "VerifactuRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prevHash" TEXT,
    "generatedAt" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerifactuRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerifactuRecord_tenantId_createdAt_idx" ON "VerifactuRecord"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_boardingContractId_periodMonth_key" ON "Invoice"("boardingContractId", "periodMonth");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rectifiesId_fkey" FOREIGN KEY ("rectifiesId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifactuRecord" ADD CONSTRAINT "VerifactuRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerifactuRecord" ADD CONSTRAINT "VerifactuRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- La tabla nueva nace con RLS, como el resto (ver 20260924120000).
ALTER TABLE "VerifactuRecord" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Inalterabilidad (art. 8 RD 1007/2023). Los triggers se aplican tambien al rol
-- de la app: aunque un fallo de codigo lo intentase, una factura emitida no
-- cambia sus datos fiscales y un registro Veri*Factu no cambia su huella.
-- Borrar si se permite: lo necesita la baja de una cuenta (cascada del tenant).
-- =============================================================================

CREATE OR REPLACE FUNCTION relincho_invoice_inalterable() RETURNS trigger AS $$
BEGIN
  IF OLD.status <> 'DRAFT' AND (
       NEW.number IS DISTINCT FROM OLD.number
    OR NEW.series IS DISTINCT FROM OLD.series
    OR NEW."issueDate" IS DISTINCT FROM OLD."issueDate"
    OR NEW."clientId" IS DISTINCT FROM OLD."clientId"
    OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
    OR NEW."vatTotal" IS DISTINCT FROM OLD."vatTotal"
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW."invoiceType" IS DISTINCT FROM OLD."invoiceType"
    OR NEW."rectifiesId" IS DISTINCT FROM OLD."rectifiesId"
    OR NEW."verifactuHash" IS DISTINCT FROM OLD."verifactuHash"
  ) THEN
    RAISE EXCEPTION 'Factura emitida: sus datos fiscales no se pueden modificar (emite una rectificativa)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_inalterable
  BEFORE UPDATE ON "Invoice"
  FOR EACH ROW EXECUTE FUNCTION relincho_invoice_inalterable();

CREATE OR REPLACE FUNCTION relincho_invoice_line_inalterable() RETURNS trigger AS $$
DECLARE
  inv_status text;
BEGIN
  SELECT status INTO inv_status FROM "Invoice"
    WHERE id = COALESCE(NEW."invoiceId", OLD."invoiceId");
  -- Sin factura (se esta borrando en cascada): no hay nada que proteger.
  IF inv_status IS NOT NULL AND inv_status <> 'DRAFT' AND TG_OP <> 'DELETE' THEN
    RAISE EXCEPTION 'Factura emitida: sus lineas no se pueden modificar'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoice_line_inalterable
  BEFORE INSERT OR UPDATE ON "InvoiceLine"
  FOR EACH ROW EXECUTE FUNCTION relincho_invoice_line_inalterable();

CREATE OR REPLACE FUNCTION relincho_verifactu_inalterable() RETURNS trigger AS $$
BEGIN
  IF NEW.hash IS DISTINCT FROM OLD.hash
    OR NEW."prevHash" IS DISTINCT FROM OLD."prevHash"
    OR NEW."generatedAt" IS DISTINCT FROM OLD."generatedAt"
    OR NEW.payload IS DISTINCT FROM OLD.payload
    OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW."invoiceId" IS DISTINCT FROM OLD."invoiceId"
  THEN
    RAISE EXCEPTION 'Registro Veri*Factu: solo cambia su estado de envio'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verifactu_inalterable
  BEFORE UPDATE ON "VerifactuRecord"
  FOR EACH ROW EXECUTE FUNCTION relincho_verifactu_inalterable();
