"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowClockwise, House, WarningOctagon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/client-report";

/**
 * Frontera de error dentro del panel de la yeguada.
 *
 * Vive bajo el layout del tenant, así que el menú sigue en pantalla: un fallo
 * en una sección no deja al usuario sin forma de ir a otra. `unstable_retry`
 * vuelve a pedir los datos del servidor, que es lo que suele fallar aquí.
 */
export default function TenantError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const t = useTranslations("errors.crash");
  const { tenantSlug } = useParams<{ tenantSlug: string }>();

  useEffect(() => {
    reportClientError(error, { boundary: "tenant" });
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-card"
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-state-alert-soft text-state-alert-ink">
        <WarningOctagon aria-hidden weight="duotone" className="h-6 w-6" />
      </span>
      <h1 className="font-serif text-title font-medium text-foreground">
        {t("title")}
      </h1>
      <p className="mt-2 text-body text-muted-foreground">{t("body")}</p>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => unstable_retry()}>
          <ArrowClockwise weight="bold" />
          {t("retry")}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/${tenantSlug}/inicio`}>
            <House weight="bold" />
            {t("home")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
