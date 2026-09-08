/**
 * Motor de periodizacion determinista.
 *
 * Genera el arbol Macrociclo -> Mesociclos (3-6 semanas) -> Microciclos (7 dias)
 * -> Carga diaria, trabajando hacia atras desde la fecha de competicion objetivo,
 * y lo recalcula cuando aparecen desviaciones (dia perdido o sobrecarga aguda).
 *
 * Todo el modulo es puro: no toca base de datos ni fechas del sistema.
 */

import { addDays, differenceInCalendarDays } from "date-fns";
import { calcInternalLoad, clamp } from "./load";

export type DisciplineValue =
  | "DOMA_CLASICA"
  | "DOMA_VAQUERA"
  | "SALTO"
  | "COMPLETO"
  | "RAID"
  | "ENGANCHES"
  | "FUNCIONALIDAD"
  | "OCIO";

export type PhaseValue =
  | "ACUMULACION"
  | "TRANSMUTACION"
  | "REALIZACION"
  | "TRANSICION";

export type WorkTypeValue =
  | "DESCANSO"
  | "RECUPERACION_ACTIVA"
  | "PISTA_TECNICA"
  | "PISTA_ALTA_INTENSIDAD"
  | "CAMPO_FONDO"
  | "GIMNASIA_SALTO"
  | "COMPETICION";

export interface LoadConstraints {
  /** Historial de tendinitis: limita intensidad y minutos sobre superficie de impacto. */
  tendonHistoryAlert?: boolean;
  maxImpactSurfaceMinutes?: number | null;
  maxRpe?: number | null;
  mandatoryRestDaysPerMicrocycle?: number;
}

export interface PlannedDay {
  date: Date;
  workType: WorkTypeValue;
  rpeTarget: number;
  durationMinutes: number;
  plannedLoadUa: number;
  impactSurfaceMinutes: number;
}

export interface PlannedMicrocycle {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  plannedLoadUa: number;
  mandatoryRestDays: number;
  days: PlannedDay[];
}

export interface PlannedMesocycle {
  phase: PhaseValue;
  orderIndex: number;
  startDate: Date;
  endDate: Date;
  weeks: number;
  volumeIndex: number;
  intensityIndex: number;
  microcycles: PlannedMicrocycle[];
}

export interface PeriodizationPlan {
  startDate: Date;
  targetDate: Date;
  totalWeeks: number;
  discipline: DisciplineValue;
  mesocycles: PlannedMesocycle[];
}

/** Carga semanal de referencia (UA) por disciplina para un caballo adulto en forma. */
const BASE_WEEKLY_LOAD_UA: Record<DisciplineValue, number> = {
  DOMA_CLASICA: 1800,
  DOMA_VAQUERA: 1700,
  SALTO: 1900,
  COMPLETO: 2400,
  RAID: 2800,
  ENGANCHES: 1700,
  FUNCIONALIDAD: 1700,
  OCIO: 1000,
};

const PHASE_INDEX: Record<PhaseValue, { volume: number; intensity: number }> = {
  ACUMULACION: { volume: 1.15, intensity: 0.75 },
  TRANSMUTACION: { volume: 0.95, intensity: 1.0 },
  REALIZACION: { volume: 0.6, intensity: 1.1 },
  TRANSICION: { volume: 0.7, intensity: 0.6 },
};

/** Fraccion de la sesion que transcurre sobre superficie de impacto. */
const IMPACT_RATIO: Record<WorkTypeValue, number> = {
  DESCANSO: 0,
  RECUPERACION_ACTIVA: 0.1,
  PISTA_TECNICA: 0.35,
  PISTA_ALTA_INTENSIDAD: 0.6,
  CAMPO_FONDO: 0.55,
  GIMNASIA_SALTO: 0.5,
  COMPETICION: 0.7,
};

interface DaySlot {
  workType: WorkTypeValue;
  rpe: number;
  weight: number;
}

const REST: DaySlot = { workType: "DESCANSO", rpe: 0, weight: 0 };

