import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { runIncidentEscalation } from "@/server/services/incidents/escalation";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

const HOUR = 3_600_000;

async function rejectsWith(promise: Promise<unknown>, code: TRPCError["code"]) {
  await assert.rejects(promise, (err: unknown) => {
    assert.ok(err instanceof TRPCError, `esperaba TRPCError, llegó ${String(err)}`);
    assert.equal(err.code, code);
    return true;
  });
}

test("un GROOM crea una incidencia con foto y el propietario recibe una notificación", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t, { name: "Lucero" });
  await grantAccess(propietaria, lucero);
  const photo = `${t.id}/incidents/${lucero.id}/${randomUUID()}/foto-1.jpg`;

  const result = await callerAs(createCaller, mozo).incidents.create({
    horseId: lucero.id,
    category: "EQUIPMENT",
    severity: "LOW",
    description: "Manta rota",
    photoKeys: [photo],
  });

  assert.equal(result.callOwner, false);
  const saved = await prisma.incident.findUniqueOrThrow({
    where: { id: result.id },
    include: { receipts: true },
  });
  assert.equal(saved.tenantId, t.id);
  assert.equal(saved.status, "OPEN");
  assert.equal(saved.createdByMembershipId, mozo.membershipId);
  assert.deepEqual(saved.photoKeys, [photo]);
  assert.deepEqual(
    saved.receipts.map((r) => [r.membershipId, r.readAt, r.acknowledgedAt]),
    [[propietaria.membershipId, null, null]],
  );

  const notes = await prisma.notification.findMany({ where: { tenantId: t.id, kind: "INCIDENT" } });
  assert.deepEqual(
    notes.map((n) => n.userId),
    [propietaria.userId],
  );
  assert.match(notes[0].title, /Lucero/);
});

test("una foto guardada fuera de la ruta de ese caballo se rechaza y no se crea nada", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const lucero = await makeHorse(t);
  const otro = await makeHorse(t);

  await rejectsWith(
    callerAs(createCaller, mozo).incidents.create({
      horseId: lucero.id,
      category: "INJURY",
      severity: "MEDIUM",
      description: "Herida en la mano",
      photoKeys: [`${t.id}/incidents/${otro.id}/x/foto.jpg`],
    }),
    "BAD_REQUEST",
  );
  assert.equal(await prisma.incident.count({ where: { tenantId: t.id } }), 0);
});

test("un caballo sin propietarios con cuenta avisa al centro de que hay que llamar", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const gerente = await makeMember(t, "MANAGER");
  const lucero = await makeHorse(t);

  const result = await callerAs(createCaller, mozo).incidents.create({
    horseId: lucero.id,
    category: "NOT_EATING",
    severity: "MEDIUM",
    description: "No ha comido",
  });

  assert.equal(result.callOwner, true);
  const notes = await prisma.notification.findMany({ where: { tenantId: t.id, kind: "INCIDENT" } });
  assert.deepEqual(notes.map((n) => n.userId), [gerente.userId]);
});

test("un caballo de otro centro responde NOT_FOUND al crear la incidencia", async () => {
  const t = await makeTenant();
  const otro = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const ajeno = await makeHorse(otro);

  await rejectsWith(
    callerAs(createCaller, mozo).incidents.create({
      horseId: ajeno.id,
      category: "LAMENESS",
      severity: "HIGH",
      description: "Cojea",
    }),
    "NOT_FOUND",
  );
});

test("un propietario no puede confirmar incidencias de un caballo ajeno (NOT_FOUND)", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const otroCliente = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t);
  const tormenta = await makeHorse(t);
  await grantAccess(propietaria, lucero);
  await grantAccess(otroCliente, tormenta);

  const { id } = await callerAs(createCaller, mozo).incidents.create({
    horseId: tormenta.id,
    category: "LAMENESS",
    severity: "HIGH",
    description: "Cojea de la mano derecha",
  });

  await rejectsWith(callerAs(createCaller, propietaria).incidents.acknowledge({ id }), "NOT_FOUND");
  const receipt = await prisma.incidentReceipt.findFirstOrThrow({ where: { incidentId: id } });
  assert.equal(receipt.acknowledgedAt, null);
  // Tampoco la ve en su lista.
  assert.deepEqual(await callerAs(createCaller, propietaria).incidents.list({}), []);
});

test("cuando confirma el último propietario, la incidencia queda ACKNOWLEDGED y el centro ve la hora", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const gerente = await makeMember(t, "MANAGER");
  const ana = await makeMember(t, "OWNER_EXTERNAL");
  const bea = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t);
  await grantAccess(ana, lucero);
  await grantAccess(bea, lucero);

  const { id } = await callerAs(createCaller, mozo).incidents.create({
    horseId: lucero.id,
    category: "INJURY",
    severity: "MEDIUM",
    description: "Rozadura en el codillo",
  });

  await callerAs(createCaller, ana).incidents.markRead({ id });
  await callerAs(createCaller, ana).incidents.acknowledge({ id });
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id } })).status, "OPEN");

  await callerAs(createCaller, bea).incidents.acknowledge({ id });
  const [listed] = await callerAs(createCaller, gerente).incidents.list({});
  assert.equal(listed.id, id);
  assert.equal(listed.status, "ACKNOWLEDGED");
  assert.equal(listed.receipts.length, 2);
  assert.ok(listed.receipts.every((r) => r.acknowledgedAt instanceof Date));
});

test("reenviar la misma incidencia con el mismo clientMutationId no la duplica", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t);
  await grantAccess(propietaria, lucero);
  const input = {
    horseId: lucero.id,
    category: "COLIC_SIGNS" as const,
    severity: "HIGH" as const,
    description: "Se tumba y se mira el flanco",
    clientMutationId: randomUUID(),
  };

  const first = await callerAs(createCaller, mozo).incidents.create(input);
  const retry = await callerAs(createCaller, mozo).incidents.create(input);

  assert.equal(retry.id, first.id);
  assert.equal(await prisma.incident.count({ where: { tenantId: t.id } }), 1);
  assert.equal(await prisma.notification.count({ where: { tenantId: t.id, kind: "INCIDENT" } }), 1);
});

test("el cron de escalado reenvía una sola vez las graves sin confirmar", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const gerente = await makeMember(t, "MANAGER");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t, { name: "Lucero" });
  await grantAccess(propietaria, lucero);
  const caller = callerAs(createCaller, mozo);

  const grave = await caller.incidents.create({ horseId: lucero.id, category: "COLIC_SIGNS", severity: "HIGH", description: "Cólico" });
  const leve = await caller.incidents.create({ horseId: lucero.id, category: "EQUIPMENT", severity: "LOW", description: "Manta rota" });
  const now = new Date(Date.now() + 3 * HOUR);

  const first = await runIncidentEscalation({ now, tenantId: t.id });
  const second = await runIncidentEscalation({ now: new Date(now.getTime() + HOUR), tenantId: t.id });

  assert.equal(first.escalated, 1);
  assert.equal(second.escalated, 0);
  assert.ok((await prisma.incident.findUniqueOrThrow({ where: { id: grave.id } })).escalatedAt);
  assert.equal((await prisma.incident.findUniqueOrThrow({ where: { id: leve.id } })).escalatedAt, null);
  const escalations = await prisma.notification.findMany({ where: { tenantId: t.id, kind: "INCIDENT_ESCALATION" } });
  assert.deepEqual(
    escalations.map((n) => n.userId).sort(),
    [gerente.userId, propietaria.userId].sort(),
  );
});
