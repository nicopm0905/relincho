import {
  buildPeriodizationPlan,
  recalculatePlan,
  type AdjustableDay,
} from "../src/server/services/performance/periodization";
import {
  calcInternalLoad,
  fatigueZoneFor,
  isAcuteOverload,
  EXTRA_CONCENTRATE_GRAMS,
} from "../src/server/services/performance/load";
import { computeDailyPrescription } from "../src/server/services/nutrition/engine";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL  ${name}`, extra ?? "");
  } else {
    console.log(`ok    ${name}`);
  }
}

// --- 1. Carga interna y umbrales ------------------------------------------
check("45 min RPE 7 = 315 UA", calcInternalLoad(7, 45) === 315);
check("60 min RPE 8 = 480 UA", calcInternalLoad(8, 60) === 480);
check("120 UA -> BAJA -> 0 g", EXTRA_CONCENTRATE_GRAMS[fatigueZoneFor(120)] === 0);
check("315 UA -> MEDIA -> 400 g", EXTRA_CONCENTRATE_GRAMS[fatigueZoneFor(315)] === 400);
check("480 UA -> ALTA -> 800 g", EXTRA_CONCENTRATE_GRAMS[fatigueZoneFor(480)] === 800);

// --- 2. Plan hasta SICAB ---------------------------------------------------
const plan = buildPeriodizationPlan({
  startDate: new Date("2026-09-08T00:00:00Z"),
  targetDate: new Date("2026-11-15T00:00:00Z"),
  discipline: "DOMA_CLASICA",
});

console.log(
  "\nBloques:",
  plan.mesocycles
    .map((m) => `${m.phase}(${m.weeks}s)`)
    .join(" -> "),
  `| ${plan.totalWeeks} semanas`,
);

check(
  "todos los mesociclos duran 3-6 semanas",
  plan.mesocycles.every((m) => m.weeks >= 3 && m.weeks <= 6),
  plan.mesocycles.map((m) => m.weeks),
);
check(
  "la temporada empieza acumulando",
  plan.mesocycles[0].phase === "ACUMULACION" ||
    plan.mesocycles[0].phase === "TRANSICION",
  plan.mesocycles[0].phase,
);
check(
  "el ultimo bloque es Realizacion",
  plan.mesocycles[plan.mesocycles.length - 1].phase === "REALIZACION",
);
const allDays = plan.mesocycles.flatMap((m) => m.microcycles.flatMap((w) => w.days));
const compDay = allDays.find((d) => d.workType === "COMPETICION");
check(
  "el dia de la competicion esta marcado",
  compDay?.date.toISOString().slice(0, 10) === "2026-11-15",
  compDay?.date,
);
check(
  "vispera de competicion en descanso",
  allDays.find((d) => d.date.toISOString().slice(0, 10) === "2026-11-14")?.workType ===
    "DESCANSO",
);
const micros = plan.mesocycles.flatMap((m) => m.microcycles);
check(
  "cada microciclo tiene al menos 2 dias de descanso",
  micros.every((m) => m.days.filter((d) => d.workType === "DESCANSO").length >= 2),
);
check(
  "todos los microciclos cubren 7 dias",
  micros.every((m) => m.days.length === 7),
);
const acum = plan.mesocycles.find((m) => m.phase === "ACUMULACION");
const real = plan.mesocycles.find((m) => m.phase === "REALIZACION");
if (acum && real) {
  const acumWeek = acum.microcycles[1]?.plannedLoadUa ?? 0;
  const realWeek = real.microcycles[real.microcycles.length - 1].plannedLoadUa;
  check("el tapering baja la carga respecto a acumulacion", realWeek < acumWeek, {
    acumWeek,
    realWeek,
  });
}

// --- 3. Restricciones veterinarias ----------------------------------------
const restricted = buildPeriodizationPlan({
  startDate: new Date("2026-09-08T00:00:00Z"),
  targetDate: new Date("2026-11-15T00:00:00Z"),
  discipline: "SALTO",
  constraints: { tendonHistoryAlert: true, maxImpactSurfaceMinutes: 20 },
});
const restrictedDays = restricted.mesocycles.flatMap((m) =>
  m.microcycles.flatMap((w) => w.days),
);
check(
  "con alerta de tendon ningun dia supera RPE 8",
  restrictedDays.every((d) => d.rpeTarget <= 8),
);
check(
  "se respeta el techo de 20 min sobre superficie de impacto",
  restrictedDays.every((d) => d.impactSurfaceMinutes <= 20),
  Math.max(...restrictedDays.map((d) => d.impactSurfaceMinutes)),
);

// --- 4. Recalculo por dia perdido -----------------------------------------
const week = plan.mesocycles[0].microcycles[1];
const upcoming: AdjustableDay[] = week.days.slice(3).map((d) => ({
  date: d.date,
  phase: plan.mesocycles[0].phase,
  workType: d.workType,
  rpeTarget: d.rpeTarget,
  durationMinutes: d.durationMinutes,
  plannedLoadUa: d.plannedLoadUa,
  locked: false,
  microcycleId: "W1",
}));
const missed = recalculatePlan({
  kind: "MISSED_DAY",
  upcoming,
  microcycleId: "W1",
  deltaUa: week.days[2].plannedLoadUa,
  recoveryBufferPct: 15,
});
check("un dia perdido genera ajustes", missed.adjustments.length > 0);
check(
  "ningun dia crece mas del 15% + redondeo",
  missed.adjustments.every((adj) => {
    const before = upcoming.find((u) => u.date.getTime() === adj.date.getTime())!;
    return adj.plannedLoadUa <= before.plannedLoadUa * 1.2;
  }),
);

// --- 4b. Deteccion de sobrecarga aguda ------------------------------------
check(
  "trabajar por encima de lo previsto es sobrecarga",
  isAcuteOverload({ actualUa: 480, plannedUa: 300 }),
);
check(
  "cumplir lo planificado no es sobrecarga",
  !isAcuteOverload({ actualUa: 300, plannedUa: 300 }),
);
check(
  "un paseo suelto en dia de descanso no es sobrecarga",
  !isAcuteOverload({ actualUa: 120, plannedUa: 0 }),
);
check(
  "una sesion de verdad en dia de descanso si lo es",
  isAcuteOverload({ actualUa: 320, plannedUa: 0 }),
);
check(
  "la fatiga reportada por el jinete manda siempre",
  isAcuteOverload({ actualUa: 100, plannedUa: 300, riderReportedFatigue: true }),
);

// --- 5. Recalculo por sobrecarga aguda ------------------------------------
const overload = recalculatePlan({
  kind: "ACUTE_OVERLOAD",
  upcoming,
  microcycleId: "W1",
  deltaUa: 250,
  recoveryBufferPct: 15,
});
check(
  "el dia siguiente pasa a recuperacion activa",
  overload.adjustments[0]?.workType === "RECUPERACION_ACTIVA",
  overload.adjustments[0],
);

// El pico de forma no se toca nunca.
const taperDays: AdjustableDay[] = real!.microcycles[real!.microcycles.length - 1].days.map(
  (d) => ({
    date: d.date,
    phase: "REALIZACION",
    workType: d.workType,
    rpeTarget: d.rpeTarget,
    durationMinutes: d.durationMinutes,
    plannedLoadUa: d.plannedLoadUa,
    locked: false,
    microcycleId: "WT",
  }),
);
const taperResult = recalculatePlan({
  kind: "ACUTE_OVERLOAD",
  upcoming: taperDays,
  microcycleId: "WT",
  deltaUa: 500,
});
check(
  "la fase de Realizacion queda intacta",
  taperResult.adjustments.length === 0,
  taperResult.adjustments,
);

// --- 6. Nutricion: yegua gestante de 9 meses en Acumulacion ---------------
const mare = computeDailyPrescription({
  vet: {
    baseWeightKg: 520,
    reproductiveStatus: "GESTANTE",
    gestationMonth: 9,
    restrictions: ["tendencia_colico", "limitar_almidon"],
  },
  baseline: {
    baseForageKg: 9,
    baseConcentrateKg: 3,
    proteinPercentTarget: 12,
    mealsPerDay: 3,
    minForagePctBodyweight: 2,
    maxConcentrateKgPerDay: 4,
    maxConcentrateKgPerMeal: 1.2,
    maxElectrolytesGrams: 90,
    maxVitaminEIu: 5000,
  },
  training: {
    internalLoadUa: calcInternalLoad(8, 60),
    mesocyclePhase: "ACUMULACION",
    sweatLoss: "ALTA",
    ambientTempC: 32,
  },
});
console.log("\nRacion yegua gestante:", mare);
check("forraje >= 2% del peso vivo", mare.forageKg >= 10.4, mare.forageKg);
check("proteina objetivo 16%", mare.proteinPercentTarget >= 16);
check("al menos 4 tomas", mare.totalMeals >= 4);
check("electrolitos activados", mare.electrolytesGrams === 60);
check("concentrado dentro del techo veterinario", mare.concentrateKg <= 4);
check("se registra el recorte de seguridad", mare.clampNotes.length > 0, mare.clampNotes);

// Paseo suave: sin extra de pienso.
const walk = computeDailyPrescription({
  vet: { baseWeightKg: 500, reproductiveStatus: "NA" },
  baseline: {
    baseForageKg: 8,
    baseConcentrateKg: 1.5,
    proteinPercentTarget: 12,
    mealsPerDay: 3,
    minForagePctBodyweight: 1.5,
    maxConcentrateKgPerDay: 5,
    maxConcentrateKgPerMeal: 2,
    maxElectrolytesGrams: 90,
    maxVitaminEIu: 5000,
  },
  training: { internalLoadUa: calcInternalLoad(4, 30), mesocyclePhase: "ACUMULACION" },
});
check("paseo suave no anade concentrado", walk.extraConcentrateGrams === 0);
check("paseo suave no dispara electrolitos", walk.electrolytesGrams === 0);

// Dia de descanso en plena ola de calor: sin trabajo no hay que reponer sales.
const restDayRation = computeDailyPrescription({
  vet: { baseWeightKg: 500, reproductiveStatus: "NA" },
  baseline: {
    baseForageKg: 8,
    baseConcentrateKg: 1.5,
    proteinPercentTarget: 12,
    mealsPerDay: 3,
    minForagePctBodyweight: 1.5,
    maxConcentrateKgPerDay: 5,
    maxConcentrateKgPerMeal: 2,
    maxElectrolytesGrams: 90,
    maxVitaminEIu: 5000,
  },
  training: {
    internalLoadUa: 0,
    mesocyclePhase: "ACUMULACION",
    ambientTempC: 34,
  },
});
check(
  "un dia de descanso con calor no lleva electrolitos",
  restDayRation.electrolytesGrams === 0,
  restDayRation.electrolytesGrams,
);
check(
  "un dia de descanso no lleva concentrado extra",
  restDayRation.extraConcentrateGrams === 0,
);

console.log(`\n${failures === 0 ? "TODO OK" : failures + " COMPROBACIONES FALLIDAS"}`);
process.exit(failures === 0 ? 0 : 1);
