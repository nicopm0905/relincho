import { after, test } from "node:test";
import assert from "node:assert/strict";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

test("portal.home devuelve solo datos de los caballos del propietario", async () => {
  const t = await makeTenant();
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const suyo = await makeHorse(t, { name: "Suyo" });
  const ajeno = await makeHorse(t, { name: "De otro cliente" });
  await grantAccess(propietaria, suyo);

  for (const horse of [suyo, ajeno]) {
    await prisma.healthEvent.create({
      data: { tenantId: t.id, horseId: horse.id, type: "FARRIER", name: "Herraje", date: inDays(-38), nextDueDate: inDays(4) },
    });
  }

  const home = await callerAs(createCaller, propietaria).portal.home();
  assert.equal(home.audience, "OWNER");
  assert.deepEqual(home.lastFarrier.map((f) => f.horseName), ["Suyo"]);
  const dues = home.items.filter((i) => i.kind === "HEALTH_DUE");
  assert.equal(dues.length, 1);
  assert.equal(dues[0]?.kind === "HEALTH_DUE" && dues[0].horseId, suyo.id);
});

test("portal.home de un cliente sin caballos devuelve la portada de alumno", async () => {
  const t = await makeTenant();
  const alumno = await makeMember(t, "OWNER_EXTERNAL");
  await makeHorse(t);
  const home = await callerAs(createCaller, alumno).portal.home();
  assert.equal(home.audience, "STUDENT");
  assert.deepEqual(home.items, []);
});

test("portal.home solo devuelve entrenamientos de los caballos del propietario", async () => {
  const t = await makeTenant();
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const suyo = await makeHorse(t, { name: "Suyo" });
  const ajeno = await makeHorse(t, { name: "De otro cliente" });
  await grantAccess(propietaria, suyo);

  for (const horse of [suyo, ajeno]) {
    for (const date of [inDays(-1), inDays(2)]) {
      await prisma.trainingSession.create({
        data: { tenantId: t.id, horseId: horse.id, date, minutes: 40, type: "Doma", notes: "Nota interna del entrenador" },
      });
    }
  }

  const home = await callerAs(createCaller, propietaria).portal.home();
  const done = home.activity.flatMap((d) => d.items);
  assert.deepEqual(done.map((i) => i.horseId), [suyo.id]);
  assert.deepEqual(home.scheduledTrainings.map((s) => s.horseId), [suyo.id]);
  assert.doesNotMatch(JSON.stringify(home), /nota interna/i);
});
