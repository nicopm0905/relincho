import { after, test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { runReminders, type ReminderSend } from "@/server/services/notifications/reminders";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

/** Visita del profesional contra una BD real (roadmap §4 E7). */
const createCaller = createCallerFactory(appRouter);
after(closeDb);

const DAY = 24 * 60 * 60 * 1000;

async function rejectsWith(p: Promise<unknown>, code: TRPCError["code"]) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof TRPCError, `esperaba TRPCError, llegó ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

test("un herrador registra un herraje en un caballo con acceso y queda con su autoría", async () => {
  const t = await makeTenant();
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const lucero = await makeHorse(t, { name: "Lucero" });
  await grantAccess(farrier, lucero);
  const date = new Date(Date.now() - 2 * DAY);

  const result = await callerAs(createCaller, farrier).professional.recordVisit({
    horseIds: [lucero.id],
    type: "FARRIER",
    name: "Herraje",
    date,
  });

  assert.equal(result.created, 1);
  const [event] = await prisma.healthEvent.findMany({ where: { horseId: lucero.id } });
  assert.equal(event?.authorMembershipId, farrier.membershipId);
  assert.equal(event?.tenantId, t.id);
  assert.equal(event?.type, "FARRIER");
  assert.equal(Math.round((event!.nextDueDate!.getTime() - date.getTime()) / DAY), 42);
});

test("un herrador no puede registrar una vacuna (FORBIDDEN)", async () => {
  const t = await makeTenant();
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const lucero = await makeHorse(t);
  await grantAccess(farrier, lucero);

  await rejectsWith(
    callerAs(createCaller, farrier).professional.recordVisit({
      horseIds: [lucero.id],
      type: "VACCINE",
      name: "Gripe",
      date: new Date(),
    }),
    "FORBIDDEN",
  );
  assert.equal(await prisma.healthEvent.count({ where: { horseId: lucero.id } }), 0);
});

test("un herrador no ve caballos sin HorseAccess (NOT_FOUND)", async () => {
  const t = await makeTenant();
  const otro = await makeTenant();
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const suyo = await makeHorse(t);
  const sinAcceso = await makeHorse(t);
  const deOtroCentro = await makeHorse(otro);
  await grantAccess(farrier, suyo);

  for (const horse of [sinAcceso, deOtroCentro]) {
    await rejectsWith(
      callerAs(createCaller, farrier).professional.recordVisit({
        horseIds: [suyo.id, horse.id],
        type: "FARRIER",
        name: "Herraje",
        date: new Date(),
      }),
      "NOT_FOUND",
    );
  }
  // Todo o nada: el caballo con acceso tampoco se ha registrado.
  assert.equal(await prisma.healthEvent.count({ where: { horseId: suyo.id } }), 0);
});

test("tras el herraje, el siguiente aviso del cron va al propietario, al centro y al herrador", async () => {
  const t = await makeTenant();
  const owner = await makeMember(t, "OWNER");
  const horseOwner = await makeMember(t, "OWNER_EXTERNAL");
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const lucero = await makeHorse(t, { name: "Lucero" });
  await grantAccess(horseOwner, lucero);
  await grantAccess(farrier, lucero);

  // Herraje hace 35 días: el siguiente (a 6 semanas) vence en 7, cuando avisa el cron.
  const now = new Date();
  await callerAs(createCaller, farrier).professional.recordVisit({
    horseIds: [lucero.id],
    type: "FARRIER",
    name: "Herraje",
    date: new Date(now.getTime() - 35 * DAY),
  });

  const sentTo: string[] = [];
  const send: ReminderSend = async (opts) => {
    if (opts.tenantSlug === t.slug) sentTo.push(opts.to);
    return { ok: true };
  };
  await runReminders({ now, db: prisma, send });

  assert.deepEqual(sentTo.sort(), [owner.email, horseOwner.email, farrier.email].sort());
});

test("reintentar la misma visita con el mismo clientMutationId no la duplica", async () => {
  const t = await makeTenant();
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const a = await makeHorse(t);
  const b = await makeHorse(t);
  await grantAccess(farrier, a);
  await grantAccess(farrier, b);
  const visit = {
    horseIds: [a.id, b.id],
    type: "FARRIER" as const,
    name: "Herraje",
    date: new Date(),
    clientMutationId: `visita-${t.id}`,
  };

  const first = await callerAs(createCaller, farrier).professional.recordVisit(visit);
  const retry = await callerAs(createCaller, farrier).professional.recordVisit(visit);

  assert.deepEqual([first.created, retry.created], [2, 0]);
  assert.equal(await prisma.healthEvent.count({ where: { horseId: { in: [a.id, b.id] } } }), 2);
});

test("una visita con fecha posterior a hoy se rechaza y no guarda nada", async () => {
  const t = await makeTenant();
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const lucero = await makeHorse(t);
  await grantAccess(farrier, lucero);

  await rejectsWith(
    callerAs(createCaller, farrier).professional.recordVisit({
      horseIds: [lucero.id],
      type: "FARRIER",
      name: "Herraje",
      date: new Date(Date.now() + 7 * DAY),
    }),
    "BAD_REQUEST",
  );
  assert.equal(await prisma.healthEvent.count({ where: { horseId: lucero.id } }), 0);
});
