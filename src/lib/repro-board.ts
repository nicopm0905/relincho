import type { ReproAction, ReproPhase } from "@/lib/repro-engine";

/** Los cinco pasos con los que piensa un criador, de vacía a parida. */
export const PIPELINE_STAGES = ["empty", "heat", "covered", "pregnant", "foaled"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

const stageOfPhase: Record<ReproPhase, PipelineStage> = {
  ANESTRUS: "empty",
  UNTRACKED: "empty",
  DIESTRUS: "heat",
  IN_HEAT: "heat",
  COVERED: "covered",
  PREGNANT: "pregnant",
  FOALING_SOON: "pregnant",
  POSTPARTUM: "foaled",
};

export function pipelineStage(phase: ReproPhase): PipelineStage {
  return stageOfPhase[phase];
}

/** Diálogo que abre cada acción en la página de la temporada (`?accion=`). */
export type BoardAction = "eco" | "exploracion" | "cubricion" | "vigilancia" | "parto";

const dialogOfKind: Partial<Record<ReproAction["kind"], BoardAction>> = {
  exam: "exploracion",
  confirm_ovulation: "exploracion",
  tease: "exploracion",
  breed: "cubricion",
  pregnancy_check: "eco",
  foaling_watch: "vigilancia",
  // Los hitos de gestación (vacunas, pasar al box) son tareas, no un registro
  // reproductivo: no abren diálogo.
};

export type NextAction = {
  action: BoardAction;
  /** Lo que pide el motor ("Eco de latido"), si lo pide. */
  label: string | null;
  window: { from: Date; to: Date; overdue: boolean } | null;
};

/**
 * Lo siguiente que hay que hacer con una yegua: lo vencido primero, luego lo
 * más próximo. Sin nada pendiente, la exploración es el punto de partida para
 * que el motor pueda predecir; una gestante sin hitos no necesita nada.
 */
export function nextAction(phase: ReproPhase, actions: ReproAction[]): NextAction | null {
  const candidates = actions
    .filter((a) => dialogOfKind[a.kind])
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || new Date(a.from).getTime() - new Date(b.from).getTime(),
    );
  const first = candidates[0];
  if (first) {
    return {
      action: dialogOfKind[first.kind]!,
      label: first.label,
      window: { from: new Date(first.from), to: new Date(first.to), overdue: first.overdue },
    };
  }
  if (phase === "PREGNANT") return null;
  if (phase === "FOALING_SOON") return { action: "vigilancia", label: null, window: null };
  return { action: "exploracion", label: null, window: null };
}
