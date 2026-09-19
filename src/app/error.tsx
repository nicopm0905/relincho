"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { WarningOctagon, ArrowClockwise, House } from "@phosphor-icons/react";
import { reportClientError } from "@/lib/client-report";

/**
 * Frontera de error de la aplicación.
 *
 * El aviso se manda una sola vez al montar: sin esto, un fallo en producción
 * solo se descubre cuando llama un cliente. Se llama a `reportClientError` y no
 * a Sentry directamente para que cambiar de herramienta sea un fichero.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.crash");

  // El aviso se manda una vez, al montar. No se refleja en pantalla a
  // propósito: no hay nada útil que el usuario pueda hacer con ese dato.
  useEffect(() => {
    reportClientError(error, { boundary: "app" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <WarningOctagon weight="duotone" className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="font-heading text-xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("body")}</p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>
            <ArrowClockwise weight="bold" />
            {t("retry")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <House weight="bold" />
              {t("home")}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
