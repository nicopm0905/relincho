/**
 * Yeguada de demostración para presentaciones en directo (inversores, socios).
 *
 * Uso:   npm run db:seed:demo
 *        DEMO_OWNER_EMAILS="tu@gmail.com" npm run db:seed:demo
 *        npm run db:seed:demo -- --publica   (demo pública del QR; después
 *        `npm run seed:rendimiento` para su módulo de entrenamiento)
 *
 * - Idempotente: borra la yeguada de demo entera y la vuelve a crear. Solo toca
 *   el tenant DEMO_SLUG; se niega a trabajar con cualquier otro.
 * - Fechas relativas a HOY: ejecútalo el día antes de la demo y todo cae en su
 *   sitio (partos en los próximos días, ecografías de esta semana, yeguas en
 *   celo ahora). Con datos de hace un mes la demo enseña alertas caducadas.
 * - No es la demo pública del QR (`yeguada-demo-andalucia`, solo lectura): esta
 *   pide sesión. DEMO_OWNER_EMAILS da acceso de propietario a usuarios que YA
 *   existan (p. ej. tu cuenta de Google); no crea usuarios nuevos.
 * - Los nombres de caballos, personas y empresas son inventados.
 */
import { PrismaClient, type CoveringMethod, type HealthEventType, type Sex } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// `--publica` siembra los mismos datos en la demo pública del QR (solo lectura).
const PUBLIC_DEMO = process.argv.includes("--publica");
const DEMO_SLUG = PUBLIC_DEMO ? "yeguada-demo-andalucia" : "yeguada-valdeolivo";
const DEMO_NAME = PUBLIC_DEMO ? "Yeguada Demo Andalucía" : "Yeguada Valdeolivo";
const DEMO_USER_EMAIL = "demo@equigest.es";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ── Fechas ────────────────────────────────────────────────────────────────

const NOW = new Date();
const DAY_MS = 24 * 60 * 60 * 1000;

/** `offset` días desde hoy a la hora dada; nunca en el futuro si offset es 0. */
function day(offset: number, hour = 10): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offset);
  d.setHours(hour, 0, 0, 0);
  if (offset === 0 && d > NOW) return new Date(NOW.getTime() - 60 * 60 * 1000);
  return d;
}

const yearsAgo = (years: number, month = 3, dayOfMonth = 15) =>
  new Date(NOW.getFullYear() - years, month - 1, dayOfMonth);

const past = (d: Date) => d.getTime() <= NOW.getTime();

// ── Identificadores verosímiles ───────────────────────────────────────────

let serial = 0;
function identifiers() {
  serial += 1;
  const n = String(serial).padStart(4, "0");
  return {
    uelnCode: `72400910${String(2000000 + serial * 37).slice(0, 7)}`,
    microchip: `94100002${String(1000000 + serial * 7919).slice(0, 7)}`,
    lgNumber: `PRE-${String(48000 + serial * 13)}-${n}`,
  };
}

// ── Contexto ──────────────────────────────────────────────────────────────

let tenantId = "";

type HorseInput = {
  name: string;
  sex: Sex;
  coat: string;
  birthDate: Date;
  status?: "ACTIVE" | "DEAD" | "RETIRED" | "IN_TRAINING" | "SOLD";
  sireId?: string | null;
  damId?: string | null;
  boxLocation?: string;
  ownerId?: string | null;
  weightKg?: number;
  /** Ancestros fuera de la yeguada: sin UELN ni microchip de esta explotación. */
  ancestor?: boolean;
};

async function horse(input: HorseInput) {
  const ids = input.ancestor ? { uelnCode: null, microchip: null, lgNumber: identifiers().lgNumber } : identifiers();
  const created = await prisma.horse.create({
    data: {
      tenantId,
      name: input.name,
      sex: input.sex,
      coat: input.coat,
      breed: "PRE",
      birthDate: input.birthDate,
      status: input.status ?? "ACTIVE",
      sireId: input.sireId ?? null,
      damId: input.damId ?? null,
      boxLocation: input.boxLocation ?? null,
      currentOwnerId: input.ownerId ?? null,
      hierro: input.ancestor ? null : "VO",
      excludedFromFoodChain: !input.ancestor,
      ...ids,
    },
  });
  if (input.weightKg) {
    await prisma.veterinaryProfile.create({
      data: { tenantId, horseId: created.id, baseWeightKg: input.weightKg },
    });
  }
  return created;
}

const cycles = new Map<string, string>();

/** Temporada de la yegua para ese año (una por año, se reutiliza). */
async function cycle(mareId: string, season: number, category?: string) {
  const key = `${mareId}:${season}`;
  const existing = cycles.get(key);
  if (existing) return existing;
  const created = await prisma.reproductionCycle.create({
    data: { tenantId, mareId, season, category: category ?? null },
  });
  cycles.set(key, created.id);
  return created.id;
}

