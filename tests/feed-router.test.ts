import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { callerAs } from "./helpers/trpc";

/**
 * Rol prohibido de `activity` y `feed` (E6) con el `appRouter` real: los
 * middlewares cortan antes de abrir la BD.
 */
const createCaller = createCallerFactory(appRouter);
const ID = "00000000-0000-4000-8000-000000000000";

async function forbidden(roles: readonly string[], call: (c: ReturnType<typeof createCaller>) => Promise<unknown>) {
  for (const role of roles) {
    await assert.rejects(call(callerAs(createCaller, { role: role as never })), (err: unknown) => {
      assert.ok(err instanceof TRPCError, `${role}: esperaba TRPCError, llegó ${String(err)}`);
      assert.equal(err.code, "FORBIDDEN", role);
      return true;
    });
  }
}

test("activity.logBatch solo lo usa el personal: rechaza a OWNER_EXTERNAL, PROFESSIONAL, VET_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  await forbidden(["OWNER_EXTERNAL", "PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"], (c) =>
    c.activity.logBatch({ horseIds: [ID], kind: "PADDOCK" }),
  );
});

test("feed.forHorse rechaza a PROFESSIONAL, VET_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  await forbidden(["PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"], (c) => c.feed.forHorse({ horseId: ID }));
});
