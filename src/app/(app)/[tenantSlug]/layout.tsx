import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { redirect, notFound } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TRPCProvider } from "@/lib/trpc/react";

interface TenantLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export default async function TenantLayout({
  children,
  params,
}: TenantLayoutProps) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: {
      userId_tenantId: { userId: session.user.id, tenantId: tenant.id },
    },
  });
  if (!membership) notFound();

  return (
    <TRPCProvider tenantSlug={tenantSlug}>
      <div className="flex min-h-screen bg-background">
        <Sidebar tenantSlug={tenantSlug} tenantName={tenant.name} />
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:px-8 md:py-10 md:pb-10">{children}</div>
        </main>
        <Toaster richColors position="top-right" />
      </div>
    </TRPCProvider>
  );
}
