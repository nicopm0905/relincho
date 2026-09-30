"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SpinnerGap } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";

interface Props {
  horseId: string;
  reason: string;
}

/**
 * Con el semáforo en rojo y sesión prevista hoy: un toque para pasar el día a
 * descanso. El motor de periodización reparte la carga en los días siguientes
 * y la ración se recalcula, igual que cuando se marca un día como perdido.
 */
export function RestTodayButton({ horseId, reason }: Props) {
  const router = useRouter();
  const markMissed = trpc.performance.markMissedDay.useMutation({
    onSuccess: (result) => {
      toast.success(
        result.adjustments.length > 0
          ? `Hoy descansa. Se han reajustado ${result.adjustments.length} días del plan.`
          : "Hoy descansa. No quedaba margen para repartir la carga.",
      );
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo reajustar el plan"),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-auto min-h-9 py-2 text-left whitespace-normal"
      disabled={markMissed.isPending}
      onClick={() =>
        markMissed.mutate({ horseId, date: new Date(), reason: reason.slice(0, 300) })
      }
    >
      {markMissed.isPending && <SpinnerGap className="animate-spin" />}
      Pasar hoy a descanso y reajustar el plan
    </Button>
  );
}
