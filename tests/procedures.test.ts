import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import {
  createCallerFactory,
  createTRPCRouter,
  protectedProcedure,
  roleProcedure,
  staffProcedure,
  tenantProcedure,
} from "@/server/trpc/init";
import { callerAs as callerFor, type FakeMember } from "./helpers/trpc";

/**
 * Router mínimo: una query y una mutation por cada puerta de entrada. Prueba
 * los middlewares de `init.ts` sin Auth.js, sin BD y sin los routers reales.
 */
const router = createTRPCRouter({
  me: protectedProcedure.query(() => "ok"),
  panel: tenantProcedure.query(() => "ok"),
  panelWrite: tenantProcedure.mutation(() => "ok"),
  staff: staffProcedure.query(() => "ok"),
  owners: roleProcedure("OWNER").mutation(() => "ok"),
});
const createCaller = createCallerFactory(router);
const callerAs = (o: FakeMember | null) => callerFor(createCaller, o);

async function rejectsWith(p: Promise<unknown>, code: TRPCError["code"]) {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof TRPCError, `esperaba TRPCError, llegó ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

test("sin usuario, protectedProcedure responde UNAUTHORIZED", async () => {
  await rejectsWith(callerAs(null).me(), "UNAUTHORIZED");
});

test("tenantProcedure rechaza a OWNER_EXTERNAL con FORBIDDEN", async () => {
  await rejectsWith(callerAs({ role: "OWNER_EXTERNAL" }).panel(), "FORBIDDEN");
  assert.equal(await callerAs({ role: "MANAGER" }).panel(), "ok");
});

test("staffProcedure deja pasar a OWNER, MANAGER y GROOM y rechaza a los externos", async () => {
  for (const role of ["OWNER", "MANAGER", "GROOM"] as const) {
    assert.equal(await callerAs({ role }).staff(), "ok", role);
  }
  for (const role of ["VET_EXTERNAL", "OWNER_EXTERNAL"] as const) {
    await rejectsWith(callerAs({ role }).staff(), "FORBIDDEN");
  }
});

test("una mutation en la demo se corta con FORBIDDEN aunque el rol sea OWNER", async () => {
  const demo = callerAs({ role: "OWNER", isDemo: true });
  await rejectsWith(demo.owners(), "FORBIDDEN");
  await rejectsWith(demo.panelWrite(), "FORBIDDEN");
  assert.equal(await demo.panel(), "ok");
});

test("con la prueba terminada, una mutation se corta y una query pasa", async () => {
  const expired = callerAs({ role: "OWNER", trialEnded: true });
  await rejectsWith(expired.panelWrite(), "FORBIDDEN");
  assert.equal(await expired.panel(), "ok");
});
