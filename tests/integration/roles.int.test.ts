import { after, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

/** Roles nuevos de E1a contra una BD real (roadmap §4, E1a). */
const createCaller = createCallerFactory(appRouter);
after(closeDb);

const specialtyOf = async (membershipId: string) =>
  prisma.membership.findUniqueOrThrow({
    where: { id: membershipId },
    select: { role: true, specialty: true, specialtyNote: true },
  });

test("members.invite exige especialidad al invitar a un PROFESSIONAL", async () => {
  const t = await makeTenant();
  const owner = callerAs(createCaller, await makeMember(t, "OWNER"));

  await assert.rejects(
    owner.members.invite({ email: "sin-especialidad@test.local", role: "PROFESSIONAL" }),
    (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, "BAD_REQUEST");
      return true;
    },
  );
  assert.equal(
    await prisma.membership.count({ where: { tenantId: t.id, role: "PROFESSIONAL" } }),
    0,
  );

  const { membershipId } = await owner.members.invite({
    email: "herrador@test.local",
    role: "PROFESSIONAL",
    specialty: "FARRIER",
    specialtyNote: " cojeras ",
  });
  assert.deepEqual(await specialtyOf(membershipId), {
    role: "PROFESSIONAL",
    specialty: "FARRIER",
    specialtyNote: "cojeras",
  });
});

test("un herrador con HorseAccess ve ese caballo en professional.myHorses y ningún otro", async () => {
  const t = await makeTenant();
  const otro = await makeTenant();
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const suyo = await makeHorse(t, { name: "Suyo" });
  await makeHorse(t, { name: "Sin asignar" });
  await makeHorse(otro, { name: "De otro centro" });
  await grantAccess(farrier, suyo);

  const horses = await callerAs(createCaller, farrier).professional.myHorses();
  assert.deepEqual(
    horses.map((h) => h.id),
    [suyo.id],
  );
});

test("updateRole de PROFESSIONAL a GROOM borra la especialidad", async () => {
  const t = await makeTenant();
  const owner = callerAs(createCaller, await makeMember(t, "OWNER"));
  const pro = await makeMember(t, "PROFESSIONAL", { specialty: "VET" });

  await owner.members.updateRole({ membershipId: pro.membershipId, role: "GROOM" });
  assert.deepEqual(await specialtyOf(pro.membershipId), {
    role: "GROOM",
    specialty: null,
    specialtyNote: null,
  });
});

/** Sentencias de la migración de datos de E1a 2/2, sin comentarios. */
const dataMigration = readFileSync("prisma/migrations/20261104230000_e1a_roles_datos/migration.sql", "utf8")
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n")
  .split(/;\s*$/m)
  .map((s) => s.trim())
  .filter(Boolean);

class Rollback extends Error {}

test("la migración de datos convierte VET_EXTERNAL en PROFESSIONAL con especialidad VET y deduce HorseAccess.relation del rol", async () => {
  const t = await makeTenant();
  const horse = await makeHorse(t);
  const vet = await makeMember(t, "VET_EXTERNAL");
  const owner = await makeMember(t, "OWNER_EXTERNAL");
  const farrier = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });
  const coOwner = await makeMember(t, "OWNER_EXTERNAL");
  const groom = await makeMember(t, "GROOM");
  for (const m of [vet, owner, farrier]) await grantAccess(m, horse);
  await prisma.horseAccess.create({
    data: { membershipId: coOwner.membershipId, horseId: horse.id, relation: "CO_OWNER" },
  });

  // Se aplica dentro de una transacción que se deshace: la migración recorre
  // toda la BD y no debe tocar los datos de los demás tests.
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      for (const sql of dataMigration) await tx.$executeRawUnsafe(sql);

      const roleOf = async (m: { membershipId: string }) =>
        tx.membership.findUniqueOrThrow({
          where: { id: m.membershipId },
          select: { role: true, specialty: true },
        });
      assert.deepEqual(await roleOf(vet), { role: "PROFESSIONAL", specialty: "VET" });
      assert.deepEqual(await roleOf(farrier), { role: "PROFESSIONAL", specialty: "FARRIER" });
      assert.deepEqual(await roleOf(groom), { role: "GROOM", specialty: null });

      const relations = await tx.horseAccess.findMany({
        where: { horseId: horse.id },
        select: { membershipId: true, relation: true },
      });
      const relationOf = (m: { membershipId: string }) =>
        relations.find((r) => r.membershipId === m.membershipId)?.relation;
      assert.equal(relationOf(vet), "PROFESSIONAL");
      assert.equal(relationOf(owner), "OWNER");
      assert.equal(relationOf(farrier), "PROFESSIONAL");
      assert.equal(relationOf(coOwner), "CO_OWNER", "una relación ya puesta no se pisa");
      throw new Rollback();
    }),
    Rollback,
  );
});

test("members.grantHorseAccess guarda la relación con el caballo según el rol", async () => {
  const t = await makeTenant();
  const owner = callerAs(createCaller, await makeMember(t, "OWNER"));
  const horse = await makeHorse(t);
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const herrador = await makeMember(t, "PROFESSIONAL", { specialty: "FARRIER" });

  for (const m of [propietaria, herrador]) {
    await owner.members.grantHorseAccess({ membershipId: m.membershipId, horseId: horse.id });
  }
  const relationOf = async (m: { membershipId: string }) =>
    (
      await prisma.horseAccess.findUniqueOrThrow({
        where: { horseId_membershipId: { horseId: horse.id, membershipId: m.membershipId } },
        select: { relation: true },
      })
    ).relation;
  assert.equal(await relationOf(propietaria), "OWNER");
  assert.equal(await relationOf(herrador), "PROFESSIONAL");
});

test("members.invite y updateRole ya no aceptan VET_EXTERNAL: el veterinario es PROFESSIONAL con especialidad VET", async () => {
  const t = await makeTenant();
  const owner = callerAs(createCaller, await makeMember(t, "OWNER"));
  const groom = await makeMember(t, "GROOM");
  const badRequest = (err: unknown) => {
    assert.ok(err instanceof TRPCError);
    assert.equal(err.code, "BAD_REQUEST");
    return true;
  };

  await assert.rejects(owner.members.invite({ email: "vet@test.local", role: "VET_EXTERNAL" }), badRequest);
  await assert.rejects(
    owner.members.updateRole({ membershipId: groom.membershipId, role: "VET_EXTERNAL" }),
    badRequest,
  );
  assert.equal(await prisma.membership.count({ where: { tenantId: t.id, role: "VET_EXTERNAL" } }), 0);
});
