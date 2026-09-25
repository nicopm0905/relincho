/**
 * Gestacion avanzada, preparto y neonato. Funciones puras, como el motor.
 */

import type { MilestoneKind, ReproSettings } from "./repro-settings";

const DAY_MS = 24 * 60 * 60 * 1000;

export type Milestone = {
  key: string;
  label: string;
  kind: MilestoneKind;
  due: Date;
};

/** Hitos de una gestacion con su fecha, en orden. */
export function gestationMilestones(
  coveringDate: Date | string,
  expectedFoaling: Date | string,
  settings: Pick<ReproSettings, "gestationMilestones">,
): Milestone[] {
  const covered = new Date(coveringDate).getTime();
  const expected = new Date(expectedFoaling).getTime();
  return settings.gestationMilestones
    .map((m) => ({
      key: m.key,
      label: m.label,
      kind: m.kind,
      due: new Date(m.anchor === "COVERING" ? covered + m.day * DAY_MS : expected - m.day * DAY_MS),
    }))
    .sort((a, b) => a.due.getTime() - b.due.getTime());
}

/** Clave estable de la tarea de un hito: no se duplica aunque el cron pase cada dia. */
export function milestoneTaskKey(coveringId: string, milestoneKey: string) {
  return `repro:${coveringId}:${milestoneKey}`;
}

export const milestoneKindLabels: Record<MilestoneKind, string> = {
  VACCINATION: "Vacuna",
  DEWORMING: "Desparasitación",
  MANAGEMENT: "Manejo",
  CHECK: "Control",
};

// ---------------------------------------------------------------------------
// Vigilancia preparto
// ---------------------------------------------------------------------------

export type FoalingWatchInput = {
  date: Date | string;
  udderScore?: number | null;
  wax?: boolean | null;
  milkCalciumPpm?: number | null;
  relaxation?: boolean | null;
};

export const udderLabels = ["0 · Sin cambios", "1 · Empieza", "2 · Llena", "3 · A tope"] as const;

export type WatchAssessment = {
  level: "info" | "warning" | "danger";
  message: string;
  /** Signos de parto en las proximas 24-72 h. */
  imminent: boolean;
};

/**
 * Lectura de la ultima vigilancia (solo cuenta si es de las ultimas 48 h).
 * Calcio en leche por encima del umbral o cera en los pezones: parto probable
 * en 24-72 h. Ubre llena con relajacion: se acerca.
 */
export function assessFoalingWatch(
  logs: FoalingWatchInput[],
  settings: Pick<ReproSettings, "milkCalciumAlertPpm">,
  now: Date = new Date(),
): WatchAssessment | null {
  if (logs.length === 0) return null;
  const last = [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  if (now.getTime() - new Date(last.date).getTime() > 2 * DAY_MS) return null;
  const ca = last.milkCalciumPpm ?? null;
  if (ca !== null && ca >= settings.milkCalciumAlertPpm) {
    return {
      level: "danger",
      imminent: true,
      message: `Calcio en leche ${ca} ppm (≥ ${settings.milkCalciumAlertPpm}): parto probable en 24-72 h. Vigilancia continua.`,
    };
  }
  if (last.wax) {
    return {
      level: "danger",
      imminent: true,
      message: "Cera en los pezones: el parto suele llegar en 24-48 h. Vigilancia continua.",
    };
  }
  if ((last.udderScore ?? 0) >= 2 && last.relaxation) {
    return {
      level: "warning",
      imminent: false,
      message: "Ubre llena y ligamentos relajados: el parto se acerca. Medir calcio a diario.",
    };
  }
  if (ca !== null) {
    return {
      level: "info",
      imminent: false,
      message: `Calcio en leche ${ca} ppm: parto poco probable en las próximas 24 h.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Neonato
// ---------------------------------------------------------------------------

export const FOALING_COMPLICATIONS = [
  "DYSTOCIA",
  "RED_BAG",
  "RETAINED_PLACENTA",
  "WEAK_FOAL",
  "OTHER",
] as const;

export const complicationLabels: Record<string, string> = {
  DYSTOCIA: "Distocia",
  RED_BAG: "Bolsa roja (separación prematura de placenta)",
  RETAINED_PLACENTA: "Retención de placenta",
  WEAK_FOAL: "Potro débil",
  OTHER: "Otra",
};

export type NeonatalInput = {
  alive?: boolean | null;
  foalStoodMinutes?: number | null;
  foalSuckledMinutes?: number | null;
  placentaMinutes?: number | null;
  meconiumPassed?: boolean | null;
  foalIggMgDl?: number | null;
  complications?: string[] | null;
};

export type NeonatalAlert = { key: string; level: "info" | "warning" | "danger"; message: string };

/** Regla 1-2-3 e IgG: lo que hay que revisar del parto y del potro. */
export function assessNeonatal(
  foaling: NeonatalInput,
  settings: Pick<
    ReproSettings,
    "foalStandMaxMinutes" | "foalSuckleMaxMinutes" | "placentaMaxMinutes" | "iggFailureMgDl" | "iggAdequateMgDl"
  >,
): NeonatalAlert[] {
  const alerts: NeonatalAlert[] = [];
  const late = (value: number | null | undefined, max: number) => typeof value === "number" && value > max;
  if (foaling.alive !== false) {
    if (late(foaling.foalStoodMinutes, settings.foalStandMaxMinutes)) {
      alerts.push({
        key: "stand",
        level: "warning",
        message: `El potro tardó ${foaling.foalStoodMinutes} min en levantarse (lo normal, < ${settings.foalStandMaxMinutes}).`,
      });
    }
    if (late(foaling.foalSuckledMinutes, settings.foalSuckleMaxMinutes)) {
      alerts.push({
        key: "suckle",
        level: "danger",
        message: `El potro tardó ${foaling.foalSuckledMinutes} min en mamar (lo normal, < ${settings.foalSuckleMaxMinutes}): riesgo de no encalostrar.`,
      });
    }
    if (foaling.meconiumPassed === false) {
      alerts.push({ key: "meconium", level: "warning", message: "Meconio no expulsado: vigilar cólico del potro." });
    }
    const igg = foaling.foalIggMgDl;
    if (typeof igg === "number") {
      if (igg < settings.iggFailureMgDl) {
        alerts.push({
          key: "igg",
          level: "danger",
          message: `IgG ${igg} mg/dl: fallo de transferencia de inmunidad (< ${settings.iggFailureMgDl}). Avisar al veterinario.`,
        });
      } else if (igg < settings.iggAdequateMgDl) {
        alerts.push({
          key: "igg",
          level: "warning",
          message: `IgG ${igg} mg/dl: transferencia parcial (${settings.iggFailureMgDl}-${settings.iggAdequateMgDl}).`,
        });
      }
    }
  }
  if (late(foaling.placentaMinutes, settings.placentaMaxMinutes) || (foaling.complications ?? []).includes("RETAINED_PLACENTA")) {
    alerts.push({
      key: "placenta",
      level: "danger",
      message: "Retención de placenta (más de 3 h): urgencia veterinaria para la yegua.",
    });
  }
  return alerts;
}
