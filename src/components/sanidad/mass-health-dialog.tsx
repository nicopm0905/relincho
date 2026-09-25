"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Heartbeat, CheckCircle, WarningCircle } from "@phosphor-icons/react"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc/react"

type MassType = "VACCINE" | "DEWORMING" | "FARRIER" | "DENTAL" | "VET_CHECKUP" | "TREATMENT"

const TYPE_LABELS: Record<MassType, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  FARRIER: "Herrador",
  DENTAL: "Odontología",
  VET_CHECKUP: "Revisión veterinaria",
  TREATMENT: "Tratamiento",
}

/**
 * Intervalo habitual hasta la siguiente dosis, en dias. Es solo una sugerencia
 * para rellenar la proxima fecha (que es lo que dispara el recordatorio); el
 * veterinario puede cambiarla. `null`: sin repeticion por defecto.
 */
const DEFAULT_INTERVAL_DAYS: Record<MassType, number | null> = {
  VACCINE: 182,
  DEWORMING: 90,
  FARRIER: 49,
  DENTAL: 365,
  VET_CHECKUP: null,
  TREATMENT: null,
}

function toDateInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function suggestNextDate(type: MassType, from: string) {
  const days = DEFAULT_INTERVAL_DAYS[type]
  if (!days || !from) return ""
  const next = new Date(`${from}T12:00:00`)
  next.setDate(next.getDate() + days)
  return toDateInput(next)
}

export function MassHealthDialog({
  horses,
}: {
  horses: { id: string; name: string }[]
  tenantSlug: string
}) {
  const router = useRouter()
  const today = toDateInput(new Date())
  const [open, setOpen] = useState(false)
  const [selectedHorses, setSelectedHorses] = useState<string[]>([])
  const [type, setType] = useState<MassType>("DEWORMING")
  const [date, setDate] = useState(today)
  const [nextDueDate, setNextDueDate] = useState(() => suggestNextDate("DEWORMING", today))
  const [name, setName] = useState("")
  const [dose, setDose] = useState("")

  const reset = () => {
    setSelectedHorses([])
    setType("DEWORMING")
    setDate(today)
    setNextDueDate(suggestNextDate("DEWORMING", today))
    setName("")
    setDose("")
  }

  const createMany = trpc.health.createMany.useMutation({
    onSuccess: ({ count }) => {
      toast.success(`Tratamiento registrado para ${count} caballo${count === 1 ? "" : "s"}`)
      setOpen(false)
      reset()
      router.refresh()
    },
    onError: (err) => toast.error(err.message || "No se ha podido guardar"),
  })

  const toggleHorse = (id: string) => {
    setSelectedHorses((prev) =>
      prev.includes(id) ? prev.filter((h) => h !== id) : [...prev, id],
    )
  }

  const selectAll = () => setSelectedHorses(horses.map((h) => h.id))
  const clearAll = () => setSelectedHorses([])

  // Cambiar tipo o fecha recalcula la sugerencia; editarla a mano la respeta
  // hasta el siguiente cambio de tipo o fecha.
  const changeType = (value: MassType) => {
    setType(value)
    setNextDueDate(suggestNextDate(value, date))
  }
  const changeDate = (value: string) => {
    setDate(value)
    setNextDueDate(suggestNextDate(type, value))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedHorses.length === 0) {
      toast.error("Debes seleccionar al menos un caballo")
      return
    }
    createMany.mutate({
      horseIds: selectedHorses,
      type,
      name: name.trim(),
      date: new Date(`${date}T12:00:00`),
      nextDueDate: nextDueDate ? new Date(`${nextDueDate}T12:00:00`) : undefined,
      dose: dose.trim() || undefined,
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) reset()
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="lg" className="shadow-sm" />}>
        <Heartbeat weight="bold" className="mr-2 h-4 w-4" />
        Tratamiento Múltiple
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-white rounded-3xl">
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold font-heading text-foreground flex items-center gap-2">
              <Heartbeat className="h-6 w-6 text-rose-500" />
              Nuevo Tratamiento Masivo
            </DialogTitle>
            <DialogDescription>
              Aplica una vacuna, desparasitación o revisión a varios caballos a la vez.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mass-type">Tipo de Evento</Label>
                <Select value={type} onValueChange={(value) => changeType(value as MassType)}>
                  <SelectTrigger id="mass-type" className="rounded-xl border-border/50 bg-muted/20">
                    <SelectValue placeholder="Selecciona el tipo">
                      {(val: string) => TYPE_LABELS[val as MassType] ?? val}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as MassType[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {TYPE_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mass-date">Fecha</Label>
                <Input
                  type="date"
                  id="mass-date"
                  required
                  value={date}
                  onChange={(e) => changeDate(e.target.value)}
                  className="rounded-xl border-border/50 bg-muted/20"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mass-name">Producto / Descripción</Label>
                <Input
                  id="mass-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Eqvalan Duo"
                  className="rounded-xl border-border/50 bg-muted/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mass-dose">Dosis (opcional)</Label>
                <Input
                  id="mass-dose"
                  value={dose}
                  onChange={(e) => setDose(e.target.value)}
                  placeholder="Ej. 1 jeringa"
                  className="rounded-xl border-border/50 bg-muted/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mass-next">Próxima dosis</Label>
              <Input
                type="date"
                id="mass-next"
                value={nextDueDate}
                min={date}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="rounded-xl border-border/50 bg-muted/20"
              />
              <p className="text-xs text-muted-foreground">
                Se avisará antes de esta fecha. Déjala vacía si no se repite.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-foreground font-bold">
                  Caballos Seleccionados ({selectedHorses.length}/{horses.length})
                </Label>
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
                      <button
                        type="button"
                        key={horse.id}
                        onClick={() => toggleHorse(horse.id)}
                        aria-pressed={isSelected}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-left transition-all duration-200 border ${
                          isSelected
                            ? "bg-primary/5 border-primary/30 shadow-sm"
                            : "bg-white border-transparent hover:border-border/60 hover:bg-white shadow-sm"
                        }`}
                      >
                        <span className="flex items-center gap-2.5 min-w-0">
                          <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            <span className="font-bold text-xs">{horse.name.charAt(0)}</span>
                          </span>
                          <span className={`font-semibold text-sm truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                            {horse.name}
                          </span>
                        </span>
                        {isSelected && (
                          <CheckCircle weight="fill" className="h-5 w-5 text-primary shrink-0" />
                        )}
                      </button>
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
            <Button
              type="submit"
              disabled={selectedHorses.length === 0 || createMany.isPending}
              className="rounded-full shadow-sm"
            >
              <Heartbeat weight="bold" className="mr-2 h-4 w-4" />
              {createMany.isPending
                ? "Guardando…"
                : `Registrar para ${selectedHorses.length} caballos`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
