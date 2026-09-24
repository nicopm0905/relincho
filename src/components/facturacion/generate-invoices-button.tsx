"use client";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";

export function GenerateInvoicesButton() {
  const router = useRouter();
  const generate = trpc.invoices.generateMonthly.useMutation({
    onSuccess: (data) => {
      if (data.generated > 0) {
        if ((data.issued ?? 0) === data.generated) {
          toast.success(`Se han emitido ${data.issued} facturas de pupilaje.`);
        } else {
          // Las que no se pueden emitir quedan en borrador, con el motivo.
          toast.warning(
            `${data.issued} de ${data.generated} emitidas. El resto queda en borrador: ${(data.pendingReasons ?? []).join(" ")}`,
            { duration: 10_000 },
          );
        }
        router.refresh();
      } else {
        toast.info("No hay contratos de pupilaje activos para facturar.");
      }
    },
    onError: (err) => {
      toast.error(err.message || "Error al generar facturas.");
    }
  });

  return (
    <Button 
      onClick={() => generate.mutate()}
      disabled={generate.isPending}
      className="h-10 px-5"
    >
      {generate.isPending ? (
        <><SpinnerGap className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
      ) : (
        "Generar Facturas del Mes"
      )}
    </Button>
  );
}
