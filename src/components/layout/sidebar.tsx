"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  House,
  Horse,
  Heartbeat,
  CheckSquare,
  Baby,
  Files,
  Receipt,
  Users,
  Gear,
  List,
  X,
  Path,
  Storefront,
  Gauge,
  SignOut,
  CaretDown,
  CalendarDots,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { useState, useEffect } from "react";

type NavKey =
  | "home"
  | "horses"
  | "performance"
  | "health"
  | "reproduction"
  | "movements"
  | "tasks"
  | "calendar"
  | "boarding"
  | "invoicing"
  | "contacts"
  | "documents"
  | "settings";

type NavItem = { key: NavKey; href: string; icon: PhosphorIcon };

/** Grouped so the rail reads as a hierarchy instead of a wall of ten links. */
const navGroups: { groupKey?: "stable" | "business"; items: NavItem[] }[] = [
  {
    items: [{ key: "home", href: "inicio", icon: House }],
  },
  {
    groupKey: "stable",
    items: [
      { key: "horses", href: "caballos", icon: Horse },
      { key: "performance", href: "rendimiento", icon: Gauge },
      { key: "health", href: "sanidad", icon: Heartbeat },
      { key: "reproduction", href: "reproduccion", icon: Baby },
      { key: "movements", href: "movimientos", icon: Path },
      { key: "tasks", href: "tareas", icon: CheckSquare },
      { key: "calendar", href: "calendario", icon: CalendarDots },
    ],
  },
  {
    groupKey: "business",
    items: [
      { key: "boarding", href: "pupilaje", icon: Storefront },
      { key: "invoicing", href: "facturacion", icon: Receipt },
      { key: "contacts", href: "contactos", icon: Users },
      { key: "documents", href: "documentos", icon: Files },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);
const desktopPrimaryItems: NavItem[] = [
  allNavItems.find((item) => item.href === "inicio")!,
  allNavItems.find((item) => item.href === "caballos")!,
  allNavItems.find((item) => item.href === "sanidad")!,
  allNavItems.find((item) => item.href === "reproduccion")!,
  allNavItems.find((item) => item.href === "tareas")!,
  allNavItems.find((item) => item.href === "calendario")!,
];
const desktopSecondaryItems: NavItem[] = [
  allNavItems.find((item) => item.href === "rendimiento")!,
  allNavItems.find((item) => item.href === "movimientos")!,
  allNavItems.find((item) => item.href === "pupilaje")!,
  allNavItems.find((item) => item.href === "facturacion")!,
  allNavItems.find((item) => item.href === "contactos")!,
  allNavItems.find((item) => item.href === "documentos")!,
];
const settingsItem: NavItem = {
  key: "settings",
  href: "ajustes",
  icon: Gear,
};

/** Chosen by daily use in a yeguada, not by order in the rail. */
// En móvil el logo ya lleva a Inicio: reservamos las cuatro pestañas para el
// trabajo de cuadra y dejamos el resto, incluido Inicio, en "Más".
const mobileTabHrefs = ["caballos", "sanidad", "reproduccion", "tareas"];
const mobileTabItems = mobileTabHrefs
  .map((href) => allNavItems.find((item) => item.href === href))
  .filter((item): item is NavItem => Boolean(item));
const mobileOverflowItems = allNavItems
  .filter((item) => !mobileTabItems.includes(item))
  .concat(settingsItem);

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
  userName?: string | null;
  userEmail?: string | null;
}

function initialsOf(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

export function Sidebar({
  tenantSlug,
  tenantName,
  userName,
  userEmail,
}: SidebarProps) {
  const t = useTranslations("sidebar");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(() =>
    desktopSecondaryItems.some((item) =>
      pathname.startsWith(`/${tenantSlug}/${item.href}`),
    ),
  );

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isActive = (href: string) =>
    pathname.startsWith(`/${tenantSlug}/${href}`);

  const displayName = userName || userEmail || t("account");

  const navLink = (
    { key, href, icon: Icon }: NavItem,
    { large = false }: { large?: boolean } = {},
  ) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={`/${tenantSlug}/${href}`}
        aria-current={active ? "page" : undefined}
        onClick={() => {
          setMoreOpen(false);
          setDesktopMoreOpen(false);
        }}
        className={cn(
          "group flex items-center gap-3 rounded-lg transition-colors duration-150",
          large ? "px-3 py-3 text-[15px]" : "px-3 py-2 text-[13.5px]",
          active
            ? "bg-card font-semibold text-foreground shadow-xs"
            : "font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        )}
      >
        <Icon
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            active
              ? "text-primary-ink"
              : "text-muted-foreground/80 group-hover:text-foreground",
          )}
        />
        <span className="truncate">
          {key === "home" ? t("home") : t(`sections.${key}`)}
        </span>
      </Link>
    );
  };

  return (
    <>
      {/* ── Desktop rail ─────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-[244px] shrink-0 flex-col border-r border-border bg-sidebar md:flex">
        <Link
          href={`/${tenantSlug}/inicio`}
          className="flex items-center gap-2.5 px-4 py-4 transition-colors hover:bg-foreground/[0.03]"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
            <Image
              src="/logo.png"
              alt=""
              fill
              sizes="36px"
              className="object-contain p-1"
              priority
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] leading-tight font-semibold text-foreground">
              {tenantName}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {t("brand")}
            </span>
          </span>
        </Link>

        <nav aria-label={t("navigation")} className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-6">
          <div className="space-y-0.5">
            {desktopPrimaryItems.map((item) => navLink(item))}
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setDesktopMoreOpen((open) => !open)}
              aria-expanded={desktopMoreOpen}
              className="group flex w-full items-center justify-between rounded-lg px-3 py-2 text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              <span>{t("moreSections")}</span>
              <CaretDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  desktopMoreOpen && "rotate-180",
                )}
              />
            </button>
            {desktopMoreOpen && (
              <div className="space-y-0.5">
                {desktopSecondaryItems.map((item) => navLink(item))}
              </div>
            )}
          </div>
        </nav>

        <div className="space-y-0.5 border-t border-border px-3 py-3">
          {navLink(settingsItem)}
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
              {initialsOf(displayName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-muted-foreground">
              {displayName}
            </span>
            <Link
              href="/api/auth/signout"
              aria-label={t("logout")}
              title={t("logout")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <SignOut className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="px-3 pt-1">
            <LocaleSwitcher />
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar: says which yeguada you are in ─────── */}
      <header className="safe-area-top fixed top-0 right-0 left-0 z-30 flex h-14 items-center justify-between border-b border-border bg-sidebar/95 px-4 backdrop-blur-lg md:hidden">
        <Link
          href={`/${tenantSlug}/inicio`}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
            <Image src="/logo.png" alt="" fill sizes="32px" className="object-contain p-1" />
          </span>
          <span className="truncate text-[15px] font-semibold text-foreground">
            {tenantName}
          </span>
        </Link>
        <Link
          href={`/${tenantSlug}/ajustes`}
          aria-label={t("sections.settings")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <Gear className="h-[18px] w-[18px]" />
        </Link>
      </header>

      {/* ── Mobile bottom tabs ───────────────────────────────── */}
      <nav aria-label={t("navigation")} className="safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-lg md:hidden">
        <div className="flex h-16 items-stretch">
          {mobileTabItems.map(({ key, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={`/${tenantSlug}/${href}`}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1"
              >
                <Icon
                  className={cn(
                    "h-[20px] w-[20px] shrink-0 transition-colors",
                    active ? "text-primary-ink" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "max-w-full truncate text-[10.5px]",
                    active
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {key === "home" ? t("home") : t(`sections.${key}`)}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-controls="mobile-navigation"
            aria-label={t("moreSheet")}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1"
          >
            <List
              className={cn(
                "h-[20px] w-[20px] shrink-0",
                moreOpen ? "text-primary-ink" : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "text-[10.5px]",
                moreOpen
                  ? "font-semibold text-foreground"
                  : "font-medium text-muted-foreground",
              )}
            >
              {t("more")}
            </span>
          </button>
        </div>
      </nav>

      {/* ── Mobile overflow sheet ────────────────────────────── */}
      {moreOpen && (
        <>
          <div
            className="animate-in fade-in-0 fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] duration-200 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="mobile-navigation"
            role="dialog"
            aria-label={t("moreSheet")}
            className="safe-area-bottom animate-in slide-in-from-bottom fixed right-0 bottom-0 left-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background duration-200 md:hidden"
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground">
                {t("moreSheet")}
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={t("close")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <div className="space-y-0.5 px-3 pb-5">
              {mobileOverflowItems.map((item) => navLink(item, { large: true }))}
              <Link
                href="/api/auth/signout"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                <SignOut
                  className="h-[18px] w-[18px] shrink-0"
                />
                {t("logout")}
              </Link>
              <div className="px-3 pt-3">
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
