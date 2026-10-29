-- E7 2/2 (roadmap §4): visita del profesional. Autoría del acto sanitario
-- (§9.9), idempotencia de las escrituras desde el móvil (D3) e intervalo de
-- herraje propio de cada caballo. Solo añade columnas nulas, un índice único
-- (los NULL no chocan) y una FK con SET NULL: nada existente cambia.
-- Vuelta atrás: DROP de las tres columnas (se pierde la autoría registrada).

-- AlterTable
ALTER TABLE "Horse" ADD COLUMN     "farrierIntervalWeeks" INTEGER;

-- AlterTable
ALTER TABLE "HealthEvent" ADD COLUMN     "authorMembershipId" TEXT,
ADD COLUMN     "clientMutationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "HealthEvent_clientMutationId_key" ON "HealthEvent"("clientMutationId");

-- AddForeignKey
ALTER TABLE "HealthEvent" ADD CONSTRAINT "HealthEvent_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

