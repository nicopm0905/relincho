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

const leadDaysOf = async (tenantId: string) =>
  (await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { reminderLeadDays: true } }))
    .reminderLeadDays;

test("un gerente cambia la antelación de los avisos de su centro y no la de otro", async () => {
  const t = await makeTenant();
  const otro = await makeTenant();
  const gerente = await makeMember(t, "MANAGER");

  await callerAs(createCaller, gerente).tenant.update({ reminderLeadDays: 3 });

  assert.equal(await leadDaysOf(t.id), 3);
  assert.equal(await leadDaysOf(otro.id), 7);
});

test("una antelación fuera de 0 a 30 días se rechaza y no cambia nada", async () => {
  const t = await makeTenant();
  const gerente = await makeMember(t, "MANAGER");

  for (const reminderLeadDays of [-1, 31, 2.5]) {
    await assert.rejects(callerAs(createCaller, gerente).tenant.update({ reminderLeadDays }), (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, "BAD_REQUEST", String(reminderLeadDays));
      return true;
    });
  }
  assert.equal(await leadDaysOf(t.id), 7);
});