/** Plantilla semanal por fase, de lunes a domingo. */
const WEEK_TEMPLATE: Record<PhaseValue, DaySlot[]> = {
  ACUMULACION: [
    REST,
    { workType: "PISTA_TECNICA", rpe: 5, weight: 0.18 },
    { workType: "CAMPO_FONDO", rpe: 6, weight: 0.22 },
    { workType: "RECUPERACION_ACTIVA", rpe: 3, weight: 0.08 },
    { workType: "PISTA_TECNICA", rpe: 5, weight: 0.18 },
    { workType: "CAMPO_FONDO", rpe: 6, weight: 0.24 },
    REST,
  ],
  TRANSMUTACION: [
    REST,
    { workType: "PISTA_ALTA_INTENSIDAD", rpe: 8, weight: 0.25 },
    { workType: "PISTA_TECNICA", rpe: 6, weight: 0.15 },
    { workType: "RECUPERACION_ACTIVA", rpe: 3, weight: 0.07 },
    { workType: "PISTA_ALTA_INTENSIDAD", rpe: 8, weight: 0.25 },
    { workType: "PISTA_TECNICA", rpe: 6, weight: 0.18 },
    REST,
  ],
  REALIZACION: [
    { workType: "PISTA_TECNICA", rpe: 6, weight: 0.2 },
    { workType: "PISTA_ALTA_INTENSIDAD", rpe: 8, weight: 0.22 },
    { workType: "RECUPERACION_ACTIVA", rpe: 3, weight: 0.1 },
    { workType: "PISTA_TECNICA", rpe: 6, weight: 0.18 },
    { workType: "RECUPERACION_ACTIVA", rpe: 3, weight: 0.1 },
    REST,
    REST,
  ],
  TRANSICION: [
    REST,
    { workType: "RECUPERACION_ACTIVA", rpe: 3, weight: 0.2 },
    { workType: "PISTA_TECNICA", rpe: 4, weight: 0.3 },
    REST,
    { workType: "RECUPERACION_ACTIVA", rpe: 3, weight: 0.2 },
    { workType: "PISTA_TECNICA", rpe: 4, weight: 0.3 },
    REST,
  ],
};

/** Progresion 3:1 dentro del mesociclo: tres semanas de carga y una de descarga. */
const RAMP = [0.9, 1.0, 1.1, 0.75, 1.05, 0.8];

/** Tapering: la ultima semana antes de competir baja de forma marcada. */
function taperRamp(weeks: number): number[] {
  if (weeks <= 1) return [0.7];
  return Array.from({ length: weeks }, (_, i) => 1.0 - (0.35 * i) / (weeks - 1));
}

const MIN_SESSION_MINUTES = 20;
const MAX_SESSION_MINUTES = 90;

// ---------------------------------------------------------------------------
// Construccion del plan
// ---------------------------------------------------------------------------

export interface BuildPlanInput {
  startDate: Date;
  targetDate: Date;
  discipline: DisciplineValue;
  constraints?: LoadConstraints;
}

export function buildPeriodizationPlan(input: BuildPlanInput): PeriodizationPlan {
  const { discipline, constraints = {} } = input;
  const start = startOfIsoWeekUtc(stripTime(input.startDate));
  const target = stripTime(input.targetDate);

  const days = differenceInCalendarDays(target, start);
  if (days < 6) {
    throw new Error(
      "La fecha de competicion debe estar al menos a una semana de la fecha de inicio.",
    );
  }
  const totalWeeks = Math.floor(days / 7) + 1;

  const blocks = allocateBlocks(totalWeeks);
  const baseWeekly = BASE_WEEKLY_LOAD_UA[discipline];

  const mesocycles: PlannedMesocycle[] = [];
  let weekCursor = 0;

  blocks.forEach((block, index) => {
    const phaseIndex = PHASE_INDEX[block.phase];
    const mesoStart = addDays(start, weekCursor * 7);
    const mesoEnd = addDays(mesoStart, block.weeks * 7 - 1);
    const ramp = block.phase === "REALIZACION" ? taperRamp(block.weeks) : RAMP;

    const microcycles: PlannedMicrocycle[] = [];
    for (let w = 0; w < block.weeks; w++) {
      const weekStart = addDays(mesoStart, w * 7);
      const weekEnd = addDays(weekStart, 6);
      const weeklyLoad = Math.round(
        baseWeekly * phaseIndex.volume * (ramp[w % ramp.length] ?? 1),
      );
      const dayList = buildWeekDays({
        weekStart,
        weeklyLoad,
        phase: block.phase,
        discipline,
        constraints,
        targetDate: target,
      });
      microcycles.push({
        weekNumber: weekCursor + w + 1,
        startDate: weekStart,
        endDate: weekEnd,
        plannedLoadUa: sum(dayList.map((d) => d.plannedLoadUa)),
        mandatoryRestDays: dayList.filter((d) => d.workType === "DESCANSO").length,
        days: dayList,
      });
    }

    mesocycles.push({
      phase: block.phase,
      orderIndex: index,
      startDate: mesoStart,
      endDate: mesoEnd,
      weeks: block.weeks,
      volumeIndex: phaseIndex.volume,
      intensityIndex: phaseIndex.intensity,
      microcycles,
    });
    weekCursor += block.weeks;
  });

  return { startDate: start, targetDate: target, totalWeeks, discipline, mesocycles };
}

