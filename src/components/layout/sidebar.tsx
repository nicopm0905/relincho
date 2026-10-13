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
  CalendarDots,
  ChartBar,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { useState, useEffect, useRef } from "react";

type NavKey =
  | "home"
  | "horses"
  | "performance"
  | "health"
  | "reproduction"
  | "breedingStats"
  | "movements"
  | "tasks"
  | "calendar"
  | "boarding"
  | "invoicing"
  | "contacts"
  | "documents"
  | "settings";

type NavItem = { key: NavKey; href: string; icon: PhosphorIcon };
type GroupKey = "daily" | "breeding" | "management";

const item = (key: NavKey, href: string, icon: PhosphorIcon): NavItem => ({
  key,
  href,
  icon,
});

const home = item("home", "inicio", House);
const horses = item("horses", "caballos", Horse);
const tasks = item("tasks", "tareas", CheckSquare);
const health = item("health", "sanidad", Heartbeat);
const calendar = item("calendar", "calendario", CalendarDots);
const performance = item("performance", "rendimiento", Gauge);
const reproduction = item("reproduction", "reproduccion", Baby);
const breedingStats = item("breedingStats", "reproduccion/estadisticas", ChartBar);
const invoicing = item("invoicing", "facturacion", Receipt);
const boarding = item("boarding", "pupilaje", Storefront);
const movements = item("movements", "movimientos", Path);
const contacts = item("contacts", "contactos", Users);
const documents = item("documents", "documentos", Files);
const settings = item("settings", "ajustes", Gear);

/**
 * Grouped by what the user is doing, not by data model: the day's work, the
 * breeding season and the paperwork. Everything stays visible; hiding
 * invoicing behind "more" hid one of the product's strongest arguments.
 */
const desktopGroups: { groupKey?: GroupKey; items: NavItem[] }[] = [
  { items: [home, horses] },
  { groupKey: "daily", items: [tasks, health, calendar, performance] },
  { groupKey: "breeding", items: [reproduction, breedingStats] },
  {
    groupKey: "management",
    items: [invoicing, boarding, movements, contacts, documents],
  },
];

/** Four tabs a phone can hold: where you start and the three daily jobs. */
const mobileTabs: NavItem[] = [home, horses, reproduction, tasks];

/** The rest, in the same groups as the desktop rail. */
const mobileSheetGroups: { groupKey: GroupKey; items: NavItem[] }[] = [
  { groupKey: "daily", items: [health, calendar, performance] },
  { groupKey: "breeding", items: [breedingStats] },
  {
    groupKey: "management",
    items: [invoicing, boarding, movements, contacts, documents],
  },
];

