"use client";

import { useState } from "react";
import { Heartbeat, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDialog, type TaskOption } from "@/components/tareas/task-dialog";
import { HealthEventForm } from "@/components/sanidad/health-event-form";
import { MassHealthDialog } from "@/components/sanidad/mass-health-dialog";

export function QuickActions({
  tenantSlug,
  horses,
  assignees,
  canRecordHealth,
}: {
  tenantSlug: string;
  horses: (TaskOption & { status: string; excludedFromFoodChain: boolean })[];
  assignees: TaskOption[];
  canRecordHealth: boolean;
}) {
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingQuickTask, setCreatingQuickTask] = useState(false);
  const [creatingHealthEvent, setCreatingHealthEvent] = useState(false);
  const activeHorses = horses.filter((horse) => horse.status === "ACTIVE");

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="mb-3">
        <h2 id="quick-actions-heading" className="text-sm font-semibold text-foreground">
          Acciones rápidas
        </h2>
        <p className="text-xs text-muted-foreground">
          Anota algo sin salir del inicio.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreatingQuickTask(true)}>
          <Plus weight="bold" />
          Tarea rápida
        </Button>
        <Button variant="outline" onClick={() => setCreatingTask(true)}>
          <Plus weight="bold" />
          Nueva tarea
        </Button>
        {canRecordHealth && (
          <Button
            variant="outline"
            onClick={() => setCreatingHealthEvent(true)}
            disabled={activeHorses.length === 0}
          >
            <Heartbeat weight="bold" />
            Registrar cuidado
          </Button>
        )}
        {canRecordHealth && activeHorses.length > 1 && (
          <MassHealthDialog
            horses={activeHorses}
            tenantSlug={tenantSlug}
            compact
          />
        )}
      </div>
      {canRecordHealth && activeHorses.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Para registrar un cuidado, primero añade un caballo activo.
        </p>
      )}
      {creatingHealthEvent && activeHorses.length > 0 && (
        <Dialog open onOpenChange={setCreatingHealthEvent}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Registrar cuidado</DialogTitle>
              <DialogDescription>
                Añade una vacuna, desparasitación, visita veterinaria u otro evento sanitario.
              </DialogDescription>
            </DialogHeader>
            <HealthEventForm
              tenantSlug={tenantSlug}
              horses={activeHorses}
              onSaved={() => setCreatingHealthEvent(false)}
            />
          </DialogContent>
        </Dialog>
      )}
      {creatingQuickTask && (
        <TaskDialog
          open
          onOpenChange={setCreatingQuickTask}
          horses={horses}
          assignees={assignees}
          quickMode
        />
      )}
      {creatingTask && (
        <TaskDialog
          open
          onOpenChange={setCreatingTask}
          horses={horses}
          assignees={assignees}
        />
      )}
    </section>
  );
}
