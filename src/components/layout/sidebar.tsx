"use client";

import Link from "next/link";
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
} from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

const navItems = [
  { label: "Inicio", href: "inicio", icon: Home },
  { label: "Caballos", href: "caballos", icon: Layers },
  { label: "Sanidad", href: "sanidad", icon: Activity },
  { label: "Reproducción", href: "reproduccion", icon: Baby },
  { label: "Movimientos", href: "movimientos", icon: Route },
  { label: "Pupilaje", href: "pupilaje", icon: Store },
  { label: "Facturación", href: "facturacion", icon: Receipt },
  { label: "Tareas", href: "tareas", icon: CheckSquare },
  { label: "Documentos", href: "documentos", icon: Files },
  { label: "Contactos", href: "contactos", icon: Users },
];

const bottomItems = [
  { label: "Ajustes", href: "ajustes", icon: Settings },
];

// Primary tabs for mobile bottom nav (most-used features)
const mobileTabItems = navItems.slice(0, 4);
// Overflow items shown in mobile "More" sheet
const mobileOverflowItems = [...navItems.slice(4), ...bottomItems];

interface SidebarProps {
  tenantSlug: string;
  tenantName: string;
}

export function Sidebar({ tenantSlug, tenantName }: SidebarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the More sheet when navigating
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Prevent body scroll when More sheet is open
  useEffect(() => {
    if (moreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  return (
    <>
      {/* ═══════ DESKTOP SIDEBAR ═══════ */}
      <aside className="hidden md:flex w-[260px] shrink-0 bg-[#f9f9f6] border-r border-border/40 flex-col h-screen sticky top-0">
        {/* Brand Header */}
        <div className="px-6 py-8">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-white border border-border/40 shadow-sm relative overflow-hidden">
              <Image src="/logo.png" alt="Relincho" fill className="object-contain p-1" priority />
            </div>
            <div className="flex flex-col truncate">
              <p className="text-[13px] text-muted-foreground font-medium">Relincho</p>
              <p className="font-bold text-[15px] truncate text-foreground tracking-tight font-heading">
                {tenantName}
              </p>
            </div>
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 overflow-y-auto px-4 space-y-1.5 pb-6">
          {navItems.map(({ label, href, icon: Icon }) => {
            const fullHref = `/${tenantSlug}/${href}`;
            const active = pathname.startsWith(fullHref);
            return (
              <Link
                key={href}
                href={fullHref}
                className={cn(
                  "group flex items-center gap-3.5 rounded-full px-4 py-3 text-[14px] font-semibold transition-all duration-200",
                  active
                    ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
                )}
              >
                <Icon
                  strokeWidth={active ? 2.5 : 2}
                  className={cn(
                    "h-[20px] w-[20px] shrink-0 transition-all duration-300",
                    active ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Items */}
        <div className="px-4 pb-6 pt-4 border-t border-border/40">
          {bottomItems.map(({ label, href, icon: Icon }) => {
            const fullHref = `/${tenantSlug}/${href}`;
            const active = pathname.startsWith(fullHref);
            return (
              <Link
                key={href}
                href={fullHref}
                className={cn(
                  "group flex items-center gap-3.5 rounded-full px-4 py-3 text-[14px] font-semibold transition-all duration-200",
                  active
                    ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-foreground"
                    : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
                )}
              >
                <Icon 
                  strokeWidth={active ? 2.5 : 2}
                  className={cn(
                    "h-[20px] w-[20px] shrink-0 transition-all duration-300",
                    active ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground",
                  )} 
                />
                {label}
              </Link>
            );
          })}
        </div>
      </aside>

      {/* ═══════ MOBILE BOTTOM NAV ═══════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#f9f9f6]/95 backdrop-blur-lg border-t border-border/40 safe-area-bottom">
        <div className="flex items-center justify-around px-2 h-16">
          {mobileTabItems.map(({ label, href, icon: Icon }) => {
            const fullHref = `/${tenantSlug}/${href}`;
            const active = pathname.startsWith(fullHref);
            return (
              <Link
                key={href}
                href={fullHref}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-w-0 flex-1 py-1 transition-colors duration-150",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-full transition-all duration-300",
                  active ? "bg-white shadow-sm" : "bg-transparent"
                )}>
                  <Icon
                    strokeWidth={active ? 2.5 : 2}
                    className={cn(
                      "h-[20px] w-[20px] shrink-0 transition-transform duration-300",
                      active && "text-primary scale-110"
                    )}
                  />
                </div>
                <span className="text-[10px] font-medium truncate max-w-full">
                  {label}
                </span>
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 min-w-0 flex-1 py-1 transition-colors duration-150",
              moreOpen ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <div className={cn(
              "p-1.5 rounded-full transition-all duration-300",
              moreOpen ? "bg-white shadow-sm" : "bg-transparent"
            )}>
              <Menu strokeWidth={moreOpen ? 2.5 : 2} className={cn("h-[20px] w-[20px] shrink-0", moreOpen && "text-primary scale-110")} />
            </div>
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </nav>

      {/* ═══════ MOBILE "MORE" SHEET ═══════ */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-300"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#f9f9f6] rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[80vh] overflow-y-auto safe-area-bottom">
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1.5 w-12 rounded-full bg-border" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-border/40 shadow-sm relative overflow-hidden">
                  <Image src="/logo.png" alt="Relincho" fill className="object-contain p-1" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Relincho</p>
                  <p className="font-bold text-sm truncate text-foreground tracking-tight font-heading">
                    {tenantName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-8 w-8 rounded-full bg-white shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X strokeWidth={2.5} className="h-4 w-4" />
              </button>
            </div>
            {/* Nav items */}
            <div className="px-4 pb-6 space-y-1">
              {mobileOverflowItems.map(({ label, href, icon: Icon }) => {
                const fullHref = `/${tenantSlug}/${href}`;
                const active = pathname.startsWith(fullHref);
                return (
                  <Link
                    key={href}
                    href={fullHref}
                    className={cn(
                      "group flex items-center gap-3.5 rounded-full px-4 py-3.5 text-[15px] font-semibold transition-all duration-200",
                      active
                        ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-foreground"
                        : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
                    )}
                  >
                    <Icon
                      strokeWidth={active ? 2.5 : 2}
                      className={cn(
                        "h-[20px] w-[20px] shrink-0 transition-all duration-300",
                        active ? "text-primary scale-110" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
