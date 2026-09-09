"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";

const METHODS = [
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "DIRECT_DEBIT", label: "Domiciliación" },
  { value: "OTHER", label: "Otro" },
];

export function PaymentForm({
  invoiceId,
  balance,
}: {
  invoiceId: string;
  balance: number;
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const [amount, setAmount] = useState(balance > 0 ? balance.toFixed(2) : "0");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("TRANSFER");
  const [reference, setReference] = useState("");

  const addPayment = trpc.invoices.addPayment.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.fullyPaid ? "Pago registrado. Factura cobrada." : "Pago registrado.",
      );
      setReference("");
      router.refresh();
    },
    onError: (err) => toast.error(err.message || "No se pudo registrar el pago"),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return toast.error("Importe no válido");
    addPayment.mutate({
      invoiceId,
      amount: value,
      date: new Date(date),
      method,
      reference: reference.trim() || undefined,
    });
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Importe (€)</Label>
        <Input
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="rounded-lg bg-white font-mono"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Fecha</Label>
        <Input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg bg-white"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Método</Label>
        <Select value={method} onValueChange={(v) => setMethod(v || "TRANSFER")}>
          <SelectTrigger className="rounded-lg bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Referencia (opc.)</Label>
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          className="rounded-lg bg-white"
        />
      </div>
      <div className="sm:col-span-2 flex justify-end">
        <Button
          type="submit"
          disabled={addPayment.isPending}
          className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {addPayment.isPending ? "Registrando..." : "Registrar pago"}
        </Button>
      </div>
    </form>
  );
}