type CoverOpts = {
  stallionId?: string;
  external?: string;
  method?: CoveringMethod;
  semenBatchId?: string;
  dosesUsed?: number;
  /** Resultado de cada ecografía hecha (detección 15, latido 30, confirmación 50). */
  checks?: ("POSITIVE" | "NEGATIVE" | "REABSORBED" | "TWINS")[];
  /** Si no se da `checks`, se hacen las que ya tocaban, todas positivas. */
  autoChecks?: boolean;
  /** Ecografías que se dejan sin hacer al final (para que haya alguna pendiente). */
  skipLastChecks?: number;
};

const CHECK_DAYS = [15, 30, 50];

/** Exploraciones del celo que llevó a la cubrición: folículo creciendo y ovulación. */
async function heatBefore(mareId: string, cycleId: string, coverDate: Date) {
  const steps = [
    { d: -4, f: 27, edema: 1, teasing: 2 },
    { d: -2, f: 33, edema: 2, teasing: 3 },
    { d: 0, f: 38, edema: 3, teasing: 4 },
  ];
  for (const s of steps) {
    const date = new Date(coverDate.getTime() + s.d * DAY_MS - 2 * 60 * 60 * 1000);
    if (!past(date)) continue;
    await prisma.reproExam.create({
      data: {
        tenantId,
        cycleId,
        mareId,
        date,
        teasingScore: s.teasing,
        leftFollicleMm: s.f,
        rightFollicleMm: 18,
        uterineEdema: s.edema,
        corpusLuteum: "NONE",
        cervix: s.d === 0 ? "OPEN" : "RELAXING",
        treatments: s.d === 0 ? ["HCG"] : [],
      },
    });
  }
  const ovDate = new Date(coverDate.getTime() + 36 * 60 * 60 * 1000);
  if (past(ovDate)) {
    await prisma.reproExam.create({
      data: {
        tenantId,
        cycleId,
        mareId,
        date: ovDate,
        ovulated: true,
        ovulationSide: "LEFT",
        corpusLuteum: "LEFT",
        uterineEdema: 0,
        uterineFluidMm: 0,
        cervix: "CLOSED",
      },
    });
  }
}

async function cover(mareId: string, coverDate: Date, opts: CoverOpts, category?: string) {
  const cycleId = await cycle(mareId, coverDate.getFullYear(), category);
  await heatBefore(mareId, cycleId, coverDate);
  const covering = await prisma.covering.create({
    data: {
      tenantId,
      cycleId,
      mareId,
      stallionId: opts.stallionId ?? null,
      externalStallionName: opts.external ?? null,
      method: opts.method ?? "NATURAL",
      semenBatchId: opts.semenBatchId ?? null,
      dosesUsed: opts.dosesUsed ?? null,
      date: coverDate,
    },
  });

  let results = opts.checks;
  if (!results && opts.autoChecks !== false) {
    results = CHECK_DAYS.map(() => "POSITIVE" as const);
  }
  const due = (results ?? [])
    .map((result, i) => ({ result, date: new Date(coverDate.getTime() + CHECK_DAYS[i]! * DAY_MS) }))
    .filter((c) => past(c.date));
  const done = opts.skipLastChecks ? due.slice(0, Math.max(0, due.length - opts.skipLastChecks)) : due;
  for (const [i, c] of done.entries()) {
    await prisma.pregnancyCheck.create({
      data: {
        tenantId,
        coveringId: covering.id,
        date: c.date,
        result: c.result,
        dayOfPregnancy: CHECK_DAYS[i],
        vesicleMm: i === 0 && c.result === "POSITIVE" ? 18 : null,
        heartbeat: i >= 1 && c.result === "POSITIVE" ? true : null,
      },
    });
  }
  return covering;
}

async function foal(
  coveringId: string,
  date: Date,
  foalInput: Omit<HorseInput, "birthDate">,
  extra: { placentaMinutes?: number } = {},
) {
  const born = await horse({ ...foalInput, birthDate: date });
  await prisma.foaling.create({
    data: {
      tenantId,
      coveringId,
      foalId: born.id,
      date,
      sex: foalInput.sex,
      alive: true,
      foalStoodMinutes: 45,
      foalSuckledMinutes: 95,
      placentaMinutes: extra.placentaMinutes ?? 110,
      meconiumPassed: true,
      foalIggMgDl: 920,
      birthWeightKg: foalInput.sex === "MALE" ? 52.5 : 49,
    },
  });
  await prisma.movement.create({
    data: { tenantId, horseId: born.id, direction: "IN", date, cause: "NACIMIENTO", reason: "Nacimiento en la explotación" },
  });
  return born;
}

