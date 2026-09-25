import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding demo data...");

  // Demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@equigest.es" },
    update: {},
    create: {
      email: "demo@equigest.es",
      name: "Demo Propietario",
    },
  });

  // Demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "yeguada-demo-andalucia" },
    update: {},
    create: {
      slug: "yeguada-demo-andalucia",
      name: "Yeguada Demo Andalucía",
      fiscalName: "Yeguada Demo Andalucía S.L.",
      nif: "B12345678",
      city: "Jerez de la Frontera",
      province: "Cádiz",
      postalCode: "11401",
      regaCode: "ES110001234",
      plan: "pro",
    },
  });

  // Membership
  await prisma.membership.upsert({
    where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
    update: {},
    create: {
      userId: user.id,
      tenantId: tenant.id,
      role: "OWNER",
    },
  });

  // Vet contact
  const vet = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      kind: "VET",
      name: "Dr. Antonio Ruiz Morales",
      email: "antonio.vet@example.com",
      phone: "956123456",
    },
  });

  // Owner contact for pupilaje
  const externalOwner = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      kind: "OWNER",
      name: "María García López",
      email: "maria@example.com",
      phone: "612345678",
      nif: "12345678A",
    },
  });

  // 5 caballos PRE
  const horses = await Promise.all([
    prisma.horse.create({
      data: {
        tenantId: tenant.id,
        name: "Espartero VII",
        sex: "MALE",
        breed: "PRE",
        coat: "Castaño",
        birthDate: new Date("2019-04-15"),
        uelnCode: "724011900001234",
        microchip: "724011900001234",
        hierro: "YD",
        boxLocation: "Box 1",
        status: "ACTIVE",
      },
    }),
    prisma.horse.create({
      data: {
        tenantId: tenant.id,
        name: "Zalamera IX",
        sex: "FEMALE",
        breed: "PRE",
        coat: "Tordo",
        birthDate: new Date("2018-03-22"),
        uelnCode: "724011800001235",
        microchip: "724011800001235",
        hierro: "YD",
        boxLocation: "Box 2",
        status: "ACTIVE",
      },
    }),
    prisma.horse.create({
      data: {
        tenantId: tenant.id,
        name: "Brillante III",
        sex: "MALE",
        breed: "PRE",
        coat: "Bayo",
        birthDate: new Date("2020-06-10"),
        uelnCode: "724012000001236",
        hierro: "YD",
        boxLocation: "Box 3",
        status: "IN_TRAINING",
      },
    }),
    prisma.horse.create({
      data: {
        tenantId: tenant.id,
        name: "Llorona V",
        sex: "FEMALE",
        breed: "PRE",
        coat: "Alazán",
        birthDate: new Date("2017-09-01"),
        uelnCode: "724011700001237",
        hierro: "YD",
        boxLocation: "Box 4",
        status: "ACTIVE",
        currentOwnerId: externalOwner.id,
      },
    }),
    prisma.horse.create({
      data: {
        tenantId: tenant.id,
        name: "Gallardo XI",
        sex: "GELDING",
        breed: "PRE",
        coat: "Negro",
        birthDate: new Date("2016-02-14"),
        uelnCode: "724011600001238",
        hierro: "YD",
        boxLocation: "Box 5",
        status: "ACTIVE",
      },
    }),
  ]);

  const [espartero, zalamera, , llorona] = horses;

  // Vacunas pendientes (nextDueDate en los próximos días)
  const in6Days = new Date();
  in6Days.setDate(in6Days.getDate() + 6);
  const in10Days = new Date();
  in10Days.setDate(in10Days.getDate() + 10);

  await prisma.healthEvent.create({
    data: {
      tenantId: tenant.id,
      horseId: espartero.id,
      type: "VACCINE",
      name: "Vacuna tétanos-influenza anual",
      date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      nextDueDate: in6Days,
      dose: "1 dosis IM",
      vetContactId: vet.id,
      cost: "45.00",
      notes: "Influenza equina + tétanos. Laboratorio Hipra.",
    },
  });

  await prisma.healthEvent.create({
    data: {
      tenantId: tenant.id,
      horseId: zalamera.id,
      type: "DEWORMING",
      name: "Desparasitación ivermectina",
      date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      nextDueDate: in10Days,
      dose: "Eqvalan 6ml oral",
      cost: "18.00",
    },
  });

  await prisma.healthEvent.create({
    data: {
      tenantId: tenant.id,
      horseId: espartero.id,
      type: "FARRIER",
      name: "Herrado ruedas de hierro",
      date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      nextDueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      cost: "120.00",
      notes: "Herrador: Manuel Jiménez",
    },
  });

  // Contrato de pupilaje para Llorona
  await prisma.boardingContract.create({
    data: {
      tenantId: tenant.id,
      clientId: externalOwner.id,
      horseId: llorona.id,
      startDate: new Date("2025-01-01"),
      monthlyFee: "450.00",
      vatRate: "21",
      includes: [
        "Pienso 4kg/día",
        "Heno ad libitum",
        "Limpieza de box diaria",
        "Herraje trimestral",
        "Seguimiento sanitario básico",
      ],
      active: true,
    },
  });

  // Una tarea demo
  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);

  await prisma.task.create({
    data: {
      tenantId: tenant.id,
      horseId: espartero.id,
      title: "Preparar documentación DIE para concurso ANCCE",
      dueDate: in3Days,
      notes: "Necesario para el concurso del 20 del mes",
    },
  });

  // Evento en el calendario
  await prisma.event.create({
    data: {
      tenantId: tenant.id,
      kind: "SICAB",
      title: "SICAB 2026 — Jerez PRE",
      startsAt: new Date("2026-11-17"),
      endsAt: new Date("2026-11-22"),
      location: "FIBES, Sevilla",
      notes: "Llevar Espartero VII y Zalamera IX. Contactar con ANCCE.",
    },
  });

  // Ciclo reproductivo (yegua preñada)
  const cycle = await prisma.reproductionCycle.create({
    data: {
      tenantId: tenant.id,
      mareId: zalamera.id,
      season: new Date().getFullYear(),
      notes: "Ciclo de prueba con gestación activa",
    },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const covering = await prisma.covering.create({
    data: {
      tenantId: tenant.id,
      cycleId: cycle.id,
      mareId: zalamera.id,
      stallionId: espartero.id,
      method: "NATURAL",
      date: thirtyDaysAgo,
    },
  });

  await prisma.pregnancyCheck.create({
    data: {
      tenantId: tenant.id,
      coveringId: covering.id,
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      result: "POSITIVE",
      dayOfPregnancy: 15,
    },
  });

  // Entrenamiento
  await prisma.trainingSession.create({
    data: {
      tenantId: tenant.id,
      horseId: espartero.id,
      date: new Date(),
      riderName: "Juan Pérez",
      minutes: 45,
      type: "DOMA_CLASICA",
      notes: "Trabajo en círculos y transiciones"
    }
  });

  // Serie de facturación por defecto
  const currentYear = new Date().getFullYear();
  const series = await prisma.invoiceSeries.upsert({
    where: {
      tenantId_code: { tenantId: tenant.id, code: String(currentYear) },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      code: String(currentYear),
      prefix: String(currentYear),
      year: currentYear,
      isDefault: true,
      nextNumber: 2, // la factura demo de abajo ocupa el número 1
    },
  });

  // Factura
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 30);
  const invoice = await prisma.invoice.create({
    data: {
      tenantId: tenant.id,
      clientId: externalOwner.id,
      seriesId: series.id,
      series: String(currentYear),
      number: 1,
      issueDate,
      dueDate,
      subtotal: "450.00",
      vatTotal: "94.50",
      total: "544.50",
      status: "ISSUED",
    },
  });

  await prisma.invoiceLine.create({
    data: {
      invoiceId: invoice.id,
      description: "Pupilaje Mensual - Llorona V",
      quantity: "1",
      unitPrice: "450.00",
      vatRate: "21",
      horseId: llorona.id
    }
  });

  console.log("✅ Seed completado");
  console.log(`   Tenant: ${tenant.slug}`);
  console.log(`   Caballos: ${horses.length}`);
  console.log(`   Usuario demo: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