const allItems = [...desktopGroups.flatMap((group) => group.items), settings];

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
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    if (moreOpen) closeRef.current?.focus();
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

  // The longest matching href wins, so /reproduccion/estadisticas lights up
  // "Estadísticas" and not "Reproducción" as well.
  const activeHref = allItems
    .map((navItem) => navItem.href)
    .filter((href) => {
      const base = `/${tenantSlug}/${href}`;
      return pathname === base || pathname.startsWith(`${base}/`);
    })
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;
  // En el móvil la pestaña "Cría" cubre todo el módulo, también Estadísticas.
  const inBreeding = activeHref?.startsWith(reproduction.href) ?? false;
  const isTabActive = (href: string) =>
    isActive(href) || (href === reproduction.href && inBreeding);
  const sheetActive = !inBreeding && mobileSheetGroups.some((group) =>
    group.items.some((navItem) => isActive(navItem.href)),
  ) || isActive(settings.href);

  const displayName = userName || userEmail || t("account");
  const label = (key: NavKey) => (key === "home" ? t("home") : t(`sections.${key}`));

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
        onClick={() => setMoreOpen(false)}
        className={cn(
          "group flex items-center gap-3 rounded-lg transition-colors duration-150",
          large ? "min-h-12 px-3 text-body" : "min-h-9 px-3 text-label",
          active
            ? "bg-card font-semibold text-foreground shadow-card"
            : "font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        )}
      >
        <Icon
          aria-hidden
          weight={active ? "fill" : "regular"}
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            active
              ? "text-primary-ink"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span className="truncate">{label(key)}</span>
      </Link>
    );
  };

  const groupLabel = (groupKey: GroupKey) => (
    <p className="px-3 pb-1 text-micro font-semibold text-muted-foreground uppercase">
      {t(`groups.${groupKey}`)}
    </p>
  );

  return (
    <>
      {/* ── Desktop rail ─────────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
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
            <span className="line-clamp-2 text-body leading-tight font-semibold text-foreground">
              {tenantName}
            </span>
            <span className="text-caption leading-tight text-muted-foreground">
              {t("brand")}
            </span>
          </span>
        </Link>

        <nav aria-label={t("navigation")} className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-6">
          {desktopGroups.map((group, index) => (
            <div key={group.groupKey ?? `top-${index}`} className="space-y-0.5">
              {group.groupKey && groupLabel(group.groupKey)}
              {group.items.map((navItem) => navLink(navItem))}
            </div>
          ))}
        </nav>

        <div className="space-y-0.5 border-t border-sidebar-border px-3 py-3">
          {navLink(settings)}
          <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-micro font-semibold tracking-normal text-background"
            >
              {initialsOf(displayName)}
            </span>
            <span className="min-w-0 flex-1 truncate text-label font-medium text-muted-foreground">
              {displayName}
            </span>
            <Link
              href="/api/auth/signout"
              aria-label={t("logout")}
              title={t("logout")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <SignOut aria-hidden className="h-4 w-4" />
            </Link>
          </div>
          <div className="px-3 pt-1">
            <LocaleSwitcher />
          </div>
        </div>
      </aside>

      {/* ── Mobile top bar: which yeguada you are in, and who you are ── */}
      <header className="safe-area-top fixed top-0 right-0 left-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar/95 px-4 backdrop-blur-lg md:hidden">
        <Link
          href={`/${tenantSlug}/inicio`}
          className="flex min-w-0 items-center gap-2.5"
        >
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
            <Image src="/logo.png" alt="" fill sizes="32px" className="object-contain p-1" />
          </span>
          <span className="truncate text-body font-semibold text-foreground">
            {tenantName}
          </span>
        </Link>
        <Link
          href={`/${tenantSlug}/ajustes`}
          aria-label={t("accountSettings")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-micro font-semibold tracking-normal text-background"
          >
            {initialsOf(displayName)}
          </span>
        </Link>
      </header>

      {/* ── Mobile bottom tabs ───────────────────────────────── */}
      <nav aria-label={t("navigation")} className="safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t border-sidebar-border bg-sidebar/95 backdrop-blur-lg md:hidden">
        <div className="flex h-16 items-stretch">
          {mobileTabs.map(({ key, href, icon: Icon }) => {
            const active = isTabActive(href);
            return (
              <Link
                key={href}
                href={`/${tenantSlug}/${href}`}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1"
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary/12",
                  )}
                >
                  <Icon
                    aria-hidden
                    weight={active ? "fill" : "regular"}
                    className={cn(
                      "h-5 w-5 shrink-0",
                      active ? "text-primary-ink" : "text-muted-foreground",
                    )}
                  />
                </span>
                <span
                  className={cn(
                    "max-w-full truncate px-1 text-micro tracking-normal",
                    active
                      ? "font-semibold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {/* "Reproducción" no cabe en una quinta parte de un móvil. */}
                  {key === "reproduction" ? t("tabs.reproduction") : label(key)}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-controls="mobile-navigation"
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1"
          >
            <span
              className={cn(
                "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                (moreOpen || sheetActive) && "bg-primary/12",
              )}
            >
              <List
                aria-hidden
                className={cn(
                  "h-5 w-5 shrink-0",
                  moreOpen || sheetActive ? "text-primary-ink" : "text-muted-foreground",
                )}
              />
            </span>
            <span
              className={cn(
                "text-micro tracking-normal",
                moreOpen || sheetActive
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
            aria-hidden
            className="animate-in fade-in-0 fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px] duration-200 md:hidden"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label={t("moreSheet")}
            className="safe-area-bottom animate-in slide-in-from-bottom fixed right-0 bottom-0 left-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background shadow-overlay duration-200 md:hidden"
          >
            <div className="flex justify-center pt-3 pb-1">
              <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-2">
              <p className="text-heading font-semibold text-foreground">
                {t("moreSheet")}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label={t("close")}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <div className="space-y-4 px-3 pb-6">
              {mobileSheetGroups.map((group) => (
                <div key={group.groupKey} className="space-y-0.5">
                  {groupLabel(group.groupKey)}
                  {group.items.map((navItem) => navLink(navItem, { large: true }))}
                </div>
              ))}
              <div className="space-y-0.5">
                <p className="px-3 pb-1 text-micro font-semibold text-muted-foreground uppercase">
                  {t("account")}
                </p>
                {navLink(settings, { large: true })}
                <Link
                  href="/api/auth/signout"
                  className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-body font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                >
                  <SignOut aria-hidden className="h-[18px] w-[18px] shrink-0" />
                  {t("logout")}
                </Link>
                <div className="px-3 pt-3">
                  <LocaleSwitcher />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
