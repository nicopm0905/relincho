"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Heartbeat, Plus, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import { toast } from "sonner"
// import { trpc } from "@/lib/trpc/react" // Assuming tRPC client exists for actual mutation

const SELECT_TRANSLATIONS: Record<string, string> = {
  MALE: "Macho", FEMALE: "Hembra", UNKNOWN: "Desconocido", GELDING: "Macho (Castrado)",
  ACTIVE: "Activo", INACTIVE: "Inactivo", SOLD: "Vendido", DECEASED: "Fallecido",
  POSITIVE: "Positiva", NEGATIVE: "Negativa", TWINS: "Gemelos", REABSORBED: "Reabsorbida", ABORTION: "Aborto",
  NATURAL: "Monta Natural", AI_FRESH: "IA Fresco", AI_CHILLED: "IA Refrigerado", AI_FROZEN: "IA Congelado",
  DEWORMING: "Desparasitación", VACCINATION: "Vacunación", DENTISTRY: "Odontología", FARRIER: "Herrador", VET_CHECK: "Revisión Veterinaria", TREATMENT: "Tratamiento Médico", OTHER: "Otro"
};

export function MassHealthDialog({ horses, tenantSlug }: { horses: any[], tenantSlug: string }) {
  const [open, setOpen] = useState(false)
  const [selectedHorses, setSelectedHorses] = useState<string[]>([])
  
  const toggleHorse = (id: string) => {
    setSelectedHorses(prev => 
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    )
  }

  const selectAll = () => setSelectedHorses(horses.map(h => h.id))
  const clearAll = () => setSelectedHorses([])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedHorses.length === 0) {
      toast.error("Debes seleccionar al menos un caballo")
      return
    }
    
    // Simulating API call
    toast.success(`Se ha registrado el tratamiento para ${selectedHorses.length} caballos`)
    setOpen(false)
    setSelectedHorses([])
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/90" />}>
        <Heartbeat weight="bold" className="mr-2 h-4 w-4" />
        Tratamiento Múltiple
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white rounded-3xl">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <Heartbeat weight="duotone" className="h-6 w-6 text-rose-500" />
              Nuevo Tratamiento Masivo
            </DialogTitle>
            <DialogDescription>
              Aplica una vacuna, desparasitación o revisión a varios caballos a la vez.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            
            {/* Cabecera del form */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Evento</Label>
                <Select defaultValue="DEWORMING">
                  <SelectTrigger id="type" className="rounded-xl border-border/50 bg-muted/20">
                    <SelectValue placeholder="Selecciona el tipo">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VACCINE">Vacuna</SelectItem>
                    <SelectItem value="DEWORMING">Desparasitación</SelectItem>
                    <SelectItem value="FARRIER">Herrador</SelectItem>
                    <SelectItem value="DENTAL">Odontología</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input type="date" id="date" required className="rounded-xl border-border/50 bg-muted/20" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Producto / Descripción</Label>
              <Input id="name" required placeholder="Ej. Eqvalan Duo" className="rounded-xl border-border/50 bg-muted/20" />
            </div>

            {/* Selección de caballos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground font-bold">Caballos Seleccionados ({selectedHorses.length}/{horses.length})</Label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAll} className="text-xs font-semibold text-primary hover:underline">Todos</button>
                  <span className="text-muted-foreground/30">•</span>
                  <button type="button" onClick={clearAll} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">Ninguno</button>
                </div>
              </div>
              
              <div className="border border-border/40 rounded-2xl overflow-hidden bg-muted/10">
                <div className="max-h-[200px] overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-2 custom-scrollbar">
                  {horses.length === 0 && (
                    <div className="col-span-full py-4 text-center text-sm text-muted-foreground">
                      No hay caballos registrados
                    </div>
                  )}
                  {horses.map((horse) => {
                    const isSelected = selectedHorses.includes(horse.id)
                    return (
                      <div 
                        key={horse.id}
                        onClick={() => toggleHorse(horse.id)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
                          isSelected 
                            ? 'bg-primary/5 border-primary/30 shadow-sm' 
                            : 'bg-white border-transparent hover:border-border/60 hover:bg-white shadow-sm'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            <span className="font-bold text-xs">{horse.name.charAt(0)}</span>
                          </div>
                          <span className={`font-semibold text-sm truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                            {horse.name}
                          </span>
                        </div>
                        {isSelected && (
                          <CheckCircle weight="fill" className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              {selectedHorses.length === 0 && (
                 <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
                   <WarningCircle weight="fill" className="h-4 w-4" />
                   Selecciona los caballos a los que aplicar el tratamiento
                 </div>
              )}
            </div>
            
          </div>
          
          <div className="p-6 pt-4 bg-muted/10 border-t border-border/40 flex items-center justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button type="submit" disabled={selectedHorses.length === 0} className="rounded-full shadow-sm">
              <Heartbeat weight="bold" className="mr-2 h-4 w-4" />
              Registrar para {selectedHorses.length} caballos
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
