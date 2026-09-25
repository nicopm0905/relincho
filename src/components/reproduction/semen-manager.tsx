"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { PencilSimple, Plus } from "@phosphor-icons/react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { trpc } from "@/lib/trpc/react";

export const semenTypeLabels: Record<string, string> = {
  FRESH: "Fresco",
  REFRIGERATED: "Refrigerado",
  FROZEN: "Congelado",
};

export type SemenBatchRow = {
  id: string;
  stallionId: string | null;
  externalStallionName: string | null;
  stallionName: string;
  semenType: string;
  provider: string | null;
  dosesTotal: number;
  dosesUsed: number;
  dosesLeft: number;
  collectedAt: Date | null;
  location: string | null;
  costPerDose: number | null;
  notes: string | null;
  coverings: { id: string; date: Date; dosesUsed: number | null; cycleId: string; mare: { name: string } }[];
};

const EXTERNAL = "__external__";

function BatchDialog({
  batch,
  stallions,
  open,
  onOpenChange,
}: {
  batch: SemenBatchRow | null;
  stallions: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [stallion, setStallion] = useState(batch ? (batch.stallionId ?? EXTERNAL) : "");
  const [external, setExternal] = useState(batch?.externalStallionName ?? "");
  const [type, setType] = useState(batch?.semenType ?? "FROZEN");
  const [provider, setProvider] = useState(batch?.provider ?? "");
  const [doses, setDoses] = useState(batch?.dosesTotal.toString() ?? "");
  const [collected, setCollected] = useState(batch?.collectedAt ? format(new Date(batch.collectedAt), "yyyy-MM-dd") : "");
  const [location, setLocation] = useState(batch?.location ?? "");
  const [cost, setCost] = useState(batch?.costPerDose?.toString() ?? "");
  const [notes, setNotes] = useState(batch?.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const done = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      onOpenChange(false);
      router.refresh();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const create = trpc.reproduction.createSemen.useMutation(done("Lote registrado"));
  const update = trpc.reproduction.updateSemen.useMutation(done("Lote actualizado"));
  const remove = trpc.reproduction.deleteSemen.useMutation(done("Lote borrado"));
  const pending = create.isPending || update.isPending || remove.isPending;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      stallionId: stallion && stallion !== EXTERNAL ? stallion : null,
      externalStallionName: stallion === EXTERNAL ? external.trim() || null : null,
      semenType: type as "FRESH" | "REFRIGERATED" | "FROZEN",
      provider: provider.trim() || null,
      dosesTotal: Math.max(1, Number(doses) || 0),
      collectedAt: collected ? new Date(`${collected}T12:00:00`) : null,
      location: location.trim() || null,
      costPerDose: cost.trim() ? Number(cost) : null,
      notes: notes.trim() || null,
    };
    if (batch) update.mutate({ id: batch.id, ...payload });
    else create.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{batch ? "Editar lote de semen" : "Nuevo lote de semen"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sb-stallion">Semental</Label>
              <NativeSelect id="sb-stallion" value={stallion} onChange={(e) => setStallion(e.target.value)} required>
                <option value="" disabled>
                  Selecciona…
                </option>
                {stallions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value={EXTERNAL}>De fuera de la yeguada…</option>
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-type">Tipo de semen</Label>
              <NativeSelect id="sb-type" value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(semenTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {stallion === EXTERNAL && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="sb-external">Nombre del semental</Label>
                <Input id="sb-external" value={external} onChange={(e) => setExternal(e.target.value)} required />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sb-doses">Dosis o pajuelas</Label>
              <Input id="sb-doses" type="number" inputMode="numeric" min={1} value={doses} onChange={(e) => setDoses(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-cost">Coste por dosis</Label>
              <div className="relative">
                <Input
                  id="sb-cost"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="Opcional"
                  className="pr-8"
                />
                <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-sm text-muted-foreground">€</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-collected">Fecha de recogida</Label>
              <Input id="sb-collected" type="date" value={collected} onChange={(e) => setCollected(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sb-location">Ubicación</Label>
              <Input
                id="sb-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Tanque 1 · canastilla 3"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sb-provider">Proveedor o centro de sementales</Label>
              <Input id="sb-provider" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Opcional" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sb-notes">Notas</Label>
            <Textarea id="sb-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {batch ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={pending}
                onClick={() => (confirmDelete ? remove.mutate({ id: batch.id }) : setConfirmDelete(true))}
              >
                {confirmDelete ? "Pulsa otra vez para borrar" : "Borrar lote"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SemenManager({
  batches,
  stallions,
  tenantSlug,
}: {
  batches: SemenBatchRow[];
  stallions: { id: string; name: string }[];
  tenantSlug: string;
}) {
  const [editing, setEditing] = useState<SemenBatchRow | null>(null);
  const [open, setOpen] = useState(false);
  // Clave distinta por apertura: el formulario arranca de cero cada vez.
  const [formKey, setFormKey] = useState(0);
  const openFor = (batch: SemenBatchRow | null) => {
    setEditing(batch);
    setFormKey((k) => k + 1);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openFor(null)}>
          <Plus weight="bold" />
          Nuevo lote
        </Button>
      </div>
      {batches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[13.5px] text-muted-foreground">
          Sin lotes. Registra las pajuelas congeladas o las dosis refrigeradas que compres: al cubrir, se descuentan
          solas.
        </p>
      ) : (
        <ul className="space-y-3">
          {batches.map((b) => (
            <li key={b.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground">
                    {b.stallionName}
                    {!b.stallionId && <span className="font-normal text-muted-foreground"> (de fuera)</span>}
                  </p>
                  <p className="text-[12.5px] text-muted-foreground">
                    {[
                      semenTypeLabels[b.semenType] ?? b.semenType,
                      b.provider,
                      b.location,
                      b.collectedAt ? `recogido ${format(new Date(b.collectedAt), "d MMM yyyy", { locale: es })}` : null,
                      b.costPerDose !== null ? `${b.costPerDose.toFixed(2)} €/dosis` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={b.dosesLeft === 0 ? "destructive" : b.dosesLeft <= 2 ? "warning" : "success"}>
                    {b.dosesLeft} de {b.dosesTotal} dosis
                  </Badge>
                  <Button variant="ghost" size="icon-sm" aria-label={`Editar lote de ${b.stallionName}`} onClick={() => openFor(b)}>
                    <PencilSimple className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {b.coverings.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border pt-3 text-[13px] text-muted-foreground">
                  {b.coverings.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <Link href={`/${tenantSlug}/reproduccion/${c.cycleId}`} className="hover:text-foreground hover:underline">
                        {c.mare.name}
                      </Link>
                      <span className="tabular-nums">
                        {format(new Date(c.date), "d MMM yyyy", { locale: es })} · {c.dosesUsed ?? 1} dosis
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {b.notes && <p className="mt-2 text-[13px] text-muted-foreground">{b.notes}</p>}
            </li>
          ))}
        </ul>
      )}
      <BatchDialog key={formKey} batch={editing} stallions={stallions} open={open} onOpenChange={setOpen} />
    </div>
  );
}
