"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";

type Option = { id: string; name: string };
type SeriesOption = { id: string; code: string; prefix: string; year: number; isDefault: boolean };

interface LineDraft {
  description: string;
  quantity: string;
  unitPrice: string;
  vatRate: string;
  horseId: string;
}

function emptyLine(): LineDraft {
  return { description: "", quantity: "1", unitPrice: "0", vatRate: "21", horseId: "" };
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function NewInvoiceEditor({
  tenantSlug,
  clients,
  horses,
  series,
}: {
  tenantSlug: string;
  clients: Option[];
  horses: Option[];
  series: SeriesOption[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];

  const [clientId, setClientId] = useState("");
  const [seriesId, setSeriesId] = useState(
    series.find((s) => s.isDefault)?.id ?? series[0]?.id ?? "",
  );
  const [issueDate, setIssueDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDaysISO(today, 30));
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const create = trpc.invoices.create.useMutation({
    onSuccess: (inv) => {
      toast.success("Factura creada en borrador");
      router.push(`/${tenantSlug}/facturacion/${inv.id}`);
      router.refresh();
    },
    onError: (err) => toast.error(err.message || "No se pudo crear la factura"),
  });

  const totals = useMemo(() => {
    let subtotal = 0;
    let vat = 0;
    for (const l of lines) {
      const base = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
      subtotal += base;
      vat += base * ((parseFloat(l.vatRate) || 0) / 100);
    }
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      vat: Math.round(vat * 100) / 100,
      total: Math.round((subtotal + vat) * 100) / 100,
    };
  }, [lines]);

  function updateLine(idx: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return toast.error("Selecciona un cliente");
    if (!seriesId) return toast.error("Selecciona una serie");
    const cleanLines = lines
      .filter((l) => l.description.trim())
      .map((l) => ({
        description: l.description.trim(),
        quantity: parseFloat(l.quantity) || 0,
        unitPrice: parseFloat(l.unitPrice) || 0,
        vatRate: parseFloat(l.vatRate) || 0,
        horseId: l.horseId || undefined,
      }));
    if (cleanLines.length === 0) return toast.error("Añade al menos una línea");
    if (cleanLines.some((l) => l.quantity <= 0))
      return toast.error("Las cantidades deben ser mayores que 0");

    create.mutate({
      clientId,
      seriesId,
      issueDate: new Date(issueDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      lines: cleanLines,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cliente</Label>
          <Select value={clientId} onValueChange={(v) => setClientId(v || "")}>
            <SelectTrigger className="rounded-xl bg-muted/20">
              <SelectValue placeholder={clients.length === 0 ? "No hay clientes" : "Selecciona un cliente"} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Serie</Label>
          <Select value={seriesId} onValueChange={(v) => setSeriesId(v || "")}>
            <SelectTrigger className="rounded-xl bg-muted/20">
              <SelectValue placeholder={series.length === 0 ? "Crea una serie en Ajustes" : "Selecciona una serie"} />
            </SelectTrigger>
            <SelectContent>
              {series.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.prefix}{s.year}{s.isDefault ? " (por defecto)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fecha de emisión</Label>
          <Input
            type="date"
            value={issueDate}
            onChange={(e) => {
              setIssueDate(e.target.value);
              setDueDate(addDaysISO(e.target.value, 30));
            }}
            className="rounded-xl bg-muted/20"
          />
        </div>
        <div className="space-y-2">
          <Label>Fecha de vencimiento</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-xl bg-muted/20"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Líneas</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setLines((p) => [...p, emptyLine()])}
            className="rounded-full"
          >
            <Plus weight="bold" className="mr-1 h-4 w-4" /> Añadir línea
          </Button>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const lineTotal =
              (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-end rounded-xl border border-border/40 bg-muted/10 p-3"
              >
                <div className="col-span-12 sm:col-span-4 space-y-1">
                  <Label className="text-xs text-muted-foreground">Descripción</Label>
                  <Input
                    value={line.description}
                    onChange={(e) => updateLine(idx, { description: e.target.value })}
                    className="rounded-lg bg-white"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">Cant.</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                    className="rounded-lg bg-white font-mono"
                  />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Precio U. (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                    className="rounded-lg bg-white font-mono"
                  />
                </div>
                <div className="col-span-4 sm:col-span-1 space-y-1">
                  <Label className="text-xs text-muted-foreground">IVA %</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={line.vatRate}
                    onChange={(e) => updateLine(idx, { vatRate: e.target.value })}
                    className="rounded-lg bg-white font-mono"
                  />
                </div>
                <div className="col-span-8 sm:col-span-2 space-y-1">
                  <Label className="text-xs text-muted-foreground">Caballo (opc.)</Label>
                  <Select
                    value={line.horseId}
                    onValueChange={(v) => updateLine(idx, { horseId: v || "" })}
                  >
                    <SelectTrigger className="rounded-lg bg-white">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {horses.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 sm:col-span-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold">
                    {lineTotal.toFixed(2)} €
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setLines((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p))
                    }
                    className="text-rose-600 hover:bg-rose-50 shrink-0"
                  >
                    <Trash weight="bold" className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 border-t border-border/40 pt-4 text-sm">
        <div className="flex w-56 justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{totals.subtotal.toFixed(2)} €</span>
        </div>
        <div className="flex w-56 justify-between">
          <span className="text-muted-foreground">IVA</span>
          <span className="font-mono">{totals.vat.toFixed(2)} €</span>
        </div>
        <div className="flex w-56 justify-between text-base font-bold">
          <span>Total</span>
          <span className="font-mono">{totals.total.toFixed(2)} €</span>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="submit"
          disabled={create.isPending}
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {create.isPending ? "Creando..." : "Crear borrador"}
        </Button>
      </div>
    </form>
  );
}
