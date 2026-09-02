import { HorseForm } from "@/components/horses/horse-form";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

export const metadata = { title: "Editar caballo — Relincho" };

export default async function EditarCaballoPage({ params }: PageProps) {
  const { tenantSlug, id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) redirect("/dashboard");

  const horse = await prisma.horse.findUnique({
    where: { id, tenantId: tenant.id },
  });

  if (!horse) {
    redirect(`/${tenantSlug}/caballos`);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${tenantSlug}/caballos/${id}`}>
          <CaretLeft weight="bold" className="mr-2 h-4 w-4" />
          Volver a la ficha
        </Link>
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Editar ficha: {horse.name}</h1>
      <HorseForm 
        tenantSlug={tenantSlug} 
        tenantId={tenant.id} 
        defaultValues={{
          id: horse.id,
          name: horse.name,
          sex: horse.sex as any,
          status: horse.status as any,
          breed: horse.breed || "",
          coat: horse.coat || "",
          birthDate: horse.birthDate ? horse.birthDate.toISOString().split("T")[0] : "",
          uelnCode: horse.uelnCode || "",
          microchip: horse.microchip || "",
          hierro: horse.hierro || "",
          boxLocation: horse.boxLocation || "",
          photoUrl: horse.photoUrl || undefined,
        }} 
      />
    </div>
  );
}
