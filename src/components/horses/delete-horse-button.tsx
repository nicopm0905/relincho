"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Borrar es para altas hechas por error: pide escribir el nombre para que no
 * se haga de un toque. Si el caballo tiene historial, el servidor lo impide y
 * el mensaje explica que hay que darlo de baja con un movimiento.
 */
export function DeleteHorseButton({
  horseId,
  horseName,
  tenantSlug,
}: {
  horseId: string;
  horseName: string;
  tenantSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const remove = trpc.horses.delete.useMutation({
    onSuccess: () => {
      toast.success(`${horseName} eliminado`);
      router.push(`/${tenantSlug}/caballos`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || "No se ha podido eliminar"),
  });

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/[0.03] p-5">
      <h2 className="text-sm font-semibold text-foreground">Eliminar caballo</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Solo para un caballo dado de alta por error. Si ha salido de la cuadra, regístralo en
        Movimientos como venta o muerte: así se conserva su historial.
      </p>
      {open ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            remove.mutate({ id: horseId });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="confirm-horse-name">
              Escribe <strong>{horseName}</strong> para confirmar
            </Label>
            <Input
              id="confirm-horse-name"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              variant="destructive"
              disabled={typed.trim() !== horseName || remove.isPending}
            >
              {remove.isPending ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="mt-4 border-destructive/40 text-destructive hover:text-destructive"
          onClick={() => setOpen(true)}
        >
          <Trash weight="bold" />
          Eliminar caballo
        </Button>
      )}
    </section>
  );
}
