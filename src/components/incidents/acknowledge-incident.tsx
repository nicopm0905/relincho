"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";

/**
 * Abrir la incidencia la marca leída (una vez) y el botón la confirma. El
 * centro ve las dos horas por separado: leída no es confirmada.
 *
 * La confirmación se muestra en cuanto el servidor la acepta, sin esperar al
 * `router.refresh()`: a veces el router no lo aplica y el propietario seguía
 * viendo el botón con el acuse ya guardado (#78).
 */
export function AcknowledgeIncident({
  id,
  read,
  acknowledgedAt,
  resolved,
}: {
  id: string;
  read: boolean;
  acknowledgedAt: Date | null;
  resolved: boolean;
}) {
  const t = useTranslations("incidents.detail");
  const format = useFormatter();
  const router = useRouter();
  const markRead = trpc.incidents.markRead.useMutation();
  const sent = useRef(false);
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (read || sent.current) return;
    sent.current = true;
    markRead.mutate({ id });
  }, [id, read, markRead]);

  const acknowledge = trpc.incidents.acknowledge.useMutation({
    onSuccess: () => {
      setConfirmedAt(new Date());
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t("ackError")),
  });

  const shownAt = acknowledgedAt ?? confirmedAt;
  if (shownAt) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-state-ok-ink">
        <CheckCircle weight="fill" aria-hidden className="h-5 w-5" />
        {t("acknowledged", {
          when: format.dateTime(shownAt, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" }),
        })}
      </p>
    );
  }
  if (resolved) return null;
  return (
    <Button className="h-12 w-full" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate({ id })}>
      {acknowledge.isPending && <CircleNotch weight="bold" aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
      {acknowledge.isPending ? t("acknowledging") : t("acknowledge")}
    </Button>
  );
}
