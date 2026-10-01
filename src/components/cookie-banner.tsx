"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ATTRIBUTION_MAX_AGE_SECONDS,
  ATTRIBUTION_REFERRER_COOKIE,
  ATTRIBUTION_SOURCE_COOKIE,
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  normalizeSource,
  parseConsent,
  referrerHost,
  type ConsentValue,
} from "@/lib/attribution";

function readCookie(name: string): string | null {
  const match = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Aviso de cookies conforme a la guía de la AEPD: dice la verdad (solo
 * cookies propias, sin publicidad), "Aceptar" y "Rechazar" pesan lo mismo y
 * seguir navegando no cuenta como aceptar.
 *
 * Lo único opcional es la cookie de origen (de qué folleto o enlace vino la
 * visita). Al aceptar se guarda aquí mismo si la página trae `?src=`; la
 * medición de visitas (Vercel Web Analytics) no usa cookies.
 */
export function CookieBanner() {
  const t = useTranslations("cookieBanner");
  const [decided, setDecided] = useState(false);
  const stored = useSyncExternalStore(
    () => () => {},
    () => parseConsent(readCookie(CONSENT_COOKIE)),
    // En el servidor no se pinta: evita un parpadeo en quien ya decidió.
    () => "si" as ConsentValue,
  );

  const decide = (value: ConsentValue) => {
    writeCookie(CONSENT_COOKIE, value, CONSENT_MAX_AGE_SECONDS);
    if (value === "si" && !readCookie(ATTRIBUTION_SOURCE_COOKIE)) {
      const source = normalizeSource(new URLSearchParams(location.search).get("src"));
      if (source) {
        writeCookie(ATTRIBUTION_SOURCE_COOKIE, source, ATTRIBUTION_MAX_AGE_SECONDS);
        const referrer = referrerHost(document.referrer);
        if (referrer) {
          writeCookie(ATTRIBUTION_REFERRER_COOKIE, referrer, ATTRIBUTION_MAX_AGE_SECONDS);
        }
      }
    }
    if (value === "no") {
      writeCookie(ATTRIBUTION_SOURCE_COOKIE, "", 0);
      writeCookie(ATTRIBUTION_REFERRER_COOKIE, "", 0);
    }
    setDecided(true);
  };

  if (stored || decided) return null;

  return (
    <div
      role="region"
      aria-label={t("title")}
      className="safe-area-bottom fixed right-0 bottom-0 left-0 z-50 p-2 sm:p-3"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xl sm:flex-row sm:items-center sm:gap-5 sm:px-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm font-bold text-foreground">{t("title")}</h3>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground sm:text-xs">
            {t("body")}{" "}
            <Link href="/cookies" className="font-medium text-foreground underline underline-offset-2">
              {t("more")}
            </Link>
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={() => decide("no")} className="h-9 px-4 text-xs">
            {t("reject")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => decide("si")} className="h-9 px-4 text-xs">
            {t("accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
