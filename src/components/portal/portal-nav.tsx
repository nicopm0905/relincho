"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Files, Horse, Receipt, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { portalSection, type PortalSection } from "@/lib/portal-view";

const ITEMS: { key: PortalSection; path: string; icon: PhosphorIcon }[] = [
  { key: "home", path: "", icon: Horse },
  { key: "invoices", path: "/facturas", icon: Receipt },
  { key: "documents", path: "/documentos", icon: Files },
];

/**
 * Navegación del portal del cliente. En escritorio va en la cabecera (`top`);
 * en el móvil, fija abajo (`bottom`), al alcance del pulgar. Solo una de las
 * dos se ve en cada tamaño, así que comparten nombre accesible.
 */
export function PortalNav({ tenantSlug, variant }: { tenantSlug: string; variant: "top" | "bottom" }) {
  const t = useTranslations("portal.nav");
  const active = portalSection(usePathname(), tenantSlug);
  const labels: Record<PortalSection, string> = {
    home: t("home"),
    invoices: t("invoices"),
    documents: t("documents"),
  };

  if (variant === "top") {
    return (
      <nav aria-label={t("navigation")} className="hidden items-center gap-1 text-sm md:flex">
        {ITEMS.map(({ key, path, icon: Icon }) => (
          <Link
            key={key}
            href={`/${tenantSlug}/portal${path}`}
            aria-current={active === key ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-1.5 rounded-xl px-3 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon weight="bold" className="h-4 w-4" aria-hidden />
            {labels[key]}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("navigation")}
      className="safe-area-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {ITEMS.map(({ key, path, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/${tenantSlug}/portal${path}`}
              aria-current={active === key ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-col items-center justify-center gap-0.5 py-2 text-caption font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                active === key ? "text-primary-ink" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon weight={active === key ? "fill" : "regular"} className="h-6 w-6" aria-hidden />
              {labels[key]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
