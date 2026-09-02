import { HorseForm } from "@/components/horses/horse-form";
import { prisma } from "@/server/db/prisma";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export const metadata = { title: "Nuevo caballo — Relincho" };

export default async function NuevoCaballoPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) redirect("/dashboard");

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/${tenantSlug}/caballos`}>
          <CaretLeft weight="bold" className="mr-2 h-4 w-4" />
          Volver a caballos
        </Link>
      </Button>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Añadir caballo</h1>
      <HorseForm tenantSlug={tenantSlug} tenantId={tenant.id} />
    </div>
  );
}

