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
        toast.success(`Se han generado ${data.generated} facturas de pupilaje.`);
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
      className="rounded-full shadow-sm bg-blue-600 hover:bg-blue-700 text-white border-none"
    >
      {generate.isPending ? (
        <><SpinnerGap className="mr-2 h-4 w-4 animate-spin" /> Generando...</>
      ) : (
        "Generar Facturas del Mes"
      )}
    </Button>
  );
}
