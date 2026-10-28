-- E3-2 (roadmap §4): avisos multi-destinatario. Antelación configurable por
-- centro, bandeja de avisos (Notification, idempotente por userId + dedupeKey)
-- y registro de entregas por canal (NotificationDelivery).
-- Solo añade: enums, una columna con valor por defecto y dos tablas. Ningún
-- valor de enum se usa aquí. RLS activada en las tablas nuevas sin políticas:
-- la app conecta con BYPASSRLS y la Data API (anon/authenticated) no ve nada.
-- Vuelta atrás: DROP TABLE "NotificationDelivery", "Notification"; DROP TYPE
-- "NotificationChannel", "NotificationKind"; ALTER TABLE "Tenant" DROP COLUMN
-- "reminderLeadDays". Se pierden los avisos guardados (el cron reenviaría los
-- del día).

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('HEALTH_DUE', 'INCIDENT', 'INCIDENT_ESCALATION', 'ANNOUNCEMENT', 'VISIT', 'BOOKING', 'INVOICE', 'STOCK');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "reminderLeadDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS (tests/migrations.test.ts)
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
