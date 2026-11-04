-- E6-2 (roadmap §4): feed de actividad del caballo. HorseActivity guarda lo
-- que se hace con el caballo en el día (paddock, montado, cuerda…) con su
-- autor. Entrenamientos, actos sanitarios e incidencias no se copian: se
-- fusionan al leer (src/lib/horse-feed.ts).
-- Solo añade: un enum y una tabla. Ningún valor de enum añadido con ALTER
-- TYPE. RLS activada en la tabla nueva sin políticas: la app conecta con
-- BYPASSRLS y la Data API (anon/authenticated) no ve nada.
-- Vuelta atrás: DROP TABLE "HorseActivity"; DROP TYPE "ActivityKind". Se
-- pierden las actividades registradas.

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('PADDOCK', 'RIDDEN', 'LUNGED', 'WALKER', 'GROOMED', 'FARRIER', 'VET', 'PHYSIO', 'NOTE');

-- CreateTable
CREATE TABLE "HorseActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "horseId" TEXT NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER,
    "note" TEXT,
    "photoKey" TEXT,
    "authorMembershipId" TEXT,
    "visibleToOwner" BOOLEAN NOT NULL DEFAULT true,
    "clientMutationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HorseActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HorseActivity_clientMutationId_key" ON "HorseActivity"("clientMutationId");

-- CreateIndex
CREATE INDEX "HorseActivity_tenantId_horseId_at_idx" ON "HorseActivity"("tenantId", "horseId", "at");

-- AddForeignKey
ALTER TABLE "HorseActivity" ADD CONSTRAINT "HorseActivity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseActivity" ADD CONSTRAINT "HorseActivity_horseId_fkey" FOREIGN KEY ("horseId") REFERENCES "Horse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorseActivity" ADD CONSTRAINT "HorseActivity_authorMembershipId_fkey" FOREIGN KEY ("authorMembershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (tests/migrations.test.ts)
ALTER TABLE "HorseActivity" ENABLE ROW LEVEL SECURITY;