/**
 * Reparte las semanas disponibles en bloques de 3-6 semanas trabajando hacia
 * atras desde la competicion: primero la Realizacion (tapering), despues
 * alternancia Transmutacion / Acumulacion.
 */
function allocateBlocks(totalWeeks: number): { phase: PhaseValue; weeks: number }[] {
  if (totalWeeks <= 3) {
    return [{ phase: "REALIZACION", weeks: totalWeeks }];
  }

  const blocks: { phase: PhaseValue; weeks: number }[] = [];
  const realizacionWeeks = Math.min(3, totalWeeks - 1);
  blocks.push({ phase: "REALIZACION", weeks: realizacionWeeks });

  let remaining = totalWeeks - realizacionWeeks;
  const pattern: { phase: PhaseValue; weeks: number }[] = [
    { phase: "TRANSMUTACION", weeks: 3 },
    { phase: "ACUMULACION", weeks: 4 },
  ];
  let i = 0;
  while (remaining > 0) {
    const next = pattern[i % pattern.length];
    const weeks = Math.min(next.weeks, remaining);
    blocks.push({ phase: next.phase, weeks });
    remaining -= weeks;
    i++;
  }

  blocks.reverse();

  // Un bloque inicial demasiado corto se funde con el siguiente, salvo que ese
  // siguiente sea la Realizacion: alargar el tapering desvirtuaria el pico de
  // forma. En ese caso el bloque corto queda como Transicion de entrada.
  if (blocks.length > 1 && blocks[0].weeks < 3) {
    const canMerge =
      blocks[1].phase !== "REALIZACION" && blocks[0].weeks + blocks[1].weeks <= 6;
    if (canMerge) {
      blocks[1].weeks += blocks[0].weeks;
      blocks.shift();
    } else {
      blocks[0].phase = "TRANSICION";
    }
  }

  // El reparto hacia atras puede dejar un bloque de intensidad al principio de
  // la temporada. Se acumula antes de transmutar, asi que el primero se reetiqueta.
  if (blocks.length > 1 && blocks[0].phase === "TRANSMUTACION") {
    blocks[0].phase = "ACUMULACION";
  }

  return blocks;
}

interface BuildWeekInput {
  weekStart: Date;
  weeklyLoad: number;
  phase: PhaseValue;
  discipline: DisciplineValue;
  constraints: LoadConstraints;
  targetDate: Date;
}

function buildWeekDays(input: BuildWeekInput): PlannedDay[] {
  const { weekStart, weeklyLoad, phase, discipline, constraints, targetDate } = input;

  let slots = WEEK_TEMPLATE[phase].map((slot) => ({ ...slot }));
  slots = applyDisciplineFlavour(slots, discipline);
  slots = applyRestDayFloor(slots, constraints.mandatoryRestDaysPerMicrocycle ?? 2);

  const totalWeight = sum(slots.map((s) => s.weight));
  const days: PlannedDay[] = slots.map((slot, index) => {
    const date = addDays(weekStart, index);
    if (slot.workType === "DESCANSO" || slot.weight === 0) {
      return restDay(date);
    }
    const targetUa = totalWeight > 0 ? (weeklyLoad * slot.weight) / totalWeight : 0;
    const rpe = cappedRpe(slot.rpe, constraints);
    const minutes = roundTo5(
      clamp(targetUa / Math.max(1, rpe), MIN_SESSION_MINUTES, MAX_SESSION_MINUTES),
    );
    return finalizeDay({ date, workType: slot.workType, rpe, minutes, constraints });
  });

  return applyCompetitionDay(days, targetDate, discipline, constraints);
}

