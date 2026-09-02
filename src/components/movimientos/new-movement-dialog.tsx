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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Path, ArrowRight, ArrowLeft } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";

export function NewMovementDialog({ tenantSlug, horses }: { tenantSlug: string, horses: any[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [horseId, setHorseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rega, setRega] = useState("");
  const [reason, setReason] = useState("");

  const createMovement = trpc.movements.create.useMutation({
    onSuccess: () => {
      toast.success(direction === "IN" ? "Alta registrada" : "Baja registrada");
      setOpen(false);
      router.refresh();
      // Reset
      setHorseId("");
      setRega("");
      setReason("");
    },
    onError: (err) => {
      toast.error(err.message || "Error al registrar movimiento");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) {
      toast.error("Debes seleccionar un caballo");
      return;
    }
    
    createMovement.mutate({
      horseId,
      direction,
      date: new Date(date),
      originRega: direction === "IN" ? rega : undefined,
      destinationRega: direction === "OUT" ? rega : undefined,
      reason
    });
  };

  return (
    <>
      <Button className="rounded-full shadow-sm" onClick={() => setOpen(true)}>
        <Path weight="bold" className="mr-2 h-4 w-4" />
        Registrar Movimiento
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-white rounded-3xl">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <Path weight="duotone" className="h-6 w-6 text-primary" />
              Nuevo Movimiento
            </DialogTitle>
            <DialogDescription>
              Registra una entrada (alta) o salida (baja) en tu libro de explotación.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            
            {/* Tipo de Movimiento (Tabs visuales) */}
            <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setDirection("IN")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "IN" 
                    ? "bg-white text-emerald-600 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowRight weight="bold" /> Alta (Entrada)
              </button>
              <button
                type="button"
                onClick={() => setDirection("OUT")}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  direction === "OUT" 
                    ? "bg-white text-rose-600 shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ArrowLeft weight="bold" /> Baja (Salida)
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Caballo</Label>
                <Select value={horseId} onValueChange={(val) => setHorseId(val || "")} disabled={horses.length === 0}>
                  <SelectTrigger className="rounded-xl border-border/50 bg-muted/20">
                    <SelectValue placeholder={horses.length === 0 ? "No hay caballos" : "Selecciona el caballo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {horses.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Input 
                    type="date" 
                    required 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl border-border/50 bg-muted/20" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>{direction === "IN" ? "Código REGA Origen" : "Código REGA Destino"}</Label>
                  <Input 
                    placeholder="Ej. ES123456789012" 
                    value={rega}
                    onChange={(e) => setRega(e.target.value)}
                    className="rounded-xl border-border/50 bg-muted/20" 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motivo / Observaciones</Label>
                <Input 
                  placeholder={direction === "IN" ? "Ej. Compra, Nacimiento..." : "Ej. Venta, Defunción..."} 
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="rounded-xl border-border/50 bg-muted/20" 
                />
              </div>
            </div>
            
          </div>
          
          <div className="p-6 pt-4 bg-muted/10 border-t border-border/40 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button type="submit" disabled={!horseId || createMovement.isPending} className="rounded-full shadow-sm">
              {createMovement.isPending ? "Guardando..." : "Guardar Registro"}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}

