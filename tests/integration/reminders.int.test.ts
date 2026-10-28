import { after, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { prisma } from "@/server/db/prisma";
import { runReminders, type ReminderSend } from "@/server/services/notifications/reminders";
import { GET } from "@/app/api/cron/reminders/route";
import {
  closeDb,
  grantAccess,
  makeHealthEvent,
  makeHorse,
  makeMember,
  makeTenant,
  type TestTenant,
} from "../helpers/factories";

/**
 * Avisos multi-destinatario contra una BD real (roadmap §4 E3). El envío es un
 * `send` falso inyectado: estos tests nunca llaman a Resend. Cada test crea su
 * centro y mira solo sus filas, porque `runReminders` recorre todos los centros.
 */
after(closeDb);

/** Hoy fijo: las 08:00 UTC del cron. El herraje vence dentro de 7 días. */
const NOW = new Date("2026-12-01T08:00:00Z");
const IN_7_DAYS = new Date("2026-12-08T12:00:00Z");

type SendCall = Parameters<ReminderSend>[0];

/** `send` falso que apunta cada llamada y puede fallar para unos emails. */
function fakeSend(failFor: string[] = []) {
  const calls: SendCall[] = [];
  const send: ReminderSend = async (opts) => {
    calls.push(opts);
    if (failFor.includes(opts.to)) throw new Error("buzón inexistente");
    return { ok: true };
  };
  return { send, calls, to: (tenant: TestTenant) => calls.filter((c) => c.tenantSlug === tenant.slug).map((c) => c.to) };
}

/** Centro con un herraje a 7 días y un reparto de miembros que cubre todos los casos. */
async function farrierScenario() {
  const tenant = await makeTenant();
  const horse = await makeHorse(tenant, { name: "Lucero" });
  const otherHorse = await makeHorse(tenant, { name: "Ajeno" });

  const owner = await makeMember(tenant, "OWNER");
  const manager = await makeMember(tenant, "MANAGER");
  const horseOwner = await makeMember(tenant, "OWNER_EXTERNAL");
  const farrier = await makeMember(tenant, "PROFESSIONAL", { specialty: "FARRIER" });
  // No deben recibir nada:
  const groom = await makeMember(tenant, "GROOM");
  const otherOwner = await makeMember(tenant, "OWNER_EXTERNAL");
  const vet = await makeMember(tenant, "PROFESSIONAL", { specialty: "VET" });
  const farrierWithoutAccess = await makeMember(tenant, "PROFESSIONAL", { specialty: "FARRIER" });

  await grantAccess(horseOwner, horse);
  await grantAccess(farrier, horse);
  await grantAccess(groom, horse);
  await grantAccess(vet, horse);
  await grantAccess(otherOwner, otherHorse);
  await grantAccess(farrierWithoutAccess, otherHorse);

  const event = await makeHealthEvent(tenant, horse, { type: "FARRIER", name: "Herraje", nextDueDate: IN_7_DAYS });
  return {
    tenant,
    event,
    expected: [owner, manager, horseOwner, farrier],
    others: [groom, otherOwner, vet, farrierWithoutAccess],
  };
}

const sorted = (xs: string[]) => [...xs].sort();

test("un herraje a 7 días avisa al centro, al propietario y al herrador con acceso, y a nadie más", async () => {
  const { tenant, expected } = await farrierScenario();
  const fake = fakeSend();

  await runReminders({ now: NOW, db: prisma, send: fake.send });

  assert.deepEqual(sorted(fake.to(tenant)), sorted(expected.map((m) => m.email)));
  const notifications = await prisma.notification.findMany({ where: { tenantId: tenant.id } });
  assert.deepEqual(sorted(notifications.map((n) => n.userId)), sorted(expected.map((m) => m.userId)));
  assert.ok(notifications.every((n) => n.kind === "HEALTH_DUE"));
});

test("ejecutar el cron dos veces el mismo día no duplica notificaciones ni envíos", async () => {
  const { tenant, expected } = await farrierScenario();
  const fake = fakeSend();

  await runReminders({ now: NOW, db: prisma, send: fake.send });
  await runReminders({ now: NOW, db: prisma, send: fake.send });

  assert.equal(fake.to(tenant).length, expected.length);
  assert.equal(await prisma.notification.count({ where: { tenantId: tenant.id } }), expected.length);
  assert.equal(
    await prisma.notificationDelivery.count({ where: { notification: { tenantId: tenant.id } } }),
    expected.length,
  );
});

test("el cron rechaza peticiones sin el Bearer CRON_SECRET", async () => {
  const url = "http://localhost/api/cron/reminders";
  const previous = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "secreto-de-test";
    assert.equal((await GET(new NextRequest(url))).status, 401);
    const wrong = new NextRequest(url, { headers: { authorization: "Bearer otro" } });
    assert.equal((await GET(wrong)).status, 401);

    // Sin CRON_SECRET configurado, "Bearer undefined" no puede abrir la puerta.
    delete process.env.CRON_SECRET;
    const undef = new NextRequest(url, { headers: { authorization: "Bearer undefined" } });
    assert.equal((await GET(undef)).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("un fallo de envío a un destinatario no impide los demás y queda registrado en NotificationDelivery", async () => {
  const { tenant, expected } = await farrierScenario();
  const [broken, ...rest] = expected;
  const fake = fakeSend([broken.email]);

  await runReminders({ now: NOW, db: prisma, send: fake.send });

  assert.deepEqual(sorted(fake.to(tenant)), sorted(expected.map((m) => m.email)));
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { notification: { tenantId: tenant.id } },
    include: { notification: { select: { userId: true } } },
  });
  const byUser = new Map(deliveries.map((d) => [d.notification.userId, d]));
  assert.equal(byUser.get(broken.userId)?.status, "FAILED");
  assert.equal(byUser.get(broken.userId)?.channel, "EMAIL");
  assert.match(byUser.get(broken.userId)?.error ?? "", /buzón inexistente/);
  for (const m of rest) assert.equal(byUser.get(m.userId)?.status, "SENT");
});
