-- Estado de la suscripcion en Stripe, para poder avisar de un pago pendiente
-- sin llamar a la API, y el origen de la yeguada, para saber que canal
-- (flyer, feria, boca a boca) trae clientes.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "stripeStatus" TEXT,
ADD COLUMN     "stripeCurrentPeriodEnd" TIMESTAMP(3),
ADD COLUMN     "acquisitionSource" TEXT,
ADD COLUMN     "acquisitionReferrer" TEXT;
