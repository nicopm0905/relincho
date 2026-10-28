import { after, test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { assertHorseAccess } from "@/server/trpc/access";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

/**
 * Aislamiento entre centros contra una BD real (roadmap §1.8). La app conecta
 * con BYPASSRLS: lo único que separa a un centro de otro es el código, y esto
 * es lo que lo demuestra. Cada test crea sus propios tenants.
 */
const createCaller = createCallerFactory(appRouter);
after(closeDb);

test("horses.list de un tenant no devuelve caballos de otro tenant", async () => {
  const a = await makeTenant();
  const b = await makeTenant();
  const owner = await makeMember(a, "OWNER");
  const mine = await makeHorse(a, { name: "Lucero" });
  await makeHorse(b, { name: "Ajeno" });

  const horses = await callerAs(createCaller, owner).horses.list();
  assert.deepEqual(
    horses.map((h) => h.id),
    [mine.id],
  );
});

test("un OWNER_EXTERNAL solo ve en portal.myHorses los caballos de su HorseAccess", async () => {
  const t = await makeTenant();
  const owner = await makeMember(t, "OWNER_EXTERNAL");
  const suyo = await makeHorse(t, { name: "Suyo" });
  await makeHorse(t, { name: "De otro cliente" });
  await grantAccess(owner, suyo);

  const horses = await callerAs(createCaller, owner).portal.myHorses();
  assert.deepEqual(
    horses.map((h) => h.id),
    [suyo.id],
  );
});

test("assertHorseAccess responde NOT_FOUND, no FORBIDDEN, a un externo sin acceso", async () => {
  const t = await makeTenant();
  const vet = await makeMember(t, "VET_EXTERNAL");
  const horse = await makeHorse(t);

  await assert.rejects(assertHorseAccess(vet, horse.id), (err: unknown) => {
    assert.ok(err instanceof TRPCError);
    assert.equal(err.code, "NOT_FOUND");
    return true;
  });
  await grantAccess(vet, horse);
  await assertHorseAccess(vet, horse.id);
});
