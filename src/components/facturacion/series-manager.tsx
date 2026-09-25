"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilSimple, Plus, Star } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
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

export interface SeriesRow {
  id: string;
  code: string;
  prefix: string;
  year: number;
  nextNumber: number;
  isDefault: boolean;
  isRectifying: boolean;
  issuedCount: number;
}

export function SeriesManager({ series, canManage }: { series: SeriesRow[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SeriesRow | "new" | null>(null);

  const onError = (err: { message: string }) => toast.error(err.message);
  const setDefault = trpc.invoices.seriesSetDefault.useMutation({
    onSuccess: () => {
      toast.success("Serie por defecto actualizada");
      router.refresh();
    },
    onError,
  });

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setEditing("new")}>
            <Plus weight="bold" />
            Nueva serie
          </Button>
        </div>
      )}

      <div className="no-scrollbar overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-5 py-3">Serie</th>
              <th scope="col" className="px-5 py-3">Año</th>
              <th scope="col" className="px-5 py-3 text-right">Emitidas</th>
              <th scope="col" className="px-5 py-3 text-right">Próximo nº</th>
              <th scope="col" className="px-5 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {series.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3">
                  <span className="font-mono font-medium">{s.code}</span>{" "}
                  {s.isDefault && <Badge variant="success">Por defecto</Badge>}
                  {s.isRectifying && <Badge variant="outline">Rectificativas</Badge>}
                </td>
                <td className="px-5 py-3 text-muted-foreground">{s.year}</td>
                <td className="px-5 py-3 text-right font-mono">{s.issuedCount}</td>
                <td className="px-5 py-3 text-right font-mono">{s.nextNumber}</td>
                <td className="px-5 py-3 text-right">
                  {canManage && !s.isRectifying && (
                    <div className="flex justify-end gap-1">
                      {!s.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={setDefault.isPending}
                          onClick={() => setDefault.mutate({ id: s.id })}
                        >
                          <Star weight="bold" />
                          Por defecto
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        <PencilSimple weight="bold" />
                        Editar
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        La numeración de cada serie es correlativa y sin huecos: el número se asigna al emitir. Una serie con
        facturas no cambia de prefijo ni de año; para cambiar de numeración crea una serie nueva. La serie de
        rectificativas la crea el sistema.
      </p>

      {editing && (
        <SeriesDialog
          series={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SeriesDialog({
  series,
  onClose,
  onSaved,
}: {
  series: SeriesRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [prefix, setPrefix] = useState(series?.prefix ?? "");
  const [year, setYear] = useState(String(series?.year ?? new Date().getFullYear()));
  const [isDefault, setIsDefault] = useState(series?.isDefault ?? false);

  const upsert = trpc.invoices.seriesUpsert.useMutation({
    onSuccess: () => {
      toast.success(series ? "Serie guardada" : "Serie creada");
      onSaved();
    },
    onError: (err) => toast.error(err.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const y = Number(year);
    if (!prefix.trim()) return toast.error("Indica el prefijo");
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return toast.error("Año no válido");
    upsert.mutate({
      id: series?.id,
      // El código no se pide: se deriva del prefijo y el año.
      prefix: prefix.trim(),
      year: y,
      isDefault,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{series ? "Editar serie" : "Nueva serie"}</DialogTitle>
          <DialogDescription>
            Las facturas se numeran como <span className="font-mono">{prefix.trim() || "PREFIJO"}-0001</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="series-prefix">Prefijo</Label>
              <Input
                id="series-prefix"
                value={prefix}
                maxLength={10}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="Ej. F o PUP"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="series-year">Año</Label>
              <Input
                id="series-year"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Usarla por defecto (facturación mensual y facturas nuevas)
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
