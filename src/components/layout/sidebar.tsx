"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Home,
  Layers,
  Activity,
  CheckSquare,
  Baby,
  Files,
  Receipt,
  Users,
  Settings,
  Menu,
  X,
  Route,
  Store,
  Gauge,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

type NavItem = { label: string; href: string; icon: LucideIcon };

/** Grouped so the rail reads as a hierarchy instead of a wall of ten links. */
const navGroups: { label?: string; items: NavItem[] }[] = [
  {
    items: [{ label: "Inicio", href: "inicio", icon: Home }],
  },
  {
    label: "Cuadra",
    items: [
      { label: "Caballos", href: "caballos", icon: Layers },
      { label: "Rendimiento", href: "rendimiento", icon: Gauge },
      { label: "Sanidad", href: "sanidad", icon: Activity },
      { label: "Reproducción", href: "reproduccion", icon: Baby },
      { label: "Movimientos", href: "movimientos", icon: Route },
      { label: "Tareas", href: "tareas", icon: CheckSquare },
    ],
  },
  {
    label: "Negocio",
    items: [
      { label: "Pupilaje", href: "pupilaje", icon: Store },
      { label: "Facturación", href: "facturacion", icon: Receipt },
      { label: "Contactos", href: "contactos", icon: Users },
      { label: "Documentos", href: "documentos", icon: Files },
    ],
  },
];

const allNavItems = navGroups.flatMap((group) => group.items);
const settingsItem: NavItem = {
  label: "Ajustes",
  href: "ajustes",
  icon: Settings,
};

/** Chosen by daily use in a yeguada, not by order in the rail. */
const mobileTabHrefs = ["inicio", "caballos", "sanidad", "reproduccion"];
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
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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

  const displayName = userName || userEmail || "Cuenta";

  const navLink = (
    { label, href, icon: Icon }: NavItem,
    { large = false }: { large?: boolean } = {},
  ) => {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={`/${tenantSlug}/${href}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group flex items-center gap-3 rounded-lg transition-colors duration-150",
          large ? "px-3 py-3 text-[15px]" : "px-3 py-2 text-[13.5px]",
          active
            ? "bg-card font-semibold text-foreground shadow-xs"
            : "font-medium text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
        )}
      >
        <Icon
          strokeWidth={2}
          className={cn(
            "h-[18px] w-[18px] shrink-0 transition-colors",
            active
              ? "text-primary-ink"
              : "text-muted-foreground/80 group-hover:text-foreground",
          )}
        />
        <span className="truncate">{label}</span>
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
              className="object-contain p-1"
              priority
            />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[14px] leading-tight font-semibold text-foreground">
              {tenantName}
            </span>
            <span className="text-[11px] leading-tight text-muted-foreground">
              Relincho
            </span>
          </span>
        </Link>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 pt-2 pb-6">
          {navGroups.map((group, index) => (
            <div key={group.label ?? index} className="space-y-0.5">
              {group.label && (
                <p className="px-3 pb-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground/70 uppercase">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => navLink(item))}
            </div>
          ))}
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
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
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
            <Image src="/logo.png" alt="" fill className="object-contain p-1" />
          </span>
          <span className="truncate text-[15px] font-semibold text-foreground">
            {tenantName}
          </span>
        </Link>
        <Link
          href={`/${tenantSlug}/ajustes`}
          aria-label="Ajustes"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={2} />
        </Link>
      </header>

      {/* ── Mobile bottom tabs ───────────────────────────────── */}
      <nav className="safe-area-bottom fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-sidebar/95 backdrop-blur-lg md:hidden">
        <div className="flex h-16 items-stretch">
          {mobileTabItems.map(({ label, href, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={`/${tenantSlug}/${href}`}
                aria-current={active ? "page" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1"
              >
                <Icon
                  strokeWidth={2}
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
                  {label}
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1"
          >
            <Menu
              strokeWidth={2}
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
              Más
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
            role="dialog"
            aria-label="Más secciones"
            className="safe-area-bottom animate-in slide-in-from-bottom fixed right-0 bottom-0 left-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background duration-200 md:hidden"
          >
            <div className="flex justify-center pt-3 pb-1">
              <span className="h-1 w-10 rounded-full bg-border" />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[13px] font-semibold text-foreground">
                Más secciones
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
            <div className="space-y-0.5 px-3 pb-5">
              {mobileOverflowItems.map((item) => navLink(item, { large: true }))}
              <Link
                href="/api/auth/signout"
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
              >
                <LogOut
                  className="h-[18px] w-[18px] shrink-0"
                  strokeWidth={2}
                />
                Cerrar sesión
              </Link>
            </div>
          </div>
        </>
      )}
    </>
  );
}
