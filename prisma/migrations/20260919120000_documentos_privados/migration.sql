-- El gestor documental guarda ahora la clave del bucket en vez de una URL
-- publica: pasaportes, radiografias y analiticas se sirven con URL firmada.
-- La tabla esta vacia (0 filas), asi que quitar el NOT NULL no pierde nada.

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "fileUrl" DROP NOT NULL,
ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "uploadedById" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Document_tenantId_deletedAt_idx" ON "Document"("tenantId", "deletedAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
