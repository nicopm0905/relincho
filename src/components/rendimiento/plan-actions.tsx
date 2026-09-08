"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, ArrowsClockwise, SpinnerGap } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { disciplineLabels } from "./labels";

interface CompetitionOption {
  id: string;
  name: string;
  targetDate: Date;
}

interface Props {
  horseId: string;
  hasPlan: boolean;
  discipline: string | null;
  competitions: CompetitionOption[];
}

/** Genera o regenera la periodizacion hasta la competicion objetivo. */
export function PlanActions({ horseId, hasPlan, discipline, competitions }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState(competitions[0]?.id ?? "manual");
  const [manualDate, setManualDate] = useState("");
  const [manualName, setManualName] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState(
    discipline ?? "DOMA_CLASICA",
  );
  const [buffer, setBuffer] = useState("15");

  const generate = trpc.performance.generatePlan.useMutation();
  const createCompetition = trpc.performance.createCompetition.useMutation();
  const pending = generate.isPending || createCompetition.isPending;

  const useManual = targetId === "manual" || competitions.length === 0;

  const handleGenerate = async () => {
    try {
      // Una fecha manual con nombre queda registrada como objetivo del caballo.
      let competitionTargetId = useManual ? undefined : targetId;
      if (useManual && manualName.trim()) {
        const created = await createCompetition.mutateAsync({
          horseId,
          name: manualName.trim(),
          targetDate: new Date(manualDate),
        });
        competitionTargetId = created.id;
      }

      const result = await generate.mutateAsync({
        horseId,
        competitionTargetId,
        targetDate: useManual ? new Date(manualDate) : undefined,
        discipline: selectedDiscipline as never,
        recoveryBufferPct: Number(buffer) || 15,
      });

      toast.success(
        `Plan generado: ${result.totalWeeks} semanas en ${result.mesocycles} bloques.`,
      );
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el plan",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={hasPlan ? "outline" : "default"} />}>
        {hasPlan ? (
          <ArrowsClockwise weight="bold" className="mr-2 h-4 w-4" />
        ) : (
          <CalendarPlus weight="bold" className="mr-2 h-4 w-4" />
        )}
        {hasPlan ? "Regenerar plan" : "Generar plan"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {hasPlan ? "Regenerar la periodización" : "Generar la periodización"}
          </DialogTitle>
          <DialogDescription>
            El calendario se construye hacia atrás desde la competición: bloques de
            tres a seis semanas y tapering final.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Competición objetivo</Label>
            <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "manual")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {competitions.map((competition) => (
                  <SelectItem key={competition.id} value={competition.id}>
                    {competition.name} —{" "}
                    {competition.targetDate.toLocaleDateString("es-ES")}
                  </SelectItem>
                ))}
                <SelectItem value="manual">Fecha manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {useManual && (
            <div className="space-y-3 rounded-lg border border-border p-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="manualName">Nombre del evento</Label>
                <Input
                  id="manualName"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="SICAB"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manualDate">Fecha de la competición</Label>
                <Input
                  id="manualDate"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </div>
              <p className="text-[12px] text-muted-foreground">
                Si le pones nombre, queda guardada como competición objetivo del
                caballo.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Disciplina</Label>
            <Select
              value={selectedDiscipline}
              onValueChange={(v) => setSelectedDiscipline(v ?? "DOMA_CLASICA")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(disciplineLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="buffer">Margen de recuperación (%)</Label>
            <Input
              id="buffer"
              type="number"
              min={0}
              max={50}
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
            />
            <p className="text-[12px] text-muted-foreground">
              Cuánto puede crecer o encogerse un día al reabsorber una desviación.
            </p>
          </div>

          {hasPlan && (
            <p className="rounded-lg border border-amber-300/70 bg-amber-50/50 px-3.5 py-2.5 text-[12.5px] text-amber-900">
              El plan actual se archivará. Las sesiones ya registradas se conservan.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={pending || (useManual && !manualDate)}
            onClick={handleGenerate}
          >
            {pending && <SpinnerGap className="animate-spin" />}
            {hasPlan ? "Regenerar" : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
