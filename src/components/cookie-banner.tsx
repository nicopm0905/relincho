"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
  const t = useTranslations("cookieBanner");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if the user has already consented
    const hasConsented = localStorage.getItem("cookie-consent");
    if (!hasConsented) {
      setShowBanner(true);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("cookie-consent", "true");
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="safe-area-bottom fixed right-0 bottom-0 left-0 z-50 p-3 sm:left-auto sm:bottom-4 sm:right-4 sm:max-w-sm sm:p-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
        <div className="flex flex-col gap-2">
          <h3 className="font-heading font-bold text-foreground">{t("title")}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("body")}
          </p>
        </div>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button onClick={acceptCookies} className="w-full sm:w-auto">
            {t("accept")}
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto">
            <Link href="/cookies">{t("more")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
