"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Session } from "next-auth";
import { LOGO } from "./assets";

interface NavbarV2Props {
  session: Session | null;
}

/**
 * Los anclas apuntan a los ids reales de las secciones reutilizadas de
 * `src/components/marketing/` — la seccion "Nosotros" se llama `#nosotros`.
 */
const navLinks = [
  { href: "#features", key: "features" },
  { href: "#nosotros", key: "about" },
  { href: "#pricing", key: "pricing" },
  { href: "#faq", key: "faq" },
] as const;

export function NavbarV2({ session }: NavbarV2Props) {
  const t = useTranslations("landingV2.nav");
  const signedIn = Boolean(session?.user);
  const [scrolled, setScrolled] = useState(false);

  // Debajo del hero vienen secciones claras reutilizadas. Sin un fondo propio,
  // el texto blanco de la barra quedaria ilegible sobre ellas.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed top-0 right-0 left-0 z-50 px-5 py-4 sm:px-8">
      <div
        className="relative flex h-12 items-center rounded-full px-3 transition-colors duration-300"
        style={
          scrolled
            ? {
                backgroundColor: "rgba(11,13,8,0.85)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,0.10)",
              }
            : { border: "1px solid transparent" }
        }
      >
        <Link href="/landing-v2" className="flex items-center">
          <Image
            src={LOGO}
            alt="Relincho"
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            priority
          />
        </Link>

        <nav
          aria-label={t("navigation")}
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 px-2 py-1.5 backdrop-blur-[12px] md:flex"
          style={{ backgroundColor: "rgba(20,22,16,0.75)" }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-normal text-white/80 transition-colors hover:bg-white/10"
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              {t("goToPanel")}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden px-3 text-sm font-normal text-white/80 transition-colors hover:text-white sm:inline"
              >
                {t("login")}
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
              >
                {t("startFree")}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
