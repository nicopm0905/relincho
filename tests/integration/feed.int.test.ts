import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

const HOUR = 3_600_000;

async function rejectsWith(promise: Promise<unknown>, code: TRPCError["code"]) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof TRPCError, `esperaba TRPCError, llegó ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

test("feed.forHorse de un OWNER_EXTERNAL solo responde para sus caballos", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const suyo = await makeHorse(t, { name: "Suyo" });
  const ajeno = await makeHorse(t, { name: "Ajeno" });
  await grantAccess(propietaria, suyo);
  const staff = callerAs(createCaller, mozo);
  await staff.activity.logBatch({ horseIds: [suyo.id, ajeno.id], kind: "PADDOCK" });
  await staff.activity.logBatch({ horseIds: [suyo.id], kind: "NOTE", note: "Le cuesta comer", visibleToOwner: false });

  const owner = callerAs(createCaller, propietaria);
  const feed = await owner.feed.forHorse({ horseId: suyo.id });
  // La nota interna no visible no le llega; el paddock sí.
  assert.deepEqual(feed.items.map((i) => i.kind), ["PADDOCK"]);
  assert.ok(feed.items.every((i) => i.note === null));
  await rejectsWith(owner.feed.forHorse({ horseId: ajeno.id }), "NOT_FOUND");
});

test("activity.logBatch rechaza caballos de otro tenant", async () => {
  const t = await makeTenant();
  const otro = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const mio = await makeHorse(t);
  const ajeno = await makeHorse(otro);

  await rejectsWith(
    callerAs(createCaller, mozo).activity.logBatch({ horseIds: [mio.id, ajeno.id], kind: "PADDOCK" }),
    "NOT_FOUND",
  );
  // Todo o nada: tampoco se guarda el caballo propio.
  assert.equal(await prisma.horseActivity.count({ where: { horseId: { in: [mio.id, ajeno.id] } } }), 0);
});

test("activity.logBatch registra 8 caballos con la misma hora y su autor, y reintentar no duplica", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const horses = await Promise.all(Array.from({ length: 8 }, (_, n) => makeHorse(t, { name: `Caballo ${n}` })));
  const input = { horseIds: horses.map((h) => h.id), kind: "PADDOCK" as const, clientMutationId: randomUUID() };
  const staff = callerAs(createCaller, mozo);

  const first = await staff.activity.logBatch(input);
  const retry = await staff.activity.logBatch(input);

  assert.deepEqual([first.created, retry.created], [8, 0]);
  const rows = await prisma.horseActivity.findMany({ where: { tenantId: t.id } });
  assert.equal(rows.length, 8);
  assert.equal(new Set(rows.map((r) => r.at.getTime())).size, 1);
  assert.ok(rows.every((r) => r.authorMembershipId === mozo.membershipId && r.kind === "PADDOCK"));
});

test("feed.forHorse mezcla actividad, entrenamiento y acto sanitario para el personal, del más reciente al más antiguo", async () => {
  const t = await makeTenant();
  const gerente = await makeMember(t, "MANAGER");
  const lucero = await makeHorse(t);
  const now = Date.now();
  await prisma.trainingSession.create({
    data: { tenantId: t.id, horseId: lucero.id, date: new Date(now - 3 * HOUR), minutes: 40, type: "Doma" },
  });
  await prisma.healthEvent.create({
    data: { tenantId: t.id, horseId: lucero.id, type: "FARRIER", name: "Herraje", date: new Date(now - 30 * HOUR) },
  });
  await callerAs(createCaller, gerente).activity.logBatch({
    horseIds: [lucero.id],
    kind: "NOTE",
    note: "Revisar la mano",
    visibleToOwner: false,
  });

  const feed = await callerAs(createCaller, gerente).feed.forHorse({ horseId: lucero.id });
  assert.deepEqual(feed.items.map((i) => i.source), ["activity", "training", "health"]);
  assert.equal(feed.items[0].note, "Revisar la mano");
});

test("feed.forHorse da el nombre de quien registró cada entrada y nada para las que no tienen autor", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  await prisma.user.update({ where: { id: mozo.userId }, data: { name: "Pepe Mozo" } });
  const lucero = await makeHorse(t);
  await prisma.trainingSession.create({
    data: { tenantId: t.id, horseId: lucero.id, date: new Date(Date.now() - 2 * HOUR), minutes: 30, type: "Doma" },
  });
  await callerAs(createCaller, mozo).activity.logBatch({ horseIds: [lucero.id], kind: "PADDOCK" });

  const feed = await callerAs(createCaller, mozo).feed.forHorse({ horseId: lucero.id });
  assert.deepEqual(
    feed.items.map((i) => [i.source, i.authorName]),
    [
      ["activity", "Pepe Mozo"],
      ["training", null],
    ],
  );
});
