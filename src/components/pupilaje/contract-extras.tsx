"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash, ArrowsClockwise, Receipt } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";

export interface ExtraItem {
  id: string;
  concept: string;
  amount: number;
  vatRate: number;
  recurring: boolean;
  oneOffApplied: boolean;
}

export function ContractExtras({
  contractId,
  extras,
}: {
  contractId: string;
  extras: ExtraItem[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("0");
  const [vatRate, setVatRate] = useState("21");
  const [recurring, setRecurring] = useState(true);

  const refresh = () => router.refresh();

  const addExtra = trpc.boarding.addExtra.useMutation({
    onSuccess: () => {
      toast.success("Extra añadido");
      setConcept("");
      setAmount("0");
      refresh();
    },
    onError: (e) => toast.error(e.message || "Error"),
  });
  const removeExtra = trpc.boarding.removeExtra.useMutation({
    onSuccess: () => {
      toast.success("Extra eliminado");
      refresh();
    },
    onError: (e) => toast.error(e.message || "Error"),
  });
  const toggleRecurring = trpc.boarding.toggleExtraRecurring.useMutation({
    onSuccess: refresh,
    onError: (e) => toast.error(e.message || "Error"),
  });

  const recurringCount = extras.filter((e) => e.recurring).length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!concept.trim()) return toast.error("Indica un concepto");
    addExtra.mutate({
      boardingContractId: contractId,
      concept: concept.trim(),
      amount: parseFloat(amount) || 0,
      vatRate: parseFloat(vatRate) || 0,
      recurring,
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mt-3 w-full rounded-lg text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Receipt weight="duotone" className="mr-1.5 h-4 w-4" />
        Extras de facturación ({extras.length}
        {recurringCount > 0 ? `, ${recurringCount} recurrentes` : ""})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Extras del contrato</DialogTitle>
            <DialogDescription>
              Los recurrentes se añaden a cada factura mensual. Los puntuales se
              facturan una sola vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {extras.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Sin extras.
              </p>
            ) : (
              extras.map((extra) => (
                <div
                  key={extra.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/10 p-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{extra.concept}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {extra.amount.toFixed(2)} € · IVA {extra.vatRate}%
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="outline"
                      className={
                        extra.recurring
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : extra.oneOffApplied
                            ? "bg-muted text-muted-foreground"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      }
                    >
                      {extra.recurring
                        ? "Recurrente"
                        : extra.oneOffApplied
                          ? "Puntual (facturado)"
                          : "Puntual"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Cambiar recurrencia"
                      disabled={toggleRecurring.isPending}
                      onClick={() => toggleRecurring.mutate({ id: extra.id })}
                    >
                      <ArrowsClockwise className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-600 hover:bg-rose-50"
                      disabled={removeExtra.isPending}
                      onClick={() => removeExtra.mutate({ id: extra.id })}
                    >
                      <Trash className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <form onSubmit={submit} className="space-y-3 border-t border-border/40 pt-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Concepto</Label>
              <Input
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                placeholder="Ej. Herraje trimestral"
                className="rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-lg font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">IVA %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  className="rounded-lg font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`recurring-${contractId}`}
                checked={recurring}
                onCheckedChange={(c) => setRecurring(c === true)}
              />
              <label
                htmlFor={`recurring-${contractId}`}
                className="text-xs font-medium cursor-pointer text-muted-foreground"
              >
                Recurrente (se factura cada mes)
              </label>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={addExtra.isPending}
                className="rounded-full bg-orange-600 hover:bg-orange-700"
              >
                <Plus weight="bold" className="mr-1 h-4 w-4" />
                Añadir extra
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
