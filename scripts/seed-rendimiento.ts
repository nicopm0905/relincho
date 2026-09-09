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
import { projectNutrition } from "../src/server/services/nutrition/projection";

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

/**
 * Cuadra a sembrar. Se puede cambiar por linea de comandos:
 *   npm run seed:rendimiento -- --tenant=fincaolivos
 */
const TENANT_SLUG =
  process.argv
    .find((arg) => arg.startsWith("--tenant="))
    ?.split("=")[1] ?? "yeguada-demo-andalucia";

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

interface DemoHorse {
  id: string;
  name: string;
  sex: "MALE" | "FEMALE" | "GELDING";
}

/** Estado reproductivo coherente con el sexo del caballo de la cuadra. */
function defaultReproductiveStatus(sex: DemoHorse["sex"]) {
  if (sex === "MALE") return "SEMENTAL_EN_MONTA" as const;
  if (sex === "FEMALE") return "CICLANDO" as const;
  return "NA" as const;
}

/**
 * Reparte los papeles de la demo entre los caballos que ya tenga la cuadra, en
 * vez de exigir unos nombres concretos. La yegua gestante tiene que ser hembra;
 * el resto de papeles valen para cualquiera.
 */
async function assignRoles(tenantId: string) {
  const horses = await prisma.horse.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "IN_TRAINING"] } },
    select: { id: true, name: true, sex: true },
    orderBy: { name: "asc" },
  });
  if (horses.length < 5) {
    throw new Error(
      `La cuadra necesita al menos 5 caballos en activo para la demo y tiene ${horses.length}.`,
    );
  }

  const mare = horses.find((h) => h.sex === "FEMALE");
  if (!mare) throw new Error("La demo necesita al menos una yegua para el caso de gestacion.");

  const rest = horses.filter((h) => h.id !== mare.id);
  const [clean, tendon, overload, missed] = rest;

  return {
    clean: clean as DemoHorse,
    tendon: tendon as DemoHorse,
    overload: overload as DemoHorse,
    missed: missed as DemoHorse,
    mare: mare as DemoHorse,
  };
}

/** Codigo de chip legible y unico entre cuadras. */
function chipCode(slug: string, horseName: string, index: number, kind: string) {
  const tenantPart = slug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
  const horsePart = horseName.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
  return `${kind}-${tenantPart}${horsePart}-${String(index).padStart(4, "0")}`;
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

  const roles = await assignRoles(tenantId);
  const espartero = roles.clean;
  const brillante = roles.tendon;
  const llorona = roles.overload;
  const gallardo = roles.missed;
  const zalamera = roles.mare;

  console.log("Reparto de la demo:");
  console.log(`  Caso limpio ....... ${espartero.name}`);
  console.log(`  Alerta de tendón .. ${brillante.name}`);
  console.log(`  Sobrecarga aguda .. ${llorona.name}`);
  console.log(`  Día perdido ....... ${gallardo.name}`);
  console.log(`  Yegua gestante .... ${zalamera.name}
`);

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

  // La pantalla del mozo agrupa por ubicacion, asi que damos caja a quien no la
  // tenga. Nunca se pisa una ubicacion ya puesta por el usuario.
  const roleList = [espartero, brillante, llorona, gallardo, zalamera];
  for (const [index, horse] of roleList.entries()) {
    await prisma.horse.updateMany({
      where: { id: horse.id, OR: [{ boxLocation: null }, { boxLocation: "" }] },
      data: { boxLocation: `Box ${index + 1}` },
    });
  }

  // --- Chips fisicos -------------------------------------------------------
  const chips: [string, string, string][] = [
    [espartero.id, chipCode(TENANT_SLUG, espartero.name, 1, "NFC"), "NFC"],
    [zalamera.id, chipCode(TENANT_SLUG, zalamera.name, 2, "NFC"), "NFC"],
    [brillante.id, chipCode(TENANT_SLUG, brillante.name, 3, "RFID"), "RFID"],
    [llorona.id, chipCode(TENANT_SLUG, llorona.name, 4, "NFC"), "NFC"],
    [gallardo.id, chipCode(TENANT_SLUG, gallardo.name, 5, "NFC"), "NFC"],
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
      reproductiveStatus: defaultReproductiveStatus(espartero.sex),
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
      reproductiveStatus: defaultReproductiveStatus(brillante.sex),
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
      reproductiveStatus: defaultReproductiveStatus(llorona.sex),
      tendonHistoryAlert: false,
      restrictions: [],
    },
    {
      horseId: gallardo.id,
      discipline: "RAID" as const,
      baseWeightKg: 470,
      reproductiveStatus: defaultReproductiveStatus(gallardo.sex),
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
  // El caso limpio cumple lo planificado: el plan no se toca.
  for (let offset = -18; offset <= -1; offset++) {
    await reportPlannedDay({
      tenantId,
      horseId: espartero.id,
      offsetDays: offset,
      riderName: "Manuel Ortega",
    });
  }

  // El de tendón trabaja algo por debajo del plan tras su lesión de tendón.
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

  // Sobrecarga aguda hoy: el motor descarga el mesociclo.
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
    `Sobrecarga de ${llorona.name}: ${overload.internalLoadUa} UA (${overload.fatigueZone}), ` +
      `${overload.adjustments.length} días reajustados`,
  );

  // La sesion reportada confirma la racion de ese dia, igual que hace la app.
  await syncNutritionForDay({
    tenantId,
    horseId: llorona.id,
    date: day(0),
    internalLoadUa: overload.internalLoadUa,
    sweatLoss: "ALTA",
    isProjection: false,
  });

  // Pierde un día de trabajo: la carga se reparte por el microciclo.
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
    `Día perdido de ${gallardo.name}: ${missed.adjustments.length} días reajustados, ` +
      `margen ${missed.bufferStatus}`,
  );

  // --- Raciones del dia ----------------------------------------------------
  // La yegua gestante no entrena: solo paseo suave, pero es yegua gestante de nueve meses.
  const mare = await syncNutritionForDay({
    tenantId,
    horseId: zalamera.id,
    date: day(0),
    internalLoadUa: 120,
    sweatLoss: "BAJA",
    ambientTempC: 31,
  });
  console.log(
    `Ración de ${zalamera.name}: ${Number(mare.forageKg)} kg forraje, ` +
      `${Number(mare.concentrateKg)} kg concentrado en ${mare.totalMeals} tomas`,
  );

  // Dieta dia a dia de las proximas dos semanas, calculada sobre la carga
  // prevista para que el mozo vea la comida por adelantado.
  for (const horse of [espartero, brillante, llorona, gallardo]) {
    const projection = await projectNutrition({
      tenantId,
      horseId: horse.id,
      days: 14,
    });
    console.log(
      `Dieta proyectada de ${horse.name}: ${projection.written} días ` +
        `(${projection.skipped} ya confirmados por el jinete)`,
    );
  }

  console.log(`
Listo. Entra en /${TENANT_SLUG}/rendimiento`);
  console.log("Chips para probar el escáner:");
  for (const [horseId, chipId] of chips) {
    const horse = roleList.find((h) => h.id === horseId);
    console.log(`  ${chipId.padEnd(22)}${horse?.name ?? ""}`);
  }
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
