import { Sex, HorseStatus, PrismaClient } from '@prisma/client';
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from 'dotenv';

dotenv.config();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'relinchoappweb@gmail.com';
  console.log(`Searching for user ${email}...`);
  
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { include: { tenant: true } } }
  });

  if (!user) {
    console.error(`User ${email} not found.`);
    return;
  }

  const tenantId = user.memberships[0]?.tenantId;
  
  if (!tenantId) {
    console.error(`No tenant found for user ${email}.`);
    return;
  }

  console.log(`Found tenant ID: ${tenantId}`);

  // Clear existing horses for this tenant to avoid duplication if run multiple times
  await prisma.horse.deleteMany({ where: { tenantId } });
  await prisma.contact.deleteMany({ where: { tenantId } });

  // 1. Create a client contact
  const contact = await prisma.contact.create({
    data: {
      tenantId,
      kind: 'CLIENT',
      name: 'Yeguada del Sol',
      email: 'contacto@yeguadadelsol.com',
      phone: '+34 600 123 456',
    }
  });

  // 2. Create horses
  console.log('Creating 6 horses...');
  const horses = [
    { name: 'Relámpago', sex: Sex.MALE, coat: 'Castaño', breed: 'PRE', status: HorseStatus.ACTIVE, birthDate: new Date('2018-05-12') },
    { name: 'Estrella', sex: Sex.FEMALE, coat: 'Tordo', breed: 'PRE', status: HorseStatus.ACTIVE, birthDate: new Date('2019-03-22') },
    { name: 'Fuego', sex: Sex.MALE, coat: 'Alazán', breed: 'CDE', status: HorseStatus.ACTIVE, birthDate: new Date('2020-04-10') },
    { name: 'Luna', sex: Sex.FEMALE, coat: 'Negro', breed: 'Luso', status: HorseStatus.ACTIVE, birthDate: new Date('2017-11-05') },
    { name: 'Vendaval', sex: Sex.GELDING, coat: 'Bayo', breed: 'Cruzado', status: HorseStatus.ACTIVE, birthDate: new Date('2016-08-14') },
    { name: 'Brisa', sex: Sex.FEMALE, coat: 'Castaño', breed: 'PRE', status: HorseStatus.ACTIVE, birthDate: new Date('2021-02-18') },
  ];

  const createdHorses = [];
  for (const h of horses) {
    const horse = await prisma.horse.create({
      data: {
        ...h,
        tenantId,
        currentOwnerId: contact.id,
      }
    });
    createdHorses.push(horse);
  }

  // 3. Create reproduction cycles for the females (Estrella, Luna, Brisa)
  console.log('Creating reproduction data...');
  const estrella = createdHorses.find(h => h.name === 'Estrella');
  if (estrella) {
    const cycle = await prisma.reproductionCycle.create({
      data: {
        tenantId,
        mareId: estrella.id,
        season: new Date().getFullYear(),
        notes: 'Ciclo primavera'
      }
    });
    const covering = await prisma.covering.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        mareId: estrella.id,
        stallionId: createdHorses.find(h => h.name === 'Relámpago')?.id,
        method: 'NATURAL',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        result: 'POSITIVE'
      }
    });
    await prisma.pregnancyCheck.create({
      data: {
        tenantId,
        coveringId: covering.id,
        date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        result: 'POSITIVE',
        dayOfPregnancy: 15
      }
    });
  }

  // 4. Create movements
  console.log('Creating movements...');
  await prisma.movement.create({
    data: {
      tenantId,
      horseId: createdHorses[0].id,
      direction: 'IN',
      date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      originRega: 'ES123456789',
      reason: 'Compra'
    }
  });

  // 5. Create health events
  console.log('Creating health events...');
  await prisma.healthEvent.create({
    data: {
      tenantId,
      horseId: createdHorses[1].id,
      type: 'VACCINE',
      name: 'Vacuna Tétanos',
      date: new Date(),
      nextDueDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    }
  });

  // 6. Create invoices
  console.log('Creating invoices...');
  const invoice = await prisma.invoice.create({
    data: {
      tenantId,
      clientId: contact.id,
      series: 'F2026',
      number: 1,
      issueDate: new Date(),
      subtotal: 500,
      vatTotal: 105,
      total: 605,
      status: 'ISSUED',
      lines: {
        create: [
          {
            description: 'Pupilaje Mensual - Relámpago',
            quantity: 1,
            unitPrice: 500,
            vatRate: 21,
            horseId: createdHorses[0].id
          }
        ]
      }
    }
  });

  console.log('Successfully seeded test data for', email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
