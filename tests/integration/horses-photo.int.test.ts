import { after, test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { closeDb, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

const jpeg = "data:image/jpeg;base64," + "A".repeat(2000);

test("un gerente guarda la foto de un caballo dentro de la base de datos (foto en línea)", async () => {
  const t = await makeTenant();
  const gerente = await makeMember(t, "MANAGER");

  const horse = await callerAs(createCaller, gerente).horses.create({ name: "Lucero", sex: "MALE", photoUrl: jpeg });

  const saved = await prisma.horse.findUniqueOrThrow({ where: { id: horse.id } });
  assert.equal(saved.photoUrl, jpeg);
  // Y se puede cambiar por otra después.
  const other = "data:image/jpeg;base64," + "B".repeat(1500);
  await callerAs(createCaller, gerente).horses.update({ id: horse.id, photoUrl: other });
  assert.equal((await prisma.horse.findUniqueOrThrow({ where: { id: horse.id } })).photoUrl, other);
});

test("una foto en línea que no es un JPEG pequeño se rechaza y no se guarda el caballo", async () => {
  const t = await makeTenant();
  const gerente = await makeMember(t, "MANAGER");
  const bad = ["data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "data:image/jpeg;base64," + "A".repeat(400_000), "javascript:alert(1)"];

  for (const photoUrl of bad) {
    await assert.rejects(callerAs(createCaller, gerente).horses.create({ name: "Mala", sex: "MALE", photoUrl }), (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, "BAD_REQUEST");
      return true;
    });
  }
  assert.equal(await prisma.horse.count({ where: { tenantId: t.id } }), 0);
});
