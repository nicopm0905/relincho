import { after, test } from "node:test";
import assert from "node:assert/strict";
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
