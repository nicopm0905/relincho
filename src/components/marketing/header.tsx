"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import type { Session } from "next-auth";

interface HeaderProps {
  session: Session | null;
}

const navLinks = [
  { href: "#features", key: "features" },
  { href: "#nosotros", key: "about" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

export function Header({ session }: HeaderProps) {
  const t = useTranslations("marketing");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock the page behind the open mobile menu.
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 left-0 z-50 transition-all duration-300",
        scrolled ? "py-3" : "py-4 sm:py-6",
      )}
    >
      <div className="container mx-auto max-w-5xl px-4 sm:px-6">
        <div
          className={cn(
            "mx-auto flex items-center justify-between gap-3 transition-all duration-300",
            scrolled || menuOpen
              ? "rounded-full border border-border/50 bg-white/85 px-3 py-2 shadow-sm backdrop-blur-xl sm:px-4"
              : "bg-transparent px-2 py-2",
          )}
        >
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2"
            onClick={() => setMenuOpen(false)}
          >
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/40 bg-white shadow-sm transition-transform group-hover:scale-105">
              <Image
                src="/logo.png"
                alt="Relincho"
                fill
                className="object-contain p-1"
                priority
              />
            </span>
            <span className="truncate font-heading text-lg font-bold tracking-tight">
              Relincho
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <LocaleSwitcher className="hidden sm:inline-flex" />
            {session?.user ? (
              <Button asChild size="sm" className="rounded-full">
                <Link href="/dashboard">{t("actions.goToPanel")}</Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  asChild
                  size="sm"
                  className="hidden rounded-full sm:inline-flex"
                >
                  <Link href="/login">{t("actions.login")}</Link>
                </Button>
                <Button asChild size="sm" className="rounded-full">
                  <Link href="/login">{t("actions.startFree")}</Link>
                </Button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? t("actions.closeMenu") : t("actions.openMenu")}
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-white text-foreground shadow-sm transition-colors hover:bg-muted md:hidden"
            >
              {menuOpen ? (
                <X className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <Menu className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <nav className="animate-in fade-in-0 slide-in-from-top-2 mt-2 rounded-3xl border border-border/50 bg-white/95 p-2 shadow-lg backdrop-blur-xl duration-200 md:hidden">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-2xl px-4 py-3 text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                {t(`nav.${link.key}`)}
              </Link>
            ))}
            <div className="flex items-center justify-between px-4 py-3">
              {!session?.user && (
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-[15px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t("actions.login")}
                </Link>
              )}
              <LocaleSwitcher className="ml-auto" />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
