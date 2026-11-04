import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { callerAs } from "./helpers/trpc";

/**
 * Las suscripciones y preferencias son del usuario (D1), de cualquier rol,
 * pero exigen sesión: sin usuario, UNAUTHORIZED antes de abrir la BD.
 */
const createCaller = createCallerFactory(appRouter);

test("notifications.* sin sesión responde UNAUTHORIZED", async () => {
  const anon = callerAs(createCaller, null);
  const calls = [
    () => anon.notifications.subscribe({ endpoint: "https://push.example/x", keys: { p256dh: "p", auth: "a" } }),
    () => anon.notifications.unsubscribe({ endpoint: "https://push.example/x" }),
    () => anon.notifications.preferences(),
    () => anon.notifications.setPreference({ kind: "HEALTH_DUE", push: true, email: true }),
  ];
  for (const call of calls) {
    await assert.rejects(call(), (err: unknown) => {
      assert.ok(err instanceof TRPCError);
      assert.equal(err.code, "UNAUTHORIZED");
      return true;
    });
  }
});
