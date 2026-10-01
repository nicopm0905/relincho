"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SpinnerGap, Trash } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Borrar un pesaje mal tecleado. El peso de la ración vuelve al anterior. */
export function DeleteMeasurementButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = trpc.bodyCondition.delete.useMutation({
    onSuccess: () => {
      toast.success("Pesaje borrado");
      setOpen(false);
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "No se pudo borrar"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Borrar ${label}`} />}
      >
        <Trash className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Borrar el {label}?</DialogTitle>
          <DialogDescription>
            Si era el último, la ración vuelve a usar el peso del pesaje anterior.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate({ id })}>
            {remove.isPending && <SpinnerGap className="animate-spin" />}
            Borrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
