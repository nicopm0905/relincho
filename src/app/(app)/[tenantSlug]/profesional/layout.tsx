import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { loginUrlForCurrentPage } from "@/lib/auth-redirect";
import { Horse, SignOut } from "@phosphor-icons/react/dist/ssr";

interface ProfessionalLayoutProps {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}

/** Área del profesional externo (E1a): solo sus caballos, sin el panel. */
export default async function ProfessionalLayout({
  children,
  params,
}: ProfessionalLayoutProps) {
  const { tenantSlug } = await params;

  const session = await getSession();
  if (!session?.user) redirect(await loginUrlForCurrentPage());

  const { tenant, membership } = await getTenantAccess(tenantSlug, session.user.id);
  if (!tenant || !membership) notFound();

  // Exclusiva de PROFESSIONAL. VET_EXTERNAL sigue en el panel hasta la
  // migración de datos de E1a.
  if (membership.role !== "PROFESSIONAL") {
    redirect(`/${tenantSlug}/inicio`);
  }

  const t = await getTranslations("professional");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Horse className="h-5 w-5 shrink-0 text-primary" />
            <span className="truncate text-sm font-semibold text-foreground">{tenant.name}</span>
            <span className="text-xs text-muted-foreground">· {t("area")}</span>
          </div>
          <nav aria-label={t("navigation")} className="flex items-center gap-1 text-sm">
            <Link
              href={`/${tenantSlug}/profesional`}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Horse weight="bold" className="h-4 w-4" />
              {t("myHorses")}
            </Link>
            <Link
              href="/api/auth/signout"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SignOut weight="bold" className="h-4 w-4" />
              {t("signOut")}
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 md:px-8 md:pt-10"
      >
        {children}
      </main>
    </div>
  );
}
