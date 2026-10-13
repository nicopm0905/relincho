"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { key: "panel", href: "" },
  { key: "stats", href: "/estadisticas" },
  { key: "semen", href: "/semen" },
  { key: "settings", href: "/ajustes" },
] as const;

/** The breeding module's own sections, as tabs under the page header. */
export function ReproNav({ tenantSlug }: { tenantSlug: string }) {
  const t = useTranslations("repro.nav");
  const pathname = usePathname();
  const base = `/${tenantSlug}/reproduccion`;

  return (
    <nav aria-label={t("label")} className="no-scrollbar -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {SECTIONS.map(({ key, href }) => {
          const active = pathname === `${base}${href}`;
          return (
            <li key={key}>
              <Link
                href={`${base}${href}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-10 items-center px-3 text-label font-semibold transition-colors",
                  "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full",
                  active
                    ? "text-foreground after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground after:bg-transparent",
                )}
              >
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
