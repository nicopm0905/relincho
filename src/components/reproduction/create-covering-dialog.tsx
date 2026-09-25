"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Plus } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";
import { methodLabels } from "@/lib/repro-labels";
import { COVERING_METHODS, type CoveringMethodKey } from "@/lib/repro-settings";

const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground";
const EXTERNAL = "__external__";

/** Tipo de semen de un lote que corresponde a cada metodo. */
const semenForMethod: Partial<Record<CoveringMethodKey, string>> = {
  AI_FRESH: "FRESH",
  AI_REFRIGERATED: "REFRIGERATED",
  AI_FROZEN: "FROZEN",
};

export function CreateCoveringDialog({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [method, setMethod] = useState<CoveringMethodKey>("NATURAL");
  const [stallion, setStallion] = useState("");
  const [external, setExternal] = useState("");
  const [batchId, setBatchId] = useState("");
  const [doses, setDoses] = useState("1");
  const [notes, setNotes] = useState("");

  const { data: horses } = trpc.horses.list.useQuery(undefined, { enabled: open });
  const stallions = horses?.filter((h) => h.sex === "MALE") ?? [];
  const { data: semen } = trpc.reproduction.listSemen.useQuery(undefined, { enabled: open, retry: false });
  const semenType = semenForMethod[method];
  const batches = (semen ?? []).filter((b) => b.dosesLeft > 0 && (!semenType || b.semenType === semenType));

  const add = trpc.reproduction.addCovering.useMutation({
    onSuccess: () => {
      toast.success("Cubrición registrada");
      setOpen(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  function reset(next: boolean) {
    setOpen(next);
    if (next) {
      setDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setMethod("NATURAL");
      setStallion("");
      setExternal("");
      setBatchId("");
      setDoses("1");
      setNotes("");
    }
  }

  function pickBatch(id: string) {
    setBatchId(id);
    const batch = semen?.find((b) => b.id === id);
    if (!batch) return;
    if (batch.stallionId) setStallion(batch.stallionId);
    else {
      setStallion(EXTERNAL);
      setExternal(batch.externalStallionName ?? "");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return toast.error("Fecha no válida");
    add.mutate({
      cycleId,
      date: when,
      method,
      stallionId: stallion && stallion !== EXTERNAL ? stallion : undefined,
      externalStallionName: stallion === EXTERNAL ? external.trim() || undefined : undefined,
      semenBatchId: batchId || null,
      dosesUsed: batchId ? Math.max(1, Number(doses) || 1) : null,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => reset(true)}>
        <Plus weight="bold" />
        Cubrición
      </Button>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar cubrición</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="cov-date">Fecha y hora</Label>
                <Input id="cov-date" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cov-method">Método</Label>
                <select
                  id="cov-method"
                  className={selectClass}
                  value={method}
                  onChange={(e) => {
                    setMethod(e.target.value as CoveringMethodKey);
                    setBatchId("");
                  }}
                >
                  {COVERING_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {methodLabels[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {batches.length > 0 && method !== "NATURAL" && (
              <div className="grid gap-4 sm:grid-cols-[1fr_110px]">
                <div className="space-y-1.5">
                  <Label htmlFor="cov-batch">Lote de semen</Label>
                  <select id="cov-batch" className={selectClass} value={batchId} onChange={(e) => pickBatch(e.target.value)}>
                    <option value="">Sin lote registrado</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.stallionName} · {b.dosesLeft} dosis{b.location ? ` · ${b.location}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {batchId && (
                  <div className="space-y-1.5">
                    <Label htmlFor="cov-doses">Dosis usadas</Label>
                    <Input id="cov-doses" type="number" min={1} value={doses} onChange={(e) => setDoses(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cov-stallion">Semental</Label>
              <select id="cov-stallion" className={selectClass} value={stallion} onChange={(e) => setStallion(e.target.value)}>
                <option value="">Sin indicar</option>
                {stallions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value={EXTERNAL}>De fuera de la yeguada…</option>
              </select>
            </div>
            {stallion === EXTERNAL && (
              <div className="space-y-1.5">
                <Label htmlFor="cov-external">Nombre del semental</Label>
                <Input
                  id="cov-external"
                  value={external}
                  onChange={(e) => setExternal(e.target.value)}
                  placeholder="p. ej. Invasor XXII (centro de sementales)"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cov-notes">Notas</Label>
              <Textarea id="cov-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={add.isPending}>
                {add.isPending ? "Guardando…" : "Guardar cubrición"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
