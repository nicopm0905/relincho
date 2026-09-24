"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
  const t = useTranslations("cookieBanner");
  const [accepted, setAccepted] = useState(false);
  const hasConsented = useSyncExternalStore(
    () => () => {},
    () => Boolean(localStorage.getItem("cookie-consent")),
    () => true,
  );

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "true");
    setAccepted(true);
  };

  if (hasConsented || accepted) return null;

  return (
    <div className="safe-area-bottom fixed right-0 bottom-0 left-0 z-50 p-2 sm:p-3">
      <div className="mx-auto grid max-w-3xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-xl sm:gap-5 sm:px-4">
        <div className="min-w-0">
          <h3 className="font-heading text-sm font-bold text-foreground">
            {t("title")}
          </h3>
          <p className="mt-0.5 max-h-10 overflow-hidden text-[11px] leading-relaxed text-muted-foreground sm:max-h-none sm:text-xs">
            {t("body")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <Button size="sm" onClick={acceptCookies} className="h-8 px-3 text-xs">
            {t("accept")}
          </Button>
          <Button size="sm" variant="outline" asChild className="h-8 px-3 text-xs">
            <Link href="/cookies">{t("more")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
