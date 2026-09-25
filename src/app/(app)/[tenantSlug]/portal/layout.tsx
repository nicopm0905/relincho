import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { loginUrlForCurrentPage } from "@/lib/auth-redirect";
import {
  Horse,
  Receipt,
  Files,
  SignOut,
} from "@phosphor-icons/react/dist/ssr";

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

  const nav = [
    { href: `/${tenantSlug}/portal`, label: "Mi caballo", icon: Horse },
    {
      href: `/${tenantSlug}/portal/facturas`,
      label: "Facturas",
      icon: Receipt,
    },
    {
      href: `/${tenantSlug}/portal/documentos`,
      label: "Documentos",
      icon: Files,
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <Horse className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              {tenant.name}
            </span>
            <span className="text-xs text-muted-foreground">· Portal del propietario</span>
          </div>
          <nav aria-label="Navegación del portal" className="flex items-center gap-1 text-sm">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon weight="bold" className="h-4 w-4" />
                {label}
              </Link>
            ))}
            <Link
              href="/api/auth/signout"
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SignOut weight="bold" className="h-4 w-4" />
              Cerrar sesión
            </Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 md:px-8 md:pt-10">
        {children}
      </main>
    </div>
  );
}
