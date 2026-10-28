-- Planes y precios nuevos (Cuaderno / Cuadra / Rendimiento / Yeguada).
-- El plan por defecto de las altas nuevas pasa a "cuaderno" (5 caballos).
-- Las yeguadas existentes NO se tocan: quien tiene "starter" conserva su
-- limite de 15 caballos de la beta. Se anotan tambien los modulos contratados
-- aparte y el programa de fundadores.

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "plan" SET DEFAULT 'cuaderno',
ADD COLUMN     "extraHorseBlocks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billingModule" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "founder" BOOLEAN NOT NULL DEFAULT false;
