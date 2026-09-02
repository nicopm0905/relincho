"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
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
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md">
      <div className="bg-white border border-border shadow-xl rounded-2xl p-6 flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 className="font-heading font-bold text-foreground">Aviso de Cookies</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Utilizamos cookies propias y de terceros para mejorar nuestros servicios y mostrarle publicidad relacionada con sus preferencias mediante el análisis de sus hábitos de navegación. Si continúa navegando, consideramos que acepta su uso.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-2">
          <Button onClick={acceptCookies} className="w-full sm:w-auto rounded-full">
            Aceptar
          </Button>
          <Button variant="outline" asChild className="w-full sm:w-auto rounded-full">
            <Link href="/cookies">Más información</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
