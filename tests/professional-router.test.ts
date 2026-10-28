import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { callerAs } from "./helpers/trpc";

/**
 * Rol prohibido del router `professional` con el `appRouter` real. Los
 * middlewares cortan antes de abrir la BD, así que no hace falta ninguna.
 */
const createCaller = createCallerFactory(appRouter);

test("professional.myHorses rechaza a GROOM, OWNER_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  for (const role of ["GROOM", "OWNER_EXTERNAL", "RIDER", "INSTRUCTOR"] as const) {
    await assert.rejects(callerAs(createCaller, { role }).professional.myHorses(), (err: unknown) => {
      assert.ok(err instanceof TRPCError, `${role}: esperaba TRPCError, llegó ${String(err)}`);
      assert.equal(err.code, "FORBIDDEN", role);
      return true;
    });
  }
});