function applyDisciplineFlavour(slots: DaySlot[], discipline: DisciplineValue): DaySlot[] {
  const jumping = discipline === "SALTO" || discipline === "COMPLETO";
  if (!jumping) return slots;
  let swapped = false;
  return slots.map((slot) => {
    if (!swapped && slot.workType === "PISTA_ALTA_INTENSIDAD") {
      swapped = true;
      return { ...slot, workType: "GIMNASIA_SALTO" as WorkTypeValue };
    }
    return slot;
  });
}

/** Garantiza el minimo de dias de descanso convirtiendo los trabajos mas suaves. */
function applyRestDayFloor(slots: DaySlot[], minRestDays: number): DaySlot[] {
  const result = slots.map((s) => ({ ...s }));
  let restCount = result.filter((s) => s.workType === "DESCANSO").length;
  while (restCount < minRestDays) {
    let lightestIndex = -1;
    for (let i = 0; i < result.length; i++) {
      if (result[i].workType === "DESCANSO") continue;
      if (lightestIndex === -1 || result[i].weight < result[lightestIndex].weight) {
        lightestIndex = i;
      }
    }
    if (lightestIndex === -1) break;
    result[lightestIndex] = { ...REST };
    restCount++;
  }
  return result;
}

/** Si la competicion cae dentro de la semana, ese dia se corre y la vispera descansa. */
function applyCompetitionDay(
  days: PlannedDay[],
  targetDate: Date,
  discipline: DisciplineValue,
  constraints: LoadConstraints,
): PlannedDay[] {
  const index = days.findIndex((d) => isSameDay(d.date, targetDate));
  if (index === -1) return days;

  const result = [...days];
  const rpe = cappedRpe(9, constraints);
  result[index] = finalizeDay({
    date: result[index].date,
    workType: "COMPETICION",
    rpe,
    minutes: discipline === "RAID" ? 90 : 45,
    constraints,
  });
  if (index > 0) result[index - 1] = restDay(result[index - 1].date);
  for (let i = index + 1; i < result.length; i++) {
    result[i] = restDay(result[i].date);
  }
  return enforceRestDays(result, index, constraints.mandatoryRestDaysPerMicrocycle ?? 2);
}

/**
 * La semana de competicion pierde huecos de descanso al reservar la vispera,
 * asi que se recuperan vaciando las sesiones mas ligeras.
 */
function enforceRestDays(
  days: PlannedDay[],
  competitionIndex: number,
  minRestDays: number,
): PlannedDay[] {
  const result = [...days];
  let rest = result.filter((d) => d.workType === "DESCANSO").length;
  while (rest < minRestDays) {
    let lightest = -1;
    for (let i = 0; i < result.length; i++) {
      if (i === competitionIndex || result[i].workType === "DESCANSO") continue;
      if (lightest === -1 || result[i].plannedLoadUa < result[lightest].plannedLoadUa) {
        lightest = i;
      }
    }
    if (lightest === -1) break;
    result[lightest] = restDay(result[lightest].date);
    rest++;
  }
  return result;
}

function cappedRpe(rpe: number, constraints: LoadConstraints): number {
  let max = constraints.maxRpe ?? 10;
  if (constraints.tendonHistoryAlert) max = Math.min(max, 8);
  return clamp(Math.round(rpe), 1, max);
}

/** Aplica el techo de minutos sobre superficie de impacto recortando la sesion. */
function finalizeDay(params: {
  date: Date;
  workType: WorkTypeValue;
  rpe: number;
  minutes: number;
  constraints: LoadConstraints;
}): PlannedDay {
  const ratio = IMPACT_RATIO[params.workType];
  let minutes = params.minutes;
  const maxImpact = params.constraints.maxImpactSurfaceMinutes;
  if (maxImpact != null && ratio > 0 && minutes * ratio > maxImpact) {
    // Hacia abajo: el techo veterinario manda sobre la duracion minima de sesion.
    minutes = Math.max(5, floorTo5(maxImpact / ratio));
  }
  return {
    date: params.date,
    workType: params.workType,
    rpeTarget: params.rpe,
    durationMinutes: minutes,
    plannedLoadUa: calcInternalLoad(params.rpe, minutes),
    impactSurfaceMinutes: Math.round(minutes * ratio),
  };
}

