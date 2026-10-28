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

test("professional.recordVisit y allowedTypes rechazan a GROOM, OWNER_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  for (const role of ["GROOM", "OWNER_EXTERNAL", "RIDER", "INSTRUCTOR"] as const) {
    const caller = callerAs(createCaller, { role }).professional;
    for (const call of [
      () => caller.allowedTypes(),
      () =>
        caller.recordVisit({
          horseIds: ["00000000-0000-4000-8000-000000000000"],
          type: "FARRIER",
          name: "Herraje",
          date: new Date(),
        }),
    ]) {
      await assert.rejects(call(), (err: unknown) => {
        assert.ok(err instanceof TRPCError, `${role}: esperaba TRPCError, llegó ${String(err)}`);
        assert.equal(err.code, "FORBIDDEN", role);
        return true;
      });
    }
  }
});
