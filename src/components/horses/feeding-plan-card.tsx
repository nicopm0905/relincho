"use client"

import { useState } from "react"
import { trpc } from "@/lib/trpc/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { ForkKnife, PencilSimple, Plus, Trash, Clock, Check } from "@phosphor-icons/react"
import { toast } from "sonner"

interface FeedingItem {
  meal: string
  food: string
  quantity: string
}

export function FeedingPlanCard({ horseId, horseName }: { horseId: string, horseName: string }) {
  const [open, setOpen] = useState(false)
  const utils = trpc.useUtils()

  const { data: plan, isLoading } = trpc.feeding.getByHorseId.useQuery({ horseId })

  const upsertMutation = trpc.feeding.upsertPlan.useMutation({
    onSuccess: () => {
      toast.success("Plan de alimentación guardado correctamente")
      utils.feeding.getByHorseId.invalidate({ horseId })
      utils.horses.byId.invalidate({ id: horseId })
      setOpen(false)
    },
    onError: (err) => {
      toast.error("Error al guardar la dieta: " + err.message)
    }
  })

  // State for form items
  const [items, setItems] = useState<FeedingItem[]>([])

  const handleOpenDialog = () => {
    if (plan && Array.isArray(plan.items) && plan.items.length > 0) {
      setItems(plan.items as unknown as FeedingItem[])
    } else {
      setItems([
        { meal: "MAÑANA", food: "Pienso Alta Energía", quantity: "2 kg" },
        { meal: "TARDE", food: "Heno de Alfalfa", quantity: "4 kg" }
      ])
    }
    setOpen(true)
  }

  const handleAddItem = () => {
    setItems([...items, { meal: "MAÑANA", food: "", quantity: "" }])
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof FeedingItem, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }

  const handleSave = () => {
    const validItems = items.filter(i => i.food.trim() && i.quantity.trim())
    upsertMutation.mutate({
      horseId,
      items: validItems
    })
  }

  const rawItems = (plan?.items as unknown as FeedingItem[]) || []

  return (
    <Card className="p-5">
      <CardHeader className="p-0 mb-5 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div>
            <CardTitle className="text-[15px] font-semibold text-foreground">Plan de alimentación</CardTitle>
            <CardDescription className="mt-0.5 text-[13px] text-muted-foreground">Dieta diaria y raciones para {horseName}</CardDescription>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          {/* `render`: el disparador ya es un boton; un <Button> dentro era un
              boton anidado y rompia la hidratacion de la ficha. */}
          <DialogTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDialog}
                className="gap-1.5 text-xs font-semibold rounded-lg shadow-xs"
              />
            }
          >
            <PencilSimple weight="bold" className="h-3.5 w-3.5" />
            {rawItems.length > 0 ? "Editar Dieta" : "Configurar Dieta"}
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg p-6">
            <DialogHeader className="pr-8">
              <DialogTitle className="flex items-center gap-2 text-lg font-bold font-heading">
                <ForkKnife weight="bold" className="h-5 w-5 text-amber-600" />
                Configurar Plan de Alimentación
              </DialogTitle>
              <CardDescription className="text-xs">
                Asigna las raciones de comida según las franjas horarias del día para {horseName}.
              </CardDescription>
            </DialogHeader>

            <div className="space-y-3 my-3 max-h-[360px] overflow-y-auto pr-1">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-1 mb-1">
                <div className="col-span-4">Momento</div>
                <div className="col-span-5">Alimento / Pienso</div>
                <div className="col-span-3">Cantidad</div>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-muted/30 p-2.5 rounded-xl border border-border/50">
                  <div className="col-span-4">
                    <select
                      value={item.meal}
                      onChange={(e) => handleItemChange(idx, "meal", e.target.value)}
                      className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="MAÑANA">Mañana</option>
                      <option value="MEDIODIA">Mediodía</option>
                      <option value="TARDE">Tarde</option>
                      <option value="NOCHE">Noche</option>
                    </select>
                  </div>

                  <div className="col-span-5">
                    <Input
                      placeholder="Ej. Pienso, Heno"
                      value={item.food}
                      onChange={(e) => handleItemChange(idx, "food", e.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                  </div>

                  <div className="col-span-3 flex items-center gap-1">
                    <Input
                      placeholder="Ej. 2 kg"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                      className="h-9 text-xs rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(idx)}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <Trash weight="bold" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                className="w-full gap-2 text-xs font-semibold mt-2 border-dashed h-9 rounded-xl text-muted-foreground hover:text-foreground"
              >
                <Plus weight="bold" className="h-3.5 w-3.5" />
                Añadir Ración
              </Button>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-lg text-xs">
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={upsertMutation.isPending} className="rounded-lg text-xs gap-1.5 font-semibold">
                {upsertMutation.isPending ? (
                  "Guardando..."
                ) : (
                  <>
                    <Check weight="bold" className="h-3.5 w-3.5" />
                    Guardar Plan
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="text-xs text-muted-foreground italic py-4 text-center">Cargando dieta...</div>
        ) : rawItems.length === 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 p-4 rounded-xl text-xs flex items-center justify-between">
            <span>No hay un plan de alimentación configurado para este caballo.</span>
            <Button size="sm" variant="outline" onClick={handleOpenDialog} className="h-7 text-xs bg-white dark:bg-zinc-800 font-semibold">
              Configurar Ahora
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {["MAÑANA", "MEDIODIA", "TARDE", "NOCHE"].map((mealName) => {
              const mealItems = rawItems.filter(i => i.meal === mealName)
              if (mealItems.length === 0) return null
              return (
                <div key={mealName} className="bg-muted/30 rounded-xl p-3.5 border border-border/50 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <Clock weight="bold" className="h-3.5 w-3.5 text-amber-600" />
                    {mealName === "MAÑANA" ? "Mañana" : mealName === "MEDIODIA" ? "Mediodía" : mealName === "TARDE" ? "Tarde" : "Noche"}
                  </div>
                  <div className="space-y-2">
                    {mealItems.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-xs bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-border/40 shadow-2xs">
                        <span className="font-semibold text-foreground">{item.food}</span>
                        <span className="font-bold text-amber-800 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md text-[11px] border border-amber-500/20">
                          {item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