function restDay(date: Date): PlannedDay {
  return {
    date,
    workType: "DESCANSO",
    rpeTarget: 0,
    durationMinutes: 0,
    plannedLoadUa: 0,
    impactSurfaceMinutes: 0,
  };
}

// ---------------------------------------------------------------------------
// Recalculo por desviacion (variabilidad biologica)
// ---------------------------------------------------------------------------

export type DeviationKind = "MISSED_DAY" | "ACUTE_OVERLOAD";

export interface AdjustableDay {
  date: Date;
  phase: PhaseValue;
  workType: WorkTypeValue;
  rpeTarget: number;
  durationMinutes: number;
  plannedLoadUa: number;
  /** Dias ya ejecutados o perdidos no se tocan. */
  locked: boolean;
  microcycleId: string;
}

export interface DayAdjustment {
  date: Date;
  microcycleId: string;
  workType: WorkTypeValue;
  rpeTarget: number;
  durationMinutes: number;
  plannedLoadUa: number;
  reason: string;
}

export interface RecalculateInput {
  kind: DeviationKind;
  /** Dias posteriores al evento, en orden cronologico. */
  upcoming: AdjustableDay[];
  /** Microciclo donde ocurre la desviacion. */
  microcycleId: string;
  /** Carga perdida (MISSED_DAY) o exceso ejecutado (ACUTE_OVERLOAD), en UA. */
  deltaUa: number;
  /** Margen maximo de recuperacion por dia, en porcentaje. */
  recoveryBufferPct?: number;
  constraints?: LoadConstraints;
}

export interface RecalculateResult {
  adjustments: DayAdjustment[];
  bufferStatus: "idle" | "active" | "exhausted";
  /** Carga que no ha podido reabsorberse dentro del margen disponible. */
  unabsorbedUa: number;
}

/**
 * Recalcula el resto del mesociclo tras una desviacion sin tocar el pico de
 * forma: los dias de la fase de Realizacion y la competicion quedan intactos.
 */
export function recalculatePlan(input: RecalculateInput): RecalculateResult {
  const buffer = (input.recoveryBufferPct ?? 15) / 100;
  const constraints = input.constraints ?? {};
  const editable = input.upcoming.filter(
    (d) => !d.locked && d.phase !== "REALIZACION" && d.workType !== "COMPETICION",
  );

  if (input.kind === "MISSED_DAY") {
    return redistributeMissedLoad(input, editable, buffer, constraints);
  }
  return dampenAfterOverload(input, editable, buffer, constraints);
}

/** Un dia perdido se reparte entre los dias restantes del microciclo, dentro del margen. */
function redistributeMissedLoad(
  input: RecalculateInput,
  editable: AdjustableDay[],
  buffer: number,
  constraints: LoadConstraints,
): RecalculateResult {
  const targets = editable.filter(
    (d) => d.microcycleId === input.microcycleId && d.workType !== "DESCANSO",
  );
  if (targets.length === 0 || input.deltaUa <= 0) {
    return {
      adjustments: [],
      bufferStatus: "idle",
      unabsorbedUa: Math.max(0, Math.round(input.deltaUa)),
    };
  }

  const share = input.deltaUa / targets.length;
  const adjustments: DayAdjustment[] = [];
  let absorbed = 0;

  for (const day of targets) {
    const cap = day.plannedLoadUa * buffer;
    const added = Math.min(share, cap);
    if (added < 1) continue;
    const rpe = cappedRpe(day.rpeTarget, constraints);
    const minutes = roundTo5(
      clamp(
        (day.plannedLoadUa + added) / Math.max(1, rpe),
        MIN_SESSION_MINUTES,
        MAX_SESSION_MINUTES,
      ),
    );
    const adjusted = finalizeDay({
      date: day.date,
      workType: day.workType,
      rpe,
      minutes,
      constraints,
    });
    absorbed += adjusted.plannedLoadUa - day.plannedLoadUa;
    adjustments.push({
      date: day.date,
      microcycleId: day.microcycleId,
      workType: adjusted.workType,
      rpeTarget: adjusted.rpeTarget,
      durationMinutes: adjusted.durationMinutes,
      plannedLoadUa: adjusted.plannedLoadUa,
      reason: "Reparto de la carga de un dia perdido dentro del margen de recuperacion",
    });
  }

  const unabsorbed = Math.max(0, Math.round(input.deltaUa - absorbed));
  return {
    adjustments,
    bufferStatus: unabsorbed > 0 ? "exhausted" : "active",
    unabsorbedUa: unabsorbed,
  };
}

