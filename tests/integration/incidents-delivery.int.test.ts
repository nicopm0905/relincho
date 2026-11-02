import { after, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { runIncidentEscalation } from "@/server/services/incidents/escalation";
import type { IncidentSend } from "@/server/services/incidents/deliver";
import { GET } from "@/app/api/cron/incidents/route";
import { closeDb, grantAccess, makeHorse, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

const HOUR = 3_600_000;

test("al crear una incidencia se intenta el email a cada propietario y queda en NotificationDelivery", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const ana = await makeMember(t, "OWNER_EXTERNAL");
  const bea = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t);
  await grantAccess(ana, lucero);
  await grantAccess(bea, lucero);

  await callerAs(createCaller, mozo).incidents.create({
    horseId: lucero.id,
    category: "LAMENESS",
    severity: "HIGH",
    description: "Cojea de la mano derecha",
  });

  // En los tests no hay RESEND_API_KEY: el envío se anota como omitido, no como fallo.
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { notification: { tenantId: t.id, kind: "INCIDENT" } },
    select: { channel: true, status: true, notification: { select: { userId: true } } },
  });
  assert.deepEqual(
    deliveries.map((d) => [d.notification.userId, d.channel, d.status]).sort(),
    [
      [ana.userId, "EMAIL", "SKIPPED"],
      [bea.userId, "EMAIL", "SKIPPED"],
    ].sort(),
  );
});

test("el escalado envía un email por destinatario una sola vez y un fallo no corta a los demás", async () => {
  const t = await makeTenant();
  const mozo = await makeMember(t, "GROOM");
  const gerente = await makeMember(t, "MANAGER");
  const propietaria = await makeMember(t, "OWNER_EXTERNAL");
  const lucero = await makeHorse(t, { name: "Lucero" });
  await grantAccess(propietaria, lucero);
  await callerAs(createCaller, mozo).incidents.create({
    horseId: lucero.id,
    category: "COLIC_SIGNS",
    severity: "HIGH",
    description: "Se tumba y se mira el flanco",
  });

  const sent: string[] = [];
  const send: IncidentSend = async (opts) => {
    sent.push(opts.to);
    return opts.to === gerente.email ? { ok: false, error: "buzón lleno" } : { ok: true };
  };
  const now = new Date(Date.now() + 3 * HOUR);
  const first = await runIncidentEscalation({ now, tenantId: t.id, send });
  await runIncidentEscalation({ now: new Date(now.getTime() + HOUR), tenantId: t.id, send });

  assert.deepEqual(sent.sort(), [gerente.email, propietaria.email].sort());
  assert.equal(first.sent, 1);
  assert.equal(first.failed, 1);
  const deliveries = await prisma.notificationDelivery.findMany({
    where: { notification: { tenantId: t.id, kind: "INCIDENT_ESCALATION" } },
    select: { status: true, error: true, notification: { select: { userId: true } } },
  });
  assert.deepEqual(
    deliveries.map((d) => [d.notification.userId, d.status, d.error]).sort(),
    [
      [gerente.userId, "FAILED", "buzón lleno"],
      [propietaria.userId, "SENT", null],
    ].sort(),
  );
});

test("el cron de incidencias rechaza peticiones sin el Bearer CRON_SECRET", async () => {
  const url = "http://localhost/api/cron/incidents";
  const previous = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "secreto-de-test";
    assert.equal((await GET(new NextRequest(url))).status, 401);
    assert.equal((await GET(new NextRequest(url, { headers: { authorization: "Bearer otro" } }))).status, 401);
    const ok = await GET(new NextRequest(url, { headers: { authorization: "Bearer secreto-de-test" } }));
    assert.equal(ok.status, 200);
    const body = (await ok.json()) as { ok: boolean; escalated: number };
    assert.equal(typeof body.escalated, "number");

    // Sin CRON_SECRET configurado, "Bearer undefined" no puede abrir la puerta.
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new NextRequest(url, { headers: { authorization: "Bearer undefined" } }))).status, 401);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
