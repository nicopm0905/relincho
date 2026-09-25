"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SlidersHorizontal } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { MARE_CONDITIONS, conditionLabels, type MareCondition } from "@/lib/repro-labels";

type Profile = {
  cycleLengthDays: number | null;
  estrusLengthDays: number | null;
  gestationDays: number | null;
  preovulatoryFollicleMm: number | null;
  conditions: string[];
  notes: string | null;
} | null;

/** Lo que se usa ahora mismo, para enseñarlo como placeholder. */
type Effective = {
  cycleLengthDays: number;
  estrusLengthDays: number;
  gestationDays: number;
  preovulatoryFollicleMm: number;
};

const FIELDS = [
  { key: "cycleLengthDays", label: "Duración del ciclo (días)", min: 15, max: 30 },
  { key: "estrusLengthDays", label: "Duración del celo (días)", min: 2, max: 10 },
  { key: "gestationDays", label: "Gestación media (días)", min: 300, max: 380 },
  { key: "preovulatoryFollicleMm", label: "Folículo preovulatorio (mm)", min: 25, max: 55 },
] as const;

export function MareProfileDialog({
  horseId,
  profile,
  effective,
}: {
  horseId: string;
  profile: Profile;
  effective: Effective;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, profile?.[f.key]?.toString() ?? ""])),
  );
  const [conditions, setConditions] = useState<string[]>(profile?.conditions ?? []);
  const [notes, setNotes] = useState(profile?.notes ?? "");

  const save = trpc.reproduction.upsertMareProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil reproductivo guardado");
      setOpen(false);
      router.refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = (k: string) => (values[k]?.trim() ? Number(values[k]) : null);
    save.mutate({
      horseId,
      cycleLengthDays: num("cycleLengthDays"),
      estrusLengthDays: num("estrusLengthDays"),
      gestationDays: num("gestationDays"),
      preovulatoryFollicleMm: num("preovulatoryFollicleMm"),
      conditions: conditions as MareCondition[],
      notes: notes.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <SlidersHorizontal />
        Perfil de la yegua
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Perfil reproductivo</DialogTitle>
          <DialogDescription>
            Deja un campo vacío para que se aprenda de su historial (o se use el de la yeguada).
            Rellénalo solo si el veterinario conoce el valor de esta yegua.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`mp-${f.key}`}>{f.label}</Label>
                <Input
                  id={`mp-${f.key}`}
                  type="number"
                  inputMode="numeric"
                  min={f.min}
                  max={f.max}
                  value={values[f.key]}
                  placeholder={`Ahora: ${effective[f.key]}`}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium text-foreground">Antecedentes</legend>
            <div className="flex flex-wrap gap-1.5">
              {MARE_CONDITIONS.map((c) => {
                const active = conditions.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setConditions((prev) => (active ? prev.filter((x) => x !== c) : [...prev, c]))
                    }
                    className={cn(
                      "min-h-9 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {conditionLabels[c]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="mp-notes">Notas</Label>
            <Textarea id="mp-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
