"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowCounterClockwise, PaperPlaneTilt, Plus, Prohibit, Trash, X } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Line = { description: string; quantity: string; unitPrice: string; vatRate: string };

const MODES = {
  cancel: "Anular el importe entero",
  diff: "Corregir por diferencias",
  replace: "Sustituir por la factura correcta",
} as const;
type Mode = keyof typeof MODES;

const CODES = {
  R4: "R4 · Error u otra causa (lo habitual)",
  R1: "R1 · Error fundado en derecho / devolución (art. 80 LIVA)",
  R2: "R2 · Concurso de acreedores",
  R3: "R3 · Crédito incobrable",
} as const;
type Code = keyof typeof CODES;

function useMutationHandlers() {
  const router = useRouter();
  return {
    router,
    onError: (err: { message: string; data?: { code?: string } | null }) =>
      toast.error(err.data?.code === "FORBIDDEN" ? "Solo el propietario o el encargado" : err.message),
  };
}

export function InvoiceActions({
  tenantSlug,
  invoice,
}: {
  tenantSlug: string;
  invoice: {
    id: string;
    status: string;
    hasNumber: boolean;
    isRectification: boolean;
    hasPayments: boolean;
    lines: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
  };
}) {
  const { router, onError } = useMutationHandlers();
  const [confirm, setConfirm] = useState<"issue" | "delete" | "void" | null>(null);
  const [rectifying, setRectifying] = useState(false);

  const issue = trpc.invoices.issue.useMutation({
    onSuccess: () => {
      toast.success("Factura emitida y registrada");
      setConfirm(null);
      router.refresh();
    },
    onError,
  });
  const remove = trpc.invoices.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("Borrador eliminado");
      router.push(`/${tenantSlug}/facturacion`);
      router.refresh();
    },
    onError,
  });
  const voidIt = trpc.invoices.void.useMutation({
    onSuccess: () => {
      toast.success("Factura anulada");
      setConfirm(null);
      router.refresh();
    },
    onError,
  });

  const draft = invoice.status === "DRAFT";
  const issued = ["ISSUED", "PAID", "OVERDUE"].includes(invoice.status);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {draft && (
        <>
          <Button onClick={() => setConfirm("issue")}>
            <PaperPlaneTilt weight="bold" />
            Emitir
          </Button>
          {!invoice.hasNumber && (
            <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm("delete")}>
              <Trash weight="bold" />
              Borrar borrador
            </Button>
          )}
        </>
      )}
      {issued && !invoice.isRectification && (
        <Button variant="outline" onClick={() => setRectifying(true)}>
          <ArrowCounterClockwise weight="bold" />
          Rectificar
        </Button>
      )}
      {issued && !invoice.hasPayments && (
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm("void")}>
          <Prohibit weight="bold" />
          Anular
        </Button>
      )}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {confirm === "issue" ? "¿Emitir la factura?" : confirm === "delete" ? "¿Borrar el borrador?" : "¿Anular la factura?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "issue"
                ? "Se le asigna número y fecha de hoy, y se genera su registro Veri*Factu con el QR. Después ya no se puede modificar: solo rectificar."
                : confirm === "delete"
                  ? "El borrador no tiene número, así que no deja hueco en la serie."
                  : "Es para una factura emitida por error (duplicada, a quien no era). Se genera un registro de anulación. Para corregir importes, usa «Rectificar»."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            {confirm === "issue" && (
              <Button disabled={issue.isPending} onClick={() => issue.mutate({ id: invoice.id })}>
                {issue.isPending ? "Emitiendo…" : "Emitir factura"}
              </Button>
            )}
            {confirm === "delete" && (
              <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate({ id: invoice.id })}>
                Borrar
              </Button>
            )}
            {confirm === "void" && (
              <Button variant="destructive" disabled={voidIt.isPending} onClick={() => voidIt.mutate({ id: invoice.id })}>
                {voidIt.isPending ? "Anulando…" : "Anular factura"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {rectifying && (
        <RectifyDialog
          tenantSlug={tenantSlug}
          invoiceId={invoice.id}
          originalLines={invoice.lines}
          onClose={() => setRectifying(false)}
        />
      )}
    </div>
  );
}

function RectifyDialog({
  tenantSlug,
  invoiceId,
  originalLines,
  onClose,
}: {
  tenantSlug: string;
  invoiceId: string;
  originalLines: { description: string; quantity: number; unitPrice: number; vatRate: number }[];
  onClose: () => void;
}) {
  const { router, onError } = useMutationHandlers();
  const [mode, setMode] = useState<Mode>("cancel");
  const [code, setCode] = useState<Code>("R4");
  const [reason, setReason] = useState("");
  const toLines = (sign: 1 | -1) =>
    originalLines.map((l) => ({
      description: l.description,
      quantity: String(l.quantity),
      unitPrice: String(sign * l.unitPrice),
      vatRate: String(l.vatRate),
    }));
  const [lines, setLines] = useState<Line[]>(toLines(1));

  const rectify = trpc.invoices.rectify.useMutation({
    onSuccess: (created) => {
      toast.success("Rectificativa creada en borrador: revísala y emítela");
      router.push(`/${tenantSlug}/facturacion/${created.id}`);
      router.refresh();
    },
    onError,
  });

  const changeMode = (next: Mode) => {
    setMode(next);
    // Por diferencias se parte de cero lineas; por sustitucion, de la factura actual.
    setLines(next === "replace" ? toLines(1) : [{ description: "", quantity: "1", unitPrice: "", vatRate: "21" }]);
  };
  const updateLine = (index: number, field: keyof Line, value: string) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    rectify.mutate({
      invoiceId,
      code,
      reason,
      kind: mode === "replace" ? "S" : "I",
      cancelAll: mode === "cancel",
      lines:
        mode === "cancel"
          ? undefined
          : lines.map((l) => ({
              description: l.description.trim(),
              quantity: Number(l.quantity),
              unitPrice: Number(l.unitPrice),
              vatRate: Number(l.vatRate),
            })),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>Rectificar factura</DialogTitle>
          <DialogDescription>
            La factura original no se toca: se emite una rectificativa en su propia serie que la corrige.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rect-mode">Qué hay que hacer</Label>
              <Select value={mode} onValueChange={(v) => changeMode(v as Mode)}>
                <SelectTrigger id="rect-mode">
                  <SelectValue>{(v: string) => MODES[v as Mode]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODES) as Mode[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {MODES[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rect-code">Causa</Label>
              <Select value={code} onValueChange={(v) => setCode(v as Code)}>
                <SelectTrigger id="rect-code">
                  <SelectValue>{(v: string) => CODES[v as Code]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CODES) as Code[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {CODES[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rect-reason">Motivo (figura en la factura)</Label>
            <Textarea
              id="rect-reason"
              rows={2}
              required
              minLength={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Se facturó el pupilaje de septiembre dos veces"
            />
          </div>

          {mode === "cancel" ? (
            <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              Se crea una rectificativa con todas las líneas en negativo: el importe de la factura queda a cero.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {mode === "diff"
                  ? "Solo la diferencia: en negativo lo que se descuenta, en positivo lo que se añade."
                  : "La factura correcta completa: sustituye a la original."}
              </p>
              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_4rem_6rem_4rem_2rem] items-center gap-2">
                  <Input
                    aria-label="Descripción"
                    required
                    value={line.description}
                    onChange={(e) => updateLine(index, "description", e.target.value)}
                    placeholder="Concepto"
                  />
                  <Input
                    aria-label="Cantidad"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={line.quantity}
                    onChange={(e) => updateLine(index, "quantity", e.target.value)}
                  />
                  <Input
                    aria-label="Precio unitario"
                    type="number"
                    step="0.01"
                    required
                    value={line.unitPrice}
                    onChange={(e) => updateLine(index, "unitPrice", e.target.value)}
                    placeholder="Precio"
                  />
                  <Input
                    aria-label="IVA %"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={line.vatRate}
                    onChange={(e) => updateLine(index, "vatRate", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Quitar línea"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <X weight="bold" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { description: "", quantity: "1", unitPrice: "", vatRate: "21" }])}
              >
                <Plus weight="bold" />
                Añadir línea
              </Button>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={rectify.isPending}>
              {rectify.isPending ? "Creando…" : "Crear rectificativa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
