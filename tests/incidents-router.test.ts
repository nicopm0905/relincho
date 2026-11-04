import { test } from "node:test";
import assert from "node:assert/strict";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { callerAs } from "./helpers/trpc";

/**
 * Rol prohibido del router `incidents` (E5) con el `appRouter` real. Los
 * middlewares cortan antes de abrir la BD, así que no hace falta ninguna.
 */
const createCaller = createCallerFactory(appRouter);
type Role = "OWNER" | "MANAGER" | "GROOM" | "OWNER_EXTERNAL" | "PROFESSIONAL" | "VET_EXTERNAL" | "RIDER" | "INSTRUCTOR";

async function forbidden(roles: Role[], call: (c: ReturnType<typeof createCaller>) => Promise<unknown>) {
  for (const role of roles) {
    await assert.rejects(call(callerAs(createCaller, { role })), (err: unknown) => {
      assert.ok(err instanceof TRPCError, `${role}: esperaba TRPCError, llegó ${String(err)}`);
      assert.equal(err.code, "FORBIDDEN", role);
      return true;
    });
  }
}

const ID = "00000000-0000-4000-8000-000000000000";

test("incidents.create solo lo usa el personal: rechaza a OWNER_EXTERNAL, PROFESSIONAL, VET_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  await forbidden(["OWNER_EXTERNAL", "PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"], (c) =>
    c.incidents.create({ horseId: ID, category: "LAMENESS", severity: "HIGH", description: "Cojea" }),
  );
});

test("incidents.acknowledge solo lo usa el propietario: rechaza al personal y a los profesionales", async () => {
  await forbidden(["OWNER", "MANAGER", "GROOM", "PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"], (c) =>
    c.incidents.acknowledge({ id: ID }),
  );
});

test("incidents.resolve solo lo usa el personal: el propietario no la cierra", async () => {
  await forbidden(["OWNER_EXTERNAL", "PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"], (c) =>
    c.incidents.resolve({ id: ID, note: "Arreglada" }),
  );
});

test("incidents.list y addUpdate rechazan a PROFESSIONAL, VET_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  const outsiders: Role[] = ["PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"];
  await forbidden(outsiders, (c) => c.incidents.list({}));
  await forbidden(outsiders, (c) => c.incidents.addUpdate({ id: ID, text: "Corrección" }));
});

test("incidents.get rechaza a PROFESSIONAL, VET_EXTERNAL, RIDER e INSTRUCTOR", async () => {
  await forbidden(["PROFESSIONAL", "VET_EXTERNAL", "RIDER", "INSTRUCTOR"], (c) => c.incidents.get({ id: ID }));
});
