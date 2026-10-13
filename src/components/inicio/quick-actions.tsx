"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
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
  horses: (TaskOption & { status: string; excludedFromFoodChain: boolean; weightKg?: number | null })[];
  assignees: TaskOption[];
  canRecordHealth: boolean;
}) {
  const t = useTranslations("home.quickActions");
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingQuickTask, setCreatingQuickTask] = useState(false);
  const [creatingHealthEvent, setCreatingHealthEvent] = useState(false);
  const activeHorses = horses.filter((horse) => horse.status === "ACTIVE");

  return (
    <section
      aria-labelledby="quick-actions-heading"
      className="space-y-3"
    >
      <div>
        <h2 id="quick-actions-heading" className="text-heading font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="text-label text-muted-foreground">{t("description")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCreatingQuickTask(true)}>
          <Plus weight="bold" />
          {t("quickTask")}
        </Button>
        <Button variant="outline" onClick={() => setCreatingTask(true)}>
          <Plus weight="bold" />
          {t("newTask")}
        </Button>
        {canRecordHealth && (
          <Button
            variant="outline"
            onClick={() => setCreatingHealthEvent(true)}
            disabled={activeHorses.length === 0}
          >
            <Heartbeat weight="bold" />
            {t("recordCare")}
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
        <p className="text-caption text-muted-foreground">{t("needHorse")}</p>
      )}
      {creatingHealthEvent && activeHorses.length > 0 && (
        <Dialog open onOpenChange={setCreatingHealthEvent}>
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{t("recordCare")}</DialogTitle>
              <DialogDescription>{t("careDescription")}</DialogDescription>
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
