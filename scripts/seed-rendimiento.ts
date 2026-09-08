/**
 * Datos de prueba de los modulos de Rendimiento y Nutricion dinamica.
 *
 * Usa los servicios reales (no inserta planes a mano), asi que lo que queda en
 * la base de datos es exactamente lo que produce el motor en produccion.
 *
 * Ejecutar con:  npm run seed:rendimiento
 * (necesita la condicion react-server porque los servicios son "server-only")
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  generatePlan,
  markMissedDay,
  reportSession,
} from "../src/server/services/performance/plan-service";
import { syncNutritionForDay } from "../src/server/services/nutrition/sync";

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

const TENANT_SLUG = "yeguada-demo-andalucia";

/** Fecha a medianoche UTC, con desplazamiento en dias respecto a hoy. */
function day(offsetDays = 0): Date {
  const now = new Date();
  const utc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  utc.setUTCDate(utc.getUTCDate() + offsetDays);
  return utc;
}

/** Lunes anterior a la fecha dada, para que el plan arranque en semana completa. */
function previousMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

async function horseByName(tenantId: string, name: string) {
  const horse = await prisma.horse.findFirst({
    where: { tenantId, name },
    select: { id: true, name: true },
  });
  if (!horse) throw new Error(`No existe el caballo "${name}" en la cuadra demo`);
  return horse;
}

/**
 * Reporta la sesion siguiendo lo que el plan pedia ese dia, con la desviacion
 * indicada. Los dias de descanso se saltan: el mozo no inventa trabajo.
 */
async function reportPlannedDay(params: {
  tenantId: string;
  horseId: string;
  offsetDays: number;
  riderName: string;
  /** 1 = clava lo planificado; 1.2 = se pasa un 20%. */
  factor?: number;
  sweatLoss?: "BAJA" | "MEDIA" | "ALTA";
}) {
  const date = day(params.offsetDays);
  const planned = await prisma.dailyLoad.findFirst({
    where: { horseId: params.horseId, date },
    select: { workType: true, durationMinutes: true, rpeTarget: true },
  });
  if (!planned || planned.workType === "DESCANSO") return null;

  const factor = params.factor ?? 1;
  return reportSession({
    tenantId: params.tenantId,
    horseId: params.horseId,
    date,
    minutes: Math.round(planned.durationMinutes * factor),
    rpe: planned.rpeTarget,
    riderName: params.riderName,
    sweatLoss: params.sweatLoss ?? "MEDIA",
  });
}

