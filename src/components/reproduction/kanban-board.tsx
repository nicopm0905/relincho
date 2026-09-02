"use client";

import { useState } from "react";
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Plus, CaretRight, Horse, Egg, CheckCircle, WarningCircle, Baby } from "@phosphor-icons/react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// --- Draggable Card Component ---
function KanbanCard({ cycle, tenantSlug }: { cycle: any, tenantSlug: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cycle.id,
    data: { type: "Card", cycle },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const latestCovering = cycle.coverings[0];
  const latestCheck = latestCovering?.pregnancyChecks[0];

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none cursor-grab active:cursor-grabbing pb-3">
      <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200">
        <CardContent className="p-4 space-y-3 pointer-events-none">
          <div className="flex justify-between items-start">
            <div className="font-bold text-base text-foreground tracking-tight">
              {cycle.mare.name}
            </div>
            <CaretRight weight="bold" className="h-4 w-4 text-muted-foreground" />
          </div>
          
          {latestCovering ? (
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Semental:</span>
                <span className="font-medium text-foreground">{latestCovering.stallion?.name || "—"}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Cubrición:</span>
                <span className="font-medium text-foreground">{format(new Date(latestCovering.date), "dd/MM/yyyy")}</span>
              </div>
              {latestCheck && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Últ. Eco:</span>
                  <span className="font-medium text-foreground">{format(new Date(latestCheck.date), "dd/MM/yyyy")}</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/60 italic">Sin cubriciones</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Droppable Column Component ---
import { useDroppable } from "@dnd-kit/core";

const SELECT_TRANSLATIONS: Record<string, string> = {
  MALE: "Macho", FEMALE: "Hembra", UNKNOWN: "Desconocido", GELDING: "Macho (Castrado)",
  ACTIVE: "Activo", INACTIVE: "Inactivo", SOLD: "Vendido", DECEASED: "Fallecido",
  POSITIVE: "Positiva", NEGATIVE: "Negativa", TWINS: "Gemelos", REABSORBED: "Reabsorbida", ABORTION: "Aborto",
  NATURAL: "Monta Natural", AI_FRESH: "IA Fresco", AI_CHILLED: "IA Refrigerado", AI_FROZEN: "IA Congelado",
  DEWORMING: "Desparasitación", VACCINATION: "Vacunación", DENTISTRY: "Odontología", FARRIER: "Herrador", VET_CHECK: "Revisión Veterinaria", TREATMENT: "Tratamiento Médico", OTHER: "Otro"
};

function KanbanColumn({ 
  id,
  title, 
  icon: Icon, 
  items, 
  colorClass, 
  bgClass,
  tenantSlug
}: { 
  id: string,
  title: string, 
  icon: any, 
  items: any[],
  colorClass: string,
  bgClass: string,
  tenantSlug: string
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: { type: "Column" },
  });

  return (
    <div className={`flex flex-col rounded-3xl ${bgClass} border border-border/40 p-4 min-h-[500px] transition-colors ${isOver ? 'ring-2 ring-primary/30 bg-background/50' : ''}`}>
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <Icon weight="duotone" className={`h-6 w-6 ${colorClass}`} />
          <h2 className="font-heading font-bold text-lg text-foreground">{title}</h2>
        </div>
        <Badge variant="secondary" className="font-mono bg-white shadow-sm">{items.length}</Badge>
      </div>

      <div ref={setNodeRef} className="flex-1">
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center p-6 text-muted-foreground/60 border-2 border-dashed border-border/60 rounded-2xl">
              <p className="text-sm font-medium">Ninguna yegua</p>
            </div>
          ) : (
            items.map((cycle) => (
              <KanbanCard key={cycle.id} cycle={cycle} tenantSlug={tenantSlug} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// --- Main Kanban Board Component ---

const pregnancyFormSchema = z.object({
  date: z.string().min(1, "Debes seleccionar una fecha"),
  result: z.string().min(1, "Debes seleccionar un resultado"),
  dayOfPregnancy: z.coerce.number().optional(),
});

const foalingFormSchema = z.object({
  date: z.string().min(1, "Debes seleccionar una fecha"),
  sex: z.enum(["MALE", "FEMALE", "UNKNOWN"]).optional(),
  alive: z.boolean().default(true),
  notes: z.string().optional(),
});

export function KanbanBoard({ 
  tenantSlug, 
  colVacias, 
  colPrenadas, 
  colParidas 
}: { 
  tenantSlug: string, 
  colVacias: any[], 
  colPrenadas: any[], 
  colParidas: any[] 
}) {
  const router = useRouter();
  
  // Dialog States
  const [pregnancyModal, setPregnancyModal] = useState<{ open: boolean, cycle: any | null }>({ open: false, cycle: null });
  const [foalingModal, setFoalingModal] = useState<{ open: boolean, cycle: any | null }>({ open: false, cycle: null });
  
  // DnD Setup
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const [activeCard, setActiveCard] = useState<any | null>(null);

  function onDragStart(event: any) {
    const { active } = event;
    if (active.data.current?.type === "Card") {
      setActiveCard(active.data.current.cycle);
    }
  }

  function onDragEnd(event: any) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const cycleId = active.id;
    const cycle = [...colVacias, ...colPrenadas, ...colParidas].find(c => c.id === cycleId);
    if (!cycle) return;

    const targetColumn = over.id; // 'vacias', 'prenadas', 'paridas'
    
    // Check current logical column
    let currentColumn = 'vacias';
    const latestCovering = cycle.coverings[0];
    const latestCheck = latestCovering?.pregnancyChecks[0];
    if (latestCovering?.foaling) {
      currentColumn = 'paridas';
    } else if (latestCheck?.result === "POSITIVE") {
      currentColumn = 'prenadas';
    }

    if (currentColumn === targetColumn) return;

    // Logic based on target column
    if (targetColumn === 'prenadas') {
      if (!latestCovering) {
        toast.error("La yegua no tiene ninguna cubrición. Añade una primero.");
        return;
      }
      setPregnancyModal({ open: true, cycle });
    } else if (targetColumn === 'paridas') {
      if (!latestCovering) {
        toast.error("La yegua no tiene ninguna cubrición registrada.");
        return;
      }
      setFoalingModal({ open: true, cycle });
    } else if (targetColumn === 'vacias') {
      toast.info("Para devolver a 'Vacías', edita la yegua y registra un control negativo o aborto.");
    }
  }

  // --- Pregnancy Form Setup ---
  const pregForm = useForm<z.infer<typeof pregnancyFormSchema>>({
    resolver: zodResolver(pregnancyFormSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      result: "POSITIVE",
    },
  });

  const addPregnancyCheck = trpc.reproduction.addPregnancyCheck.useMutation({
    onSuccess: () => {
      toast.success("Ecografía registrada correctamente");
      setPregnancyModal({ open: false, cycle: null });
      pregForm.reset();
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "Error al registrar la ecografía"),
  });

  function onPregnancySubmit(values: z.infer<typeof pregnancyFormSchema>) {
    if (!pregnancyModal.cycle?.coverings[0]?.id) return;
    addPregnancyCheck.mutate({
      coveringId: pregnancyModal.cycle.coverings[0].id,
      date: new Date(values.date),
      result: values.result,
      dayOfPregnancy: values.dayOfPregnancy,
    });
  }

  // --- Foaling Form Setup ---
  const foalForm = useForm<z.infer<typeof foalingFormSchema>>({
    resolver: zodResolver(foalingFormSchema),
    defaultValues: {
      date: format(new Date(), "yyyy-MM-dd"),
      alive: true,
      sex: "UNKNOWN",
    },
  });

  const addFoaling = trpc.reproduction.addFoaling.useMutation({
    onSuccess: () => {
      toast.success("Parto registrado correctamente");
      setFoalingModal({ open: false, cycle: null });
      foalForm.reset();
      router.refresh();
    },
    onError: (error) => toast.error(error.message || "Error al registrar el parto"),
  });

  function onFoalingSubmit(values: z.infer<typeof foalingFormSchema>) {
    if (!foalingModal.cycle?.coverings[0]?.id) return;
    addFoaling.mutate({
      coveringId: foalingModal.cycle.coverings[0].id,
      date: new Date(values.date),
      sex: values.sex === "UNKNOWN" ? undefined : (values.sex as "MALE" | "FEMALE"),
      alive: values.alive,
      notes: values.notes,
    });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KanbanColumn 
          id="vacias"
          title="Vacías / En Celo" 
          icon={WarningCircle} 
          items={colVacias} 
          bgClass="bg-amber-50/50" 
          colorClass="text-amber-500" 
          tenantSlug={tenantSlug}
        />
        <KanbanColumn 
          id="prenadas"
          title="Preñadas" 
          icon={CheckCircle} 
          items={colPrenadas} 
          bgClass="bg-emerald-50/50" 
          colorClass="text-emerald-500" 
          tenantSlug={tenantSlug}
        />
        <KanbanColumn 
          id="paridas"
          title="Paridas" 
          icon={Baby} 
          items={colParidas} 
          bgClass="bg-blue-50/50" 
          colorClass="text-blue-500" 
          tenantSlug={tenantSlug}
        />
      </div>

      <DragOverlay>
        {activeCard ? (
          <div className="opacity-80 rotate-2 scale-105">
            <Card className="border-primary/50 shadow-xl bg-background/90 backdrop-blur">
              <CardContent className="p-4 space-y-3">
                <div className="font-bold text-base text-foreground tracking-tight">
                  {activeCard.mare.name}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DragOverlay>

      {/* Modals */}
      <Dialog open={pregnancyModal.open} onOpenChange={(open) => setPregnancyModal(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Control de Gestación</DialogTitle>
          </DialogHeader>
          <Form {...pregForm}>
            <form onSubmit={pregForm.handleSubmit(onPregnancySubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={pregForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={pregForm.control}
                  name="dayOfPregnancy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Día de Gestación (Ej. 14, 45)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={pregForm.control}
                name="result"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resultado</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Selecciona el resultado">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="POSITIVE">Positiva</SelectItem>
                        <SelectItem value="NEGATIVE">Negativa</SelectItem>
                        <SelectItem value="TWINS">Gemelos</SelectItem>
                        <SelectItem value="REABSORBED">Reabsorbida</SelectItem>
                        <SelectItem value="ABORTION">Aborto</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setPregnancyModal({ open: false, cycle: null })}>Cancelar</Button>
                <Button type="submit" disabled={addPregnancyCheck.isPending}>
                  {addPregnancyCheck.isPending ? "Guardando..." : "Guardar Eco"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={foalingModal.open} onOpenChange={(open) => setFoalingModal(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Parto</DialogTitle>
          </DialogHeader>
          <Form {...foalForm}>
            <form onSubmit={foalForm.handleSubmit(onFoalingSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={foalForm.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={foalForm.control}
                  name="sex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sexo del potro</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecciona el sexo">
                          {(val: string) => SELECT_TRANSLATIONS[val] || val}
                        </SelectValue></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MALE">Macho</SelectItem>
                          <SelectItem value="FEMALE">Hembra</SelectItem>
                          <SelectItem value="UNKNOWN">Desconocido</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={foalForm.control}
                name="alive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Nacido vivo</FormLabel>
                      <div className="text-sm text-muted-foreground">Indica si el potro ha nacido vivo y sano.</div>
                    </div>
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={foalForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas</FormLabel>
                    <FormControl><Textarea placeholder="Complicaciones..." className="resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setFoalingModal({ open: false, cycle: null })}>Cancelar</Button>
                <Button type="submit" disabled={addFoaling.isPending}>
                  {addFoaling.isPending ? "Guardando..." : "Guardar Parto"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