/**
 * Tras una sobrecarga aguda el dia siguiente pasa a recuperacion activa y el
 * resto del mesociclo se reduce proporcionalmente al exceso acumulado.
 */
function dampenAfterOverload(
  input: RecalculateInput,
  editable: AdjustableDay[],
  buffer: number,
  constraints: LoadConstraints,
): RecalculateResult {
  if (editable.length === 0) {
    return {
      adjustments: [],
      bufferStatus: "idle",
      unabsorbedUa: Math.max(0, Math.round(input.deltaUa)),
    };
  }

  const adjustments: DayAdjustment[] = [];
  const [nextDay, ...rest] = editable;
  let absorbed = 0;

  if (nextDay.workType !== "DESCANSO") {
    const recovery = finalizeDay({
      date: nextDay.date,
      workType: "RECUPERACION_ACTIVA",
      rpe: cappedRpe(3, constraints),
      minutes: 30,
      constraints,
    });
    absorbed += Math.max(0, nextDay.plannedLoadUa - recovery.plannedLoadUa);
    adjustments.push({
      date: recovery.date,
      microcycleId: nextDay.microcycleId,
      workType: recovery.workType,
      rpeTarget: recovery.rpeTarget,
      durationMinutes: recovery.durationMinutes,
      plannedLoadUa: recovery.plannedLoadUa,
      reason: "Sobrecarga aguda reportada: sesion convertida en recuperacion activa",
    });
  }

  const totalRemaining = sum(rest.map((d) => d.plannedLoadUa));
  const pending = Math.max(0, input.deltaUa - absorbed);
  const reduction =
    totalRemaining > 0 ? clamp(pending / totalRemaining, 0, buffer * 2) : 0;
  const factor = 1 - reduction;

  if (factor < 0.999) {
    for (const day of rest) {
      if (day.workType === "DESCANSO") continue;
      const rpe = cappedRpe(day.rpeTarget, constraints);
      const minutes = roundTo5(
        clamp(
          (day.plannedLoadUa * factor) / Math.max(1, rpe),
          MIN_SESSION_MINUTES,
          MAX_SESSION_MINUTES,
        ),
      );
      const adjusted = finalizeDay({
        date: day.date,
        workType: day.workType,
        rpe,
        minutes,
        constraints,
      });
      absorbed += day.plannedLoadUa - adjusted.plannedLoadUa;
      adjustments.push({
        date: adjusted.date,
        microcycleId: day.microcycleId,
        workType: adjusted.workType,
        rpeTarget: adjusted.rpeTarget,
        durationMinutes: adjusted.durationMinutes,
        plannedLoadUa: adjusted.plannedLoadUa,
        reason: "Descarga progresiva del mesociclo tras sobrecarga aguda",
      });
    }
  }

  const unabsorbed = Math.max(0, Math.round(input.deltaUa - absorbed));
  return {
    adjustments,
    bufferStatus: unabsorbed > 0 ? "exhausted" : "active",
    unabsorbedUa: unabsorbed,
  };
}

// ---------------------------------------------------------------------------

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function roundTo5(minutes: number): number {
  return Math.max(0, Math.round(minutes / 5) * 5);
}

function floorTo5(minutes: number): number {
  return Math.max(0, Math.floor(minutes / 5) * 5);
}

/** Normaliza a medianoche UTC para que el calendario no dependa de la zona horaria. */
export function stripTime(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/** Lunes de la semana ISO a la que pertenece la fecha, en UTC. */
function startOfIsoWeekUtc(date: Date): Date {
  const day = date.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addDays(date, offset);
}

function isSameDay(a: Date, b: Date): boolean {
  return differenceInCalendarDays(a, b) === 0;
}
