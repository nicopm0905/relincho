import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { loginUrlForCurrentPage } from "@/lib/auth-redirect";
import { getTranslations } from "next-intl/server";
import { Horse, SignOut } from "@phosphor-icons/react/dist/ssr";
import { PortalNav } from "@/components/portal/portal-nav";

interface PortalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

export default async function PortalLayout({
  children,
  params,
}: PortalLayoutProps) {
  const { tenantSlug } = await params;

  const session = await getSession();
  if (!session?.user) redirect(await loginUrlForCurrentPage());

  const { tenant, membership } = await getTenantAccess(
    tenantSlug,
    session.user.id,
  );
  if (!tenant) notFound();
  if (!membership) notFound();

  // El portal es exclusivo del propietario externo. Cualquier otro rol vuelve
  // al panel completo.
  if (membership.role !== "OWNER_EXTERNAL") {
    redirect(`/${tenantSlug}/inicio`);
  }

  const t = await getTranslations("portal.nav");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-x-6 px-4 py-1.5 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Horse className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="truncate text-sm font-semibold text-foreground">
              {tenant.name}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">· {t("portalName")}</span>
          </div>
          <div className="flex items-center gap-1">
            <PortalNav tenantSlug={tenantSlug} variant="top" />
            <Link
              href="/api/auth/signout"
              className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <SignOut weight="bold" className="h-4 w-4" aria-hidden />
              {t("signOut")}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pt-10 md:pb-16">
        {children}
      </main>

      <PortalNav tenantSlug={tenantSlug} variant="bottom" />
    </div>
  );
}
