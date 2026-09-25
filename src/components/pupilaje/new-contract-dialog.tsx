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
import { Storefront, Plus } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Checkbox } from "@/components/ui/checkbox";

export function NewContractDialog({ tenantSlug, horses, clients }: { tenantSlug: string, horses: any[], clients: any[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  
  const [horseId, setHorseId] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthlyFee, setMonthlyFee] = useState("350");
  
  const [includes, setIncludes] = useState({
    pienso: true,
    forraje: true,
    limpieza: true,
    monta: false,
    herraje: false,
    veterinario: false
  });

  const createContract = trpc.boarding.create.useMutation({
    onSuccess: () => {
      toast.success("Contrato de pupilaje creado");
      setOpen(false);
      router.refresh();
      // Reset
      setHorseId("");
      setClientId("");
      setMonthlyFee("350");
    },
    onError: (err) => {
      toast.error(err.message || "Error al crear el contrato");
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId || !clientId) {
      toast.error("Debes seleccionar un caballo y un cliente");
      return;
    }
    
    const selectedIncludes = Object.entries(includes)
      .filter(([_, isIncluded]) => isIncluded)
      .map(([key]) => key);

    createContract.mutate({
      horseId,
      clientId,
      startDate: new Date(startDate),
      monthlyFee: parseFloat(monthlyFee),
      includes: selectedIncludes
    });
  };

  return (
    <>
      <Button className="rounded-full shadow-sm bg-orange-600 hover:bg-orange-700 text-white border-none" onClick={() => setOpen(true)}>
        <Plus weight="bold" className="mr-2 h-4 w-4" />
        Nuevo Pupilaje
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white rounded-3xl">
        <div className="h-2 bg-gradient-to-r from-orange-400 to-amber-400 w-full" />
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <Storefront className="h-6 w-6 text-orange-500" />
              Nuevo Contrato de Pupilaje
            </DialogTitle>
            <DialogDescription>
              Asocia un caballo a un cliente y establece la cuota mensual base.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente (Propietario)</Label>
                <Select value={clientId} onValueChange={(val) => setClientId(val || "")} disabled={clients.length === 0}>
                  <SelectTrigger className="rounded-xl border-border/50 bg-muted/20">
                    <SelectValue placeholder={clients.length === 0 ? "No hay clientes" : "Selecciona un cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha de Inicio</Label>
                <Input 
                  type="date" 
                  required 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border-border/50 bg-muted/20" 
                />
              </div>
              <div className="space-y-2">
                <Label>Cuota Mensual Base (€)</Label>
                <Input 
                  type="number"
                  step="0.01" 
                  required 
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                  className="rounded-xl border-border/50 bg-muted/20 text-orange-700 font-bold font-mono" 
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label>Servicios Incluidos</Label>
              <div className="grid grid-cols-3 gap-3">
                {Object.keys(includes).map((key) => (
                  <div key={key} className="flex items-center space-x-2 bg-muted/30 p-2.5 rounded-lg border border-border/30">
                    <Checkbox 
                      id={`include-${key}`} 
                      checked={includes[key as keyof typeof includes]}
                      onCheckedChange={(checked) => 
                        setIncludes({...includes, [key]: checked === true})
                      }
                    />
                    <label 
                      htmlFor={`include-${key}`} 
                      className="text-xs font-medium leading-none cursor-pointer capitalize text-muted-foreground"
                    >
                      {key}
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
          
          <div className="p-6 pt-4 bg-muted/10 border-t border-border/40 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button type="submit" disabled={!horseId || !clientId || createContract.isPending} className="rounded-full shadow-sm bg-orange-600 hover:bg-orange-700">
              {createContract.isPending ? "Creando..." : "Crear Pupilaje"}
            </Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  );
}