/** Primera de las fechas propuestas que tenga trabajo previsto. */
async function firstWorkingDay(horseId: string, offsets: number[]): Promise<Date> {
  for (const offset of offsets) {
    const date = day(offset);
    const row = await prisma.dailyLoad.findFirst({
      where: { horseId, date, workType: { not: "DESCANSO" } },
      select: { id: true },
    });
    if (row) return date;
  }
  return day(offsets[0]);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    select: { id: true, name: true },
  });
  if (!tenant) throw new Error(`No existe la cuadra ${TENANT_SLUG}`);
  const tenantId = tenant.id;
  console.log(`Sembrando rendimiento en ${tenant.name}\n`);

  const espartero = await horseByName(tenantId, "Espartero VII");
  const zalamera = await horseByName(tenantId, "Zalamera IX");
  const brillante = await horseByName(tenantId, "Brillante III");
  const llorona = await horseByName(tenantId, "Llorona V");
  const gallardo = await horseByName(tenantId, "Gallardo XI");

  // Punto de partida limpio para poder relanzar la semilla las veces que haga falta.
  const seededHorseIds = [espartero, zalamera, brillante, llorona, gallardo].map(
    (h) => h.id,
  );
  await prisma.nutritionPrescription.deleteMany({
    where: { horseId: { in: seededHorseIds } },
  });
  await prisma.macrocycle.deleteMany({ where: { horseId: { in: seededHorseIds } } });
  await prisma.trainingSession.deleteMany({
    where: { horseId: { in: seededHorseIds } },
  });
  await prisma.chipTag.deleteMany({ where: { horseId: { in: seededHorseIds } } });
  await prisma.competitionTarget.deleteMany({
    where: { horseId: { in: seededHorseIds } },
  });

  // --- Chips fisicos -------------------------------------------------------
  const chips: [string, string, string][] = [
    [espartero.id, "NFC-ESP-0001", "NFC"],
    [zalamera.id, "NFC-ZAL-0002", "NFC"],
    [brillante.id, "RFID-BRI-0003", "RFID"],
    [llorona.id, "NFC-LLO-0004", "NFC"],
    [gallardo.id, "NFC-GAL-0005", "NFC"],
  ];
  for (const [horseId, chipId, kind] of chips) {
    await prisma.chipTag.create({ data: { tenantId, horseId, chipId, kind } });
  }
  console.log("Chips vinculados:", chips.map((c) => c[1]).join(", "));

  // --- Perfiles veterinarios ----------------------------------------------
  const vetProfiles = [
    {
      horseId: espartero.id,
      discipline: "DOMA_CLASICA" as const,
      baseWeightKg: 540,
      reproductiveStatus: "SEMENTAL_EN_MONTA" as const,
      tendonHistoryAlert: false,
      restrictions: [],
    },
    {
      horseId: zalamera.id,
      discipline: "FUNCIONALIDAD" as const,
      baseWeightKg: 520,
      reproductiveStatus: "GESTANTE" as const,
      gestationMonth: 9,
      tendonHistoryAlert: false,
      restrictions: ["tendencia_colico", "limitar_almidon"],
    },
    {
      horseId: brillante.id,
      discipline: "SALTO" as const,
      baseWeightKg: 560,
      reproductiveStatus: "NA" as const,
      tendonHistoryAlert: true,
      maxImpactSurfaceMinutes: 20,
      maxRpe: 8,
      restrictions: [],
      notes: "Tendinitis del flexor superficial en 2025. Trabajo en arena blanda.",
    },
    {
      horseId: llorona.id,
      discipline: "DOMA_VAQUERA" as const,
      baseWeightKg: 495,
      reproductiveStatus: "CICLANDO" as const,
      tendonHistoryAlert: false,
      restrictions: [],
    },
    {
      horseId: gallardo.id,
      discipline: "RAID" as const,
      baseWeightKg: 470,
      reproductiveStatus: "NA" as const,
      tendonHistoryAlert: false,
      restrictions: [],
    },
  ];
  for (const profile of vetProfiles) {
    await prisma.veterinaryProfile.upsert({
      where: { horseId: profile.horseId },
      update: profile,
      create: { tenantId, ...profile },
    });
  }

  // --- Dietas base y techos de seguridad -----------------------------------
  const baselines = [
    { horseId: espartero.id, baseForageKg: 9, baseConcentrateKg: 2.5, proteinPercentTarget: 12, mealsPerDay: 3, maxConcentrateKgPerDay: 5 },
    { horseId: zalamera.id, baseForageKg: 10, baseConcentrateKg: 3, proteinPercentTarget: 12, mealsPerDay: 3, minForagePctBodyweight: 2, maxConcentrateKgPerDay: 4, maxConcentrateKgPerMeal: 1.2 },
    { horseId: brillante.id, baseForageKg: 9.5, baseConcentrateKg: 2.5, proteinPercentTarget: 13, mealsPerDay: 3, maxConcentrateKgPerDay: 5.5 },
    { horseId: llorona.id, baseForageKg: 8.5, baseConcentrateKg: 2, proteinPercentTarget: 12, mealsPerDay: 3, maxConcentrateKgPerDay: 4.5 },
    { horseId: gallardo.id, baseForageKg: 8, baseConcentrateKg: 2.5, proteinPercentTarget: 13, mealsPerDay: 3, maxConcentrateKgPerDay: 5 },
  ];
  for (const baseline of baselines) {
    await prisma.nutritionBaseline.upsert({
      where: { horseId: baseline.horseId },
      update: baseline,
      create: { tenantId, ...baseline },
    });
  }
  console.log("Fichas veterinarias y dietas base creadas");

  // --- Competiciones objetivo ---------------------------------------------
  const sicab = await prisma.competitionTarget.create({
    data: {
      tenantId,
      horseId: espartero.id,
      name: "SICAB",
      targetDate: day(68),
      priority: "ALTA",
    },
  });
  const copa = await prisma.competitionTarget.create({
    data: {
      tenantId,
      horseId: brillante.id,
      name: "Copa Andalucía de Salto",
      targetDate: day(61),
      priority: "ALTA",
    },
  });
  const vaquera = await prisma.competitionTarget.create({
    data: {
      tenantId,
      horseId: llorona.id,
      name: "Campeonato de Doma Vaquera",
      targetDate: day(54),
      priority: "MEDIA",
    },
  });
  const raid = await prisma.competitionTarget.create({
    data: {
      tenantId,
      horseId: gallardo.id,
      name: "Raid de Jerez",
      targetDate: day(75),
      priority: "ALTA",
    },
  });

  // --- Lesion previa, para que el escaneo del chip la muestre ---------------
  await prisma.healthEvent.create({
    data: {
      tenantId,
      horseId: brillante.id,
      type: "INJURY",
      name: "Tendinitis flexor digital superficial (anterior izquierdo)",
      date: day(-320),
      notes: "Ocho semanas de reposo y vuelta progresiva. Ecografía de control limpia.",
    },
  });

  // El plan arranca tres semanas atras para que haya historial que enseñar.
  const startDate = previousMonday(day(-21));

  // --- Planes de periodizacion --------------------------------------------
  const plans = [
    { horse: espartero, target: sicab, discipline: "DOMA_CLASICA" as const },
    { horse: brillante, target: copa, discipline: "SALTO" as const },
    { horse: llorona, target: vaquera, discipline: "DOMA_VAQUERA" as const },
    { horse: gallardo, target: raid, discipline: "RAID" as const },
  ];
  for (const plan of plans) {
    const result = await generatePlan({
      tenantId,
      horseId: plan.horse.id,
      competitionTargetId: plan.target.id,
      startDate,
      discipline: plan.discipline,
    });
    console.log(
      `Plan de ${plan.horse.name}: ${result.totalWeeks} semanas, ` +
        `${result.mesocycles} bloques, objetivo ${plan.target.name}`,
    );
  }

  // --- Sesiones ya ejecutadas ----------------------------------------------
  // Espartero cumple lo planificado: el plan no se toca.
  for (let offset = -18; offset <= -1; offset++) {
    await reportPlannedDay({
      tenantId,
      horseId: espartero.id,
      offsetDays: offset,
      riderName: "Manuel Ortega",
    });
  }

  // Brillante trabaja algo por debajo del plan tras su lesión de tendón.
  for (let offset = -18; offset <= -1; offset++) {
    await reportPlannedDay({
      tenantId,
      horseId: brillante.id,
      offsetDays: offset,
      riderName: "Lucía Cabrera",
      factor: 0.9,
      sweatLoss: "BAJA",
    });
  }

  // Llorona sufre una sobrecarga aguda hoy: el motor descarga el mesociclo.
  for (let offset = -18; offset <= -1; offset++) {
    await reportPlannedDay({
      tenantId,
      horseId: llorona.id,
      offsetDays: offset,
      riderName: "Ana Ruiz",
    });
  }
  const overloadDate = await firstWorkingDay(llorona.id, [0, 1, -1]);
  const overload = await reportSession({
    tenantId,
    horseId: llorona.id,
    date: overloadDate,
    minutes: 70,
    rpe: 9,
    riderName: "Ana Ruiz",
    notes: "Se ha venido arriba en el galope, ha acabado muy justa y sudando mucho.",
    sweatLoss: "ALTA",
    riderReportedFatigue: true,
  });
  console.log(
    `Sobrecarga de Llorona V: ${overload.internalLoadUa} UA (${overload.fatigueZone}), ` +
      `${overload.adjustments.length} días reajustados`,
  );

  // Gallardo pierde un día de trabajo: la carga se reparte por el microciclo.
  for (let offset = -18; offset <= -3; offset++) {
    await reportPlannedDay({
      tenantId,
      horseId: gallardo.id,
      offsetDays: offset,
      riderName: "Diego Salas",
    });
  }
  const missedDate = await firstWorkingDay(gallardo.id, [-2, -1, 0]);
  const missed = await markMissedDay({
    tenantId,
    horseId: gallardo.id,
    date: missedDate,
    reason: "Herrado de urgencia",
  });
  console.log(
    `Día perdido de Gallardo XI: ${missed.adjustments.length} días reajustados, ` +
      `margen ${missed.bufferStatus}`,
  );

  // --- Raciones del dia ----------------------------------------------------
  // Zalamera no entrena: solo paseo suave, pero es yegua gestante de nueve meses.
  const mare = await syncNutritionForDay({
    tenantId,
    horseId: zalamera.id,
    date: day(0),
    internalLoadUa: 120,
    sweatLoss: "BAJA",
    ambientTempC: 31,
  });
  console.log(
    `Ración de Zalamera IX: ${Number(mare.forageKg)} kg forraje, ` +
      `${Number(mare.concentrateKg)} kg concentrado en ${mare.totalMeals} tomas`,
  );

  for (const horse of [espartero, brillante, gallardo, llorona]) {
    await syncNutritionForDay({
      tenantId,
      horseId: horse.id,
      date: day(0),
      sweatLoss: "MEDIA",
      ambientTempC: 31,
    });
  }

  console.log("\nListo. Entra en /yeguada-demo-andalucia/rendimiento");
  console.log("Chips para probar el escáner: NFC-ESP-0001, RFID-BRI-0003, NFC-LLO-0004");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