async function health(
  horseId: string,
  type: HealthEventType,
  name: string,
  date: Date,
  nextDueDate: Date | null,
  extra: { cost?: number; withdrawalDays?: number; durationDays?: number; dose?: string; vetId?: string } = {},
) {
  await prisma.healthEvent.create({
    data: {
      tenantId,
      horseId,
      type,
      name,
      date,
      nextDueDate,
      cost: extra.cost ?? null,
      withdrawalDays: extra.withdrawalDays ?? null,
      durationDays: extra.durationDays ?? null,
      dose: extra.dose ?? null,
      vetContactId: extra.vetId ?? null,
    },
  });
}

// ── Limpieza ──────────────────────────────────────────────────────────────

async function wipe() {
  const existing = await prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
  if (!existing) return;
  if (existing.slug !== DEMO_SLUG) throw new Error("Guarda: slug inesperado");
  const where = { tenantId: existing.id };
  // Si en la demo se emitió una factura: los registros Veri*Factu no dejan
  // borrar su factura (Restrict) y una rectificativa tampoco a su original.
  // Borrar sí está permitido (los triggers solo impiden modificar).
  await prisma.verifactuRecord.deleteMany({ where });
  await prisma.invoice.deleteMany({ where: { ...where, rectifiesId: { not: null } } });
  await prisma.invoice.deleteMany({ where });
  await prisma.boardingContract.deleteMany({ where });
  // Covering.mare no borra en cascada: hay que quitar las cubriciones antes
  // que los caballos. SemenBatch y Movement no cuelgan del tenant.
  await prisma.foaling.deleteMany({ where });
  await prisma.covering.deleteMany({ where });
  await prisma.semenBatch.deleteMany({ where });
  await prisma.horse.updateMany({ where, data: { sireId: null, damId: null } });
  await prisma.tenant.delete({ where: { id: existing.id } });
  console.log(`  borrada la yeguada anterior (${DEMO_SLUG})`);
}

