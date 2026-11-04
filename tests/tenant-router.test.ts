import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { callerAs } from "./helpers/trpc";

/**
 * Rol prohibido de `tenant.update` con el `appRouter` real: el middleware de
 * rol corta antes de abrir la BD.
 */
const createCaller = createCallerFactory(appRouter);

test("tenant.update rechaza a GROOM, OWNER_EXTERNAL, PROFESSIONAL, RIDER e INSTRUCTOR", async () => {
  for (const role of ["GROOM", "OWNER_EXTERNAL", "PROFESSIONAL", "RIDER", "INSTRUCTOR"] as const) {
    await assert.rejects(
      callerAs(createCaller, { role }).tenant.update({ reminderLeadDays: 3 }),
      (err: unknown) => {
        assert.ok(err instanceof TRPCError, `${role}: esperaba TRPCError, llegó ${String(err)}`);
        assert.equal(err.code, "FORBIDDEN", role);
        return true;
      },
    );
  }
});
