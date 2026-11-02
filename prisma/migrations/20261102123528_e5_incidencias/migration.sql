-- E5-2 (roadmap §4): incidencias con confirmación de lectura. El personal
-- abre una incidencia de un caballo, cada propietario con cuenta la lee y la
-- confirma (IncidentReceipt) y el centro la resuelve. Las correcciones van en
-- IncidentUpdate: la descripción original no se edita (autoría, §9.9).
-- Solo añade: tres enums y tres tablas. Ningún valor de enum añadido con
-- ALTER TYPE. RLS activada en las tablas nuevas sin políticas: la app conecta
-- con BYPASSRLS y la Data API (anon/authenticated) no ve nada.
-- Vuelta atrás: DROP TABLE "IncidentUpdate", "IncidentReceipt", "Incident";
-- DROP TYPE "IncidentStatus", "IncidentSeverity", "IncidentCategory". Se
-- pierden las incidencias registradas.

-- CreateEnum
CREATE TYPE "IncidentCategory" AS ENUM ('INJURY', 'LAMENESS', 'NOT_EATING', 'COLIC_SIGNS', 'EQUIPMENT', 'BEHAVIOR', 'OTHER');

-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "category" "IncidentCategory" NOT NULL,
    "severity" "IncidentSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "photoKeys" TEXT[],
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "escalatedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "followsId" TEXT,
    "clientMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentReceipt" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "IncidentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentUpdate" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "authorMembershipId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Incident_clientMutationId_key" ON "Incident"("clientMutationId");

-- CreateIndex
CREATE INDEX "Incident_tenantId_status_occurredAt_idx" ON "Incident"("tenantId", "status", "occurredAt");

-- CreateIndex
CREATE INDEX "Incident_tenantId_horseId_idx" ON "Incident"("tenantId", "horseId");

-- CreateIndex
CREATE INDEX "IncidentReceipt_membershipId_idx" ON "IncidentReceipt"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "IncidentReceipt_incidentId_membershipId_key" ON "IncidentReceipt"("incidentId", "membershipId");

-- CreateIndex
CREATE INDEX "IncidentUpdate_incidentId_createdAt_idx" ON "IncidentUpdate"("incidentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_followsId_fkey" FOREIGN KEY ("followsId") REFERENCES "Incident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReceipt" ADD CONSTRAINT "IncidentReceipt_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentReceipt" ADD CONSTRAINT "IncidentReceipt_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentUpdate" ADD CONSTRAINT "IncidentUpdate_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (tests/migrations.test.ts)
ALTER TABLE "Incident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncidentUpdate" ENABLE ROW LEVEL SECURITY;