// ── Datos ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Sembrando ${DEMO_SLUG} con fecha de referencia ${NOW.toISOString().slice(0, 10)}`);
  await wipe();

  const tenant = await prisma.tenant.create({
    data: {
      slug: DEMO_SLUG,
      name: DEMO_NAME,
      fiscalName: `${DEMO_NAME} S.L.`,
      // NIF ficticio con dígito de control válido: la emisión lo comprueba.
      nif: "B92736156",
      address: "Carretera de Arcos, km 6",
      city: "Jerez de la Frontera",
      province: "Cádiz",
      postalCode: "11408",
      regaCode: "ES110200000123",
      plan: "yeguada",
      billingModule: true,
      verifactuMode: "VERIFACTU",
      paymentTerms: "Pago a 30 días por transferencia",
    },
  });
  tenantId = tenant.id;

  // Acceso: el usuario de demo y, si se piden, cuentas reales ya existentes.
  const demoUser = await prisma.user.upsert({
    where: { email: DEMO_USER_EMAIL },
    update: {},
    create: { email: DEMO_USER_EMAIL, name: "Demo Propietario" },
  });
  const ownerEmails = (process.env.DEMO_OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const owners = await prisma.user.findMany({ where: { email: { in: ownerEmails } } });
  for (const missing of ownerEmails.filter((e) => !owners.some((o) => o.email?.toLowerCase() === e))) {
    console.warn(`  aviso: ${missing} no existe como usuario; entra una vez en la app y repite`);
  }
  for (const user of [demoUser, ...owners]) {
    await prisma.membership.create({ data: { userId: user.id, tenantId, role: "OWNER" } });
  }

  // Contactos
  const vet = await prisma.contact.create({
    data: { tenantId, kind: "VET", name: "Clínica Veterinaria El Arenal", phone: "956000111", email: "consulta@example.com" },
  });
  await prisma.contact.create({ data: { tenantId, kind: "FARRIER", name: "Herrador Manuel Ortega", phone: "600000222" } });
  const ownerA = await prisma.contact.create({
    data: {
      tenantId, kind: "OWNER", name: "Hacienda Los Llanos", nif: "B91847368", email: "admin@example.com",
      address: "Camino de la Ermita, 12, 11408 Jerez de la Frontera (Cádiz)",
    },
  });
  const ownerB = await prisma.contact.create({
    data: {
      tenantId, kind: "OWNER", name: "Carmen Navarro Ruiz", nif: "48207315M", email: "carmen@example.com",
      address: "Calle Larga, 8, 11500 El Puerto de Santa María (Cádiz)",
    },
  });

  // ── Pedigrí: tres generaciones por encima de las yeguas jóvenes ─────────
  const anc = (name: string, sex: Sex, coat: string, born: number, sireId?: string, damId?: string, status: HorseInput["status"] = "DEAD") =>
    horse({ name, sex, coat, birthDate: yearsAgo(born), sireId, damId, status, ancestor: true });

  const hosco = await anc("Hosco II", "MALE", "Tordo", 32);
  const bilbaina = await anc("Bilbaína VII", "FEMALE", "Castaño", 31);
  const majestuoso = await anc("Majestuoso IV", "MALE", "Tordo", 33);
  const calesera = await anc("Calesera X", "FEMALE", "Tordo", 30);
  const nevado = await anc("Nevado III", "MALE", "Tordo", 31);
  const morena = await anc("Morena XXI", "FEMALE", "Negro", 30);
  const brioso = await anc("Brioso IX", "MALE", "Castaño", 32);
  const tamborilera = await anc("Tamborilera II", "FEMALE", "Tordo", 29);
  const destinado = await anc("Destinado I", "MALE", "Negro", 31);
  const navarra = await anc("Navarra IX", "FEMALE", "Tordo", 30);
  const fogoso = await anc("Fogoso II", "MALE", "Tordo", 32);
  const altanera = await anc("Altanera V", "FEMALE", "Castaño", 29);

  const albero = await anc("Albero V", "MALE", "Tordo", 24, hosco.id, bilbaina.id);
  const sevillana = await anc("Sevillana XII", "FEMALE", "Tordo", 23, majestuoso.id, calesera.id);
  const lucero = await anc("Lucero XXX", "MALE", "Tordo", 23, nevado.id, morena.id);
  const romera = await anc("Romera IV", "FEMALE", "Castaño", 22, brioso.id, tamborilera.id);
  const campero = await anc("Campero VI", "MALE", "Negro", 24, destinado.id, navarra.id);
  const giralda = await anc("Giralda III", "FEMALE", "Tordo", 22, fogoso.id, altanera.id);

  // ── Sementales de la casa ────────────────────────────────────────────────
  const embajador = await horse({
    name: "Embajador XLII", sex: "MALE", coat: "Tordo", birthDate: yearsAgo(14, 4, 2),
    sireId: albero.id, damId: sevillana.id, boxLocation: "Sementales 1", weightKg: 560,
  });
  const galante = await horse({
    name: "Galante CXIV", sex: "MALE", coat: "Tordo", birthDate: yearsAgo(12, 5, 20),
    sireId: lucero.id, damId: romera.id, boxLocation: "Sementales 2", weightKg: 545,
  });
  const jerezano = await horse({
    name: "Jerezano VIII", sex: "MALE", coat: "Castaño", birthDate: yearsAgo(7, 3, 9),
    sireId: campero.id, damId: sevillana.id, boxLocation: "Sementales 3", weightKg: 520,
  });
  await prisma.movement.create({
    data: {
      tenantId, horseId: jerezano.id, direction: "IN", date: yearsAgo(3, 9, 12), cause: "COMPRA",
      originRega: "ES110200000456", reason: "Compra como semental joven", documentType: "Documento de movimiento",
      documentNumber: "DM-2023-004512", transporterName: "Transportes Ecuestres del Sur (ATES-41-0087)",
      vehiclePlate: "4821 KLM", trailerPlate: "SE-03917-R",
    },
  });

  // Semen: congelado de un semental de fuera (con coste) y refrigerado propio.
  const frozen = await prisma.semenBatch.create({
    data: {
      tenantId, externalStallionName: "Emperador XVI", semenType: "FROZEN",
      provider: "Centro de reproducción equina La Vega", dosesTotal: 16,
      collectedAt: yearsAgo(1, 11, 3), location: "Tanque 1 · canastilla 2", costPerDose: 450,
    },
  });
  const chilled = await prisma.semenBatch.create({
    data: {
      tenantId, stallionId: jerezano.id, semenType: "REFRIGERATED", dosesTotal: 12,
      collectedAt: day(-160), location: "Laboratorio", costPerDose: 60,
    },
  });

  // ── Yeguas ──────────────────────────────────────────────────────────────
  let box = 0;
  const mare = (name: string, coat: string, age: number, sireId?: string, damId?: string, extra: Partial<HorseInput> = {}) => {
    box += 1;
    return horse({
      name, sex: "FEMALE", coat, birthDate: yearsAgo(age, ((box * 5) % 12) + 1, ((box * 7) % 27) + 1),
      sireId, damId, boxLocation: box <= 14 ? `Box ${box}` : `Cercado ${box <= 20 ? 1 : 2}`,
      weightKg: 470 + ((box * 13) % 80), ...extra,
    });
  };

  // Yeguas fundadoras (madres de las jóvenes)
  const betica = await mare("Bética XX", "Tordo", 16, campero.id, giralda.id);
  const soberana = await mare("Soberana II", "Tordo", 15, lucero.id, sevillana.id);
  // Yeguas jóvenes con pedigrí completo: las de la demo
  const ilusionada = await mare("Ilusionada IV", "Tordo", 7, embajador.id, betica.id);
  const duquesa = await mare("Duquesa XIV", "Castaño", 8, galante.id, betica.id);
  const altiva = await mare("Altiva LXV", "Tordo", 9, embajador.id, soberana.id);
  const candela = await mare("Candela VII", "Negro", 6, galante.id, soberana.id, { ownerId: ownerA.id });

  const others = [];
  const names: [string, string, number][] = [
    ["Giralda XXIV", "Tordo", 11], ["Morisca III", "Castaño", 13], ["Lucera IX", "Tordo", 10],
    ["Triana XVII", "Tordo", 12], ["Macarena VI", "Negro", 9], ["Navarra XXXI", "Tordo", 14],
    ["Gitana XL", "Castaño", 8], ["Esperanza XII", "Tordo", 17], ["Alhambra V", "Tordo", 10],
    ["Marisma II", "Bayo", 9], ["Sultana XVIII", "Tordo", 12], ["Callejera IV", "Castaño", 11],
    ["Rociera IX", "Tordo", 7], ["Fortuna XXII", "Tordo", 15], ["Bonita LIII", "Negro", 6],
    ["Señorita X", "Tordo", 5], ["Aurora XIX", "Tordo", 4], ["Primorosa II", "Castaño", 4],
    ["Valerosa VI", "Tordo", 13], ["Cartujana VIII", "Tordo", 10],
  ];
  for (const [i, [name, coat, age]] of names.entries()) {
    const sire = i % 3 === 0 ? embajador.id : i % 3 === 1 ? galante.id : undefined;
    const dam = i % 5 === 0 ? betica.id : i % 5 === 2 ? soberana.id : undefined;
    others.push(await mare(name, coat, age, sire, age >= 12 ? undefined : dam, i % 7 === 3 ? { ownerId: ownerB.id } : {}));
  }
  const [
    giraldaXXIV, morisca, lucera, triana, macarena, navarraXXXI, gitana, esperanza, alhambra, marisma,
    sultana, callejera, rociera, fortuna, bonita, senorita, aurora, primorosa, valerosa, cartujana,
  ] = others;

  // ── Situación reproductiva de cada yegua ──────────────────────────────────

  // Parto inminente (cubiertas a finales de la temporada anterior)
  const fsBetica = await cover(betica.id, day(-331, 11), { stallionId: embajador.id }, "FOALING");
  await cover(duquesa.id, day(-322, 12), { stallionId: galante.id }, "FOALING");
  await cover(navarraXXXI!.id, day(-314, 10), { method: "AI_FROZEN", external: "Emperador XVI", semenBatchId: frozen.id, dosesUsed: 2 }, "BARREN");
  for (const [d, udder, wax, calcium] of [[-3, 1, false, 90], [-1, 2, false, 160], [0, 3, true, 240]] as const) {
    await prisma.foalingWatch.create({
      data: { tenantId, coveringId: fsBetica.id, date: day(d, 8), udderScore: udder, wax, milkCalciumPpm: calcium, relaxation: d === 0 },
    });
  }

  // Recién paridas (celo del potro por delante)
  const ppSoberana = await cover(soberana.id, day(-346, 10), { stallionId: galante.id }, "FOALING");
  const ppMorisca = await cover(morisca!.id, day(-352, 9), { stallionId: embajador.id }, "FOALING");
  await foal(ppSoberana.id, day(-6, 4), {
    name: "Soberano", sex: "MALE", coat: "Castaño", sireId: galante.id, damId: soberana.id, boxLocation: "Paridera 1",
  });
  await foal(ppMorisca.id, day(-12, 3), {
    name: "Morisquilla", sex: "FEMALE", coat: "Negro", sireId: embajador.id, damId: morisca!.id, boxLocation: "Paridera 2",
  });
  await cycle(soberana.id, NOW.getFullYear(), "FOALING");
  await cycle(morisca!.id, NOW.getFullYear(), "FOALING");

  // Gestantes de esta temporada. Cuatro de ellas parieron en primavera: su
  // potro está en la cuadra y la cubrieron en el celo del potro.
  const springFoals: [typeof ilusionada, number, string, Sex, string][] = [
    [ilusionada, -165, "Ilusión", "FEMALE", "Tordo"],
    [altiva, -190, "Altivo", "MALE", "Tordo"],
    [lucera!, -205, "Lucerito", "MALE", "Castaño"],
    [triana!, -178, "Trianera", "FEMALE", "Tordo"],
  ];
  for (const [m, foalDay, foalName, sex, coat] of springFoals) {
    const prev = await cover(m.id, day(foalDay - 338, 10), { stallionId: embajador.id }, "FOALING");
    await foal(prev.id, day(foalDay, 5), { name: foalName, sex, coat, sireId: embajador.id, damId: m.id, boxLocation: "Cercado de potros" });
  }

  await cover(ilusionada.id, day(-150, 10), { stallionId: galante.id }, "FOALING"); // vacuna EHV del 5.º mes, hoy
  await cover(altiva.id, day(-178, 11), { method: "AI_FROZEN", external: "Emperador XVI", semenBatchId: frozen.id, dosesUsed: 2 }, "FOALING");
  await cover(lucera!.id, day(-193, 10), { stallionId: embajador.id }, "FOALING");
  await cover(triana!.id, day(-166, 12), { method: "AI_REFRIGERATED", stallionId: jerezano.id, semenBatchId: chilled.id, dosesUsed: 1 }, "FOALING");
  // Dos ciclos para quedarse: primero vacía, luego gestante.
  await cover(macarena!.id, day(-212, 10), { stallionId: galante.id, checks: ["NEGATIVE"] }, "BARREN");
  await cover(macarena!.id, day(-190, 10), { stallionId: galante.id });
  await cover(gitana!.id, day(-120, 10), { method: "AI_FROZEN", external: "Emperador XVI", semenBatchId: frozen.id, dosesUsed: 3 }, "MAIDEN");
  await cover(esperanza!.id, day(-96, 9), { stallionId: embajador.id }, "BARREN");
  // Ecografías pendientes esta semana
  await cover(alhambra!.id, day(-31, 10), { stallionId: jerezano.id, method: "AI_REFRIGERATED", semenBatchId: chilled.id, dosesUsed: 1, skipLastChecks: 1 }, "MAIDEN"); // latido
  await cover(candela.id, day(-52, 10), { stallionId: galante.id, skipLastChecks: 1 }, "MAIDEN"); // confirmación

  // Cubiertas, pendientes de diagnóstico
  await cover(marisma!.id, day(-14, 10), { stallionId: embajador.id, autoChecks: false }, "BARREN"); // detección hoy
  await cover(sultana!.id, day(-8, 11), { stallionId: galante.id, autoChecks: false }, "BARREN");
  await cover(callejera!.id, day(-3, 9), { method: "AI_REFRIGERATED", stallionId: jerezano.id, semenBatchId: chilled.id, dosesUsed: 1, autoChecks: false }, "MAIDEN");

  // En celo ahora mismo: seguimiento folicular de los últimos días
  for (const [m, last] of [[rociera!, 38], [fortuna!, 34], [giraldaXXIV!, 31]] as const) {
    const cycleId = await cycle(m.id, NOW.getFullYear(), "BARREN");
    // Una ovulación anterior para que el motor aprenda su ciclo.
    await prisma.reproExam.create({
      data: { tenantId, cycleId, mareId: m.id, date: day(-24, 9), ovulated: true, ovulationSide: "RIGHT", corpusLuteum: "RIGHT" },
    });
    const series = [
      { d: -4, f: last - 11, edema: 1, teasing: 1 },
      { d: -2, f: last - 6, edema: 2, teasing: 2 },
      { d: 0, f: last, edema: 3, teasing: 4 },
    ];
    for (const s of series) {
      await prisma.reproExam.create({
        data: {
          tenantId, cycleId, mareId: m.id, date: day(s.d, 9), teasingScore: s.teasing,
          rightFollicleMm: s.f, leftFollicleMm: 20, uterineEdema: s.edema, corpusLuteum: "NONE", cervix: "RELAXING",
        },
      });
    }
  }

  // En seguimiento (diestro): ovuló hace poco, sin cubrir o tras una vacía.
  {
    const cycleId = await cycle(bonita!.id, NOW.getFullYear(), "MAIDEN");
    await prisma.reproExam.create({
      data: { tenantId, cycleId, mareId: bonita!.id, date: day(-9, 9), rightFollicleMm: 39, uterineEdema: 3, teasingScore: 4 },
    });
    await prisma.reproExam.create({
      data: { tenantId, cycleId, mareId: bonita!.id, date: day(-8, 9), ovulated: true, ovulationSide: "RIGHT", corpusLuteum: "RIGHT" },
    });
  }
  await cover(valerosa!.id, day(-34, 10), { stallionId: embajador.id, checks: ["NEGATIVE"] }, "BARREN");
  {
    const cycleId = await cycle(valerosa!.id, NOW.getFullYear());
    await prisma.reproExam.create({
      data: { tenantId, cycleId, mareId: valerosa!.id, date: day(-7, 9), ovulated: true, ovulationSide: "LEFT", corpusLuteum: "LEFT" },
    });
  }

  // Pérdida gestacional reciente
  await cover(cartujana!.id, day(-75, 10), { stallionId: galante.id, checks: ["POSITIVE", "POSITIVE", "REABSORBED"] }, "BARREN");
  await prisma.mareReproProfile.create({
    data: { tenantId, horseId: cartujana!.id, conditions: ["ENDOMETRITIS"], notes: "Lavado uterino tras cubrir en la próxima temporada." },
  });

  // Temporada anterior: no todas quedaron. Sin esto 2025 sale al 100 % de
  // preñez y la comparación con la temporada en curso parece un desastre.
  for (const [m, d, stallionId] of [
    [marisma!, -480, embajador.id], [sultana!, -470, galante.id], [esperanza!, -455, embajador.id],
    [valerosa!, -500, galante.id], [fortuna!, -440, embajador.id], [rociera!, -430, galante.id],
  ] as const) {
    await cover(m.id, day(d, 10), { stallionId, checks: ["NEGATIVE"] }, "BARREN");
  }

  // Jóvenes sin datos todavía; Primorosa ni siquiera tiene la temporada iniciada.
  await cycle(senorita!.id, NOW.getFullYear(), "MAIDEN");
  await cycle(aurora!.id, NOW.getFullYear(), "MAIDEN");
  void primorosa;

  // ── Jóvenes y caballos de doma ────────────────────────────────────────────
  await horse({ name: "Valiente XXIII", sex: "MALE", coat: "Tordo", birthDate: yearsAgo(3, 4, 11), sireId: embajador.id, damId: soberana.id, status: "IN_TRAINING", boxLocation: "Doma 1", weightKg: 480 });
  const brillante = await horse({ name: "Brillante XL", sex: "GELDING", coat: "Castaño", birthDate: yearsAgo(5, 6, 2), sireId: galante.id, status: "IN_TRAINING", boxLocation: "Doma 2", weightKg: 500, ownerId: ownerA.id });

  // ── Libro de explotación: apertura ───────────────────────────────────────
  // Todo animal presente tiene que figurar en el libro. Los nacidos aquí y el
  // semental comprado ya tienen su alta; el resto entra con la apertura (A).
  const withMovement = new Set(
    (await prisma.movement.findMany({ where: { tenantId }, select: { horseId: true } })).map((m) => m.horseId),
  );
  const present = await prisma.horse.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "IN_TRAINING"] } },
    select: { id: true, birthDate: true },
  });
  const opened = yearsAgo(4, 1, 10);
  for (const h of present.filter((h) => !withMovement.has(h.id))) {
    // Nacido después de abrir el libro: su alta es el nacimiento, no la apertura.
    const bornHere = h.birthDate !== null && h.birthDate > opened;
    await prisma.movement.create({
      data: {
        tenantId, horseId: h.id, direction: "IN",
        date: bornHere ? h.birthDate! : opened,
        cause: bornHere ? "NACIMIENTO" : "APERTURA",
        reason: bornHere ? "Nacimiento en la explotación" : "Apertura del libro",
      },
    });
  }

  // ── Pupilaje: lo que se factura cada mes (en la demo se genera y emite) ──
  const contracts: [string, string, number, string[]][] = [
    [candela.id, ownerA.id, 450, ["Box", "Alimentación", "Manejo reproductivo"]],
    [brillante.id, ownerA.id, 520, ["Box", "Alimentación", "Doma"]],
    [sultana!.id, ownerB.id, 450, ["Box", "Alimentación", "Manejo reproductivo"]],
  ];
  for (const [horseId, clientId, fee, includes] of contracts) {
    const contract = await prisma.boardingContract.create({
      data: { tenantId, horseId, clientId, startDate: day(-240), monthlyFee: fee, includes },
    });
    if (horseId === candela.id) {
      await prisma.boardingContractExtra.create({
        data: { tenantId, boardingContractId: contract.id, concept: "Ecografías de control", amount: 60 },
      });
    }
  }

  // ── Sanidad ─────────────────────────────────────────────────────────────
  // Los potros de este año no entran en el plan vacunal de adultos.
  const active = await prisma.horse.findMany({
    where: { tenantId, status: { in: ["ACTIVE", "IN_TRAINING"] }, birthDate: { lt: day(-365) } },
    orderBy: { name: "asc" },
  });
  // Plan al día para todos: la última vacuna y la última desparasitación
  // vencen en el futuro. Los vencidos de abajo son los únicos de verdad (un
  // acto más reciente del mismo tipo los daría por renovados).
  const lapsedFlu = new Set([galante.id]);
  const lapsedWorm = new Set([gitana!.id, fortuna!.id]);
  for (const [i, h] of active.entries()) {
    if (!lapsedFlu.has(h.id)) {
      const flu = day(-20 - ((i * 17) % 150));
      await health(h.id, "VACCINE", "Gripe equina + tétanos", flu, new Date(flu.getTime() + 182 * DAY_MS), { cost: 38, vetId: vet.id, dose: "1 dosis IM" });
    }
    if (!lapsedWorm.has(h.id)) {
      const worm = day(-10 - ((i * 11) % 70));
      await health(h.id, "DEWORMING", "Ivermectina + praziquantel", worm, new Date(worm.getTime() + 90 * DAY_MS), { cost: 14 });
    }
  }
  // Lo que pide atención hoy
  await health(galante.id, "VACCINE", "Gripe equina + tétanos (refuerzo)", day(-192), day(-10), { cost: 38, vetId: vet.id });
  await health(gitana!.id, "DEWORMING", "Desparasitación (moxidectina)", day(-96), day(-6), { cost: 16 });
  await health(fortuna!.id, "DEWORMING", "Desparasitación (moxidectina)", day(-93), day(-3), { cost: 16 });
  await health(embajador.id, "FARRIER", "Herraje completo", day(-40), day(2), { cost: 90 });
  await health(altiva.id, "DENTAL", "Revisión dental y limado", day(-358), day(7), { cost: 75, vetId: vet.id });
  await health(cartujana!.id, "TREATMENT", "Penicilina procaína (endometritis)", day(-5), null, {
    cost: 64, vetId: vet.id, withdrawalDays: 28, durationDays: 5, dose: "20 ml/día IM",
  });
  await prisma.horse.update({ where: { id: cartujana!.id }, data: { excludedFromFoodChain: false } });
  await health(duquesa.id, "VET_CHECKUP", "Revisión preparto", day(-4), null, { cost: 60, vetId: vet.id });

  // ── Tareas y agenda ──────────────────────────────────────────────────────
  const tasks: [string, number, string | null][] = [
    ["Preparar box de partos para Bética XX", 0, betica.id],
    ["Ecografía de detección a Marisma II", 0, marisma!.id],
    ["Recoger dosis refrigeradas de Jerezano VIII", 0, jerezano.id],
    ["Llamar al herrador para Embajador XLII", -2, embajador.id],
    ["Pedir guía de traslado para SICAB", 3, null],
    ["Revisar ombligo y calostro del potro de Soberana II", 1, soberana.id],
  ];
  for (const [title, d, horseId] of tasks) {
    await prisma.task.create({ data: { tenantId, title, dueDate: day(d, 9), horseId } });
  }
  // SICAB tiene fecha fija: no puede moverse con el día del seed.
  const daysToSicab = Math.ceil((new Date(2026, 10, 17).getTime() - NOW.getTime()) / DAY_MS);
  const events: [string, string, number, number, string | null][] = [
    ["VET_VISIT", "Visita del veterinario: ecografías", 2, 9, null],
    ["FARRIER", "Herrador: sementales", 5, 8, embajador.id],
    ["VET_VISIT", "Revisión del potro de Morisca III", 1, 12, morisca!.id],
    ["COMPETITION", "SICAB 2026 · Sevilla", daysToSicab, 10, null],
  ];
  for (const [kind, title, d, hour, horseId] of events) {
    await prisma.event.create({ data: { tenantId, kind, title, startsAt: day(d, hour), horseId, location: kind === "COMPETITION" ? "FIBES, Sevilla" : null } });
  }

  // ── Diario de la yegua estrella ──────────────────────────────────────────
  for (const [d, content] of [
    [-3, "Come con apetito, se mueve bien en el cercado. Ubre sin cambios."],
    [-1, "Algo más inquieta por la tarde. Se le nota el potro más bajo."],
  ] as const) {
    await prisma.dailyJournal.create({ data: { tenantId, horseId: ilusionada.id, date: day(d, 19), content } });
  }

  const counts = await Promise.all([
    prisma.horse.count({ where: { tenantId, status: { in: ["ACTIVE", "IN_TRAINING"] } } }),
    prisma.horse.count({ where: { tenantId, sex: "FEMALE", status: "ACTIVE" } }),
    prisma.covering.count({ where: { tenantId } }),
    prisma.healthEvent.count({ where: { tenantId } }),
  ]);
  console.log(`  listo: ${counts[0]} caballos en censo, ${counts[1]} yeguas, ${counts[2]} cubriciones, ${counts[3]} actos sanitarios`);
  console.log(`  accesos: ${[DEMO_USER_EMAIL, ...owners.map((o) => o.email)].join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
