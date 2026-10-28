-- E1a 1/2 (roadmap §4): roles nuevos, especialidad del profesional y relación
-- con el caballo. Solo añade: nada usa todavía los valores nuevos, así que el
-- código actual sigue funcionando igual. La migración de datos
-- (VET_EXTERNAL → PROFESSIONAL + VET y HorseAccess.relation) va aparte, porque
-- Postgres no deja usar un valor de enum en la transacción que lo añade.
-- Vuelta atrás: columnas y tipos nuevos se pueden borrar; los valores de Role
-- se quedan (quitarlos obliga a recrear el tipo), pero sin uso no molestan.

-- CreateEnum
CREATE TYPE "ProfessionalSpecialty" AS ENUM ('VET', 'VET_SPECIALIST', 'FARRIER', 'PHYSIO', 'DENTIST', 'NUTRITIONIST', 'TRAINER', 'OTHER');

-- CreateEnum
CREATE TYPE "HorseRelation" AS ENUM ('OWNER', 'CO_OWNER', 'HALF_LEASE', 'RIDER', 'PROFESSIONAL');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'INSTRUCTOR';
ALTER TYPE "Role" ADD VALUE 'PROFESSIONAL';
ALTER TYPE "Role" ADD VALUE 'RIDER';

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "specialty" "ProfessionalSpecialty",
ADD COLUMN     "specialtyNote" TEXT;

-- AlterTable
ALTER TABLE "HorseAccess" ADD COLUMN     "relation" "HorseRelation";
