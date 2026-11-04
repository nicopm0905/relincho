import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createCallerFactory } from "@/server/trpc/init";
import { appRouter } from "@/server/trpc/router";
import { prisma } from "@/server/db/prisma";
import { notify, type EmailSend, type PushSend } from "@/server/services/notifications/notify";
import { closeDb, makeMember, makeTenant } from "../helpers/factories";
import { callerAs } from "../helpers/trpc";

const createCaller = createCallerFactory(appRouter);
after(closeDb);

const DAY = new Date("2026-12-10T10:00:00Z"); // 11:00 en Madrid: fuera de las horas de silencio
const NIGHT = new Date("2026-12-09T22:30:00Z"); // 23:30 en Madrid

const sub = (endpoint = `https://push.example/${randomUUID()}`) => ({
  endpoint,
  keys: { p256dh: "BPinventada-p256dh", auth: "auth-inventada" },
});

async function makeNotification(tenantId: string, userId: string, kind: "HEALTH_DUE" | "INCIDENT" = "HEALTH_DUE") {
  return prisma.notification.create({
    data: { tenantId, userId, kind, title: "Gripe de Lucero en 7 días", body: "Fecha prevista: 17 dic", url: "/centro/sanidad", dedupeKey: randomUUID() },
  });
}

function fakes() {
  const pushed: string[] = [];
  const emailed: string[] = [];
  const push: PushSend = async (s) => {
    pushed.push(s.endpoint);
    return { ok: true, statusCode: 201 };
  };
  const email: EmailSend = async (o) => {
    emailed.push(o.to);
    return { ok: true };
  };
  return { pushed, emailed, push, email };
}

const deliveries = (notificationId: string) =>
  prisma.notificationDelivery.findMany({ where: { notificationId }, orderBy: { channel: "asc" }, select: { channel: true, status: true } });

test("notifications.subscribe es idempotente por endpoint", async () => {
  const t = await makeTenant();
  const ana = await makeMember(t, "OWNER_EXTERNAL");
  const bea = await makeMember(t, "OWNER_EXTERNAL");
  const s = sub();

  await callerAs(createCaller, ana).notifications.subscribe(s);
  await callerAs(createCaller, ana).notifications.subscribe({ ...s, keys: { p256dh: "BPnueva", auth: "auth-nueva" } });
  let rows = await prisma.pushSubscription.findMany({ where: { endpoint: s.endpoint } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, ana.userId);
  assert.equal(rows[0].p256dh, "BPnueva");

  // Otra persona inicia sesión en el mismo navegador: la suscripción pasa a ella.
  await callerAs(createCaller, bea).notifications.subscribe(s);
  rows = await prisma.pushSubscription.findMany({ where: { endpoint: s.endpoint } });
  assert.deepEqual(rows.map((r) => r.userId), [bea.userId]);

  await callerAs(createCaller, bea).notifications.unsubscribe({ endpoint: s.endpoint });
  assert.equal(await prisma.pushSubscription.count({ where: { endpoint: s.endpoint } }), 0);
});

test("notify registra una NotificationDelivery por canal usado", async () => {
  const t = await makeTenant();
  const conPush = await makeMember(t, "OWNER_EXTERNAL");
  const sinPush = await makeMember(t, "OWNER_EXTERNAL");
  await callerAs(createCaller, conPush).notifications.subscribe(sub());
  const f = fakes();

  // Grave con push: por los dos canales.
  const grave = await makeNotification(t.id, conPush.userId, "INCIDENT");
  await notify({ notificationId: grave.id, urgent: true, now: DAY, push: f.push, email: f.email });
  assert.deepEqual(await deliveries(grave.id), [
    { channel: "EMAIL", status: "SENT" },
    { channel: "PUSH", status: "SENT" },
  ]);

  // Vencimiento sin push: solo email.
  const vence = await makeNotification(t.id, sinPush.userId);
  await notify({ notificationId: vence.id, urgent: false, now: DAY, push: f.push, email: f.email });
  assert.deepEqual(await deliveries(vence.id), [{ channel: "EMAIL", status: "SENT" }]);
  assert.deepEqual([f.pushed.length, f.emailed.length], [1, 2]);
});

test("un push que responde 410 borra la suscripción y el aviso cae a email", async () => {
  const t = await makeTenant();
  const user = await makeMember(t, "OWNER_EXTERNAL");
  const s = sub();
  await callerAs(createCaller, user).notifications.subscribe(s);
  const f = fakes();
  const gone: PushSend = async () => ({ ok: false, statusCode: 410, error: "Gone" });

  const n = await makeNotification(t.id, user.userId);
  await notify({ notificationId: n.id, urgent: false, now: DAY, push: gone, email: f.email });

  assert.equal(await prisma.pushSubscription.count({ where: { endpoint: s.endpoint } }), 0);
  assert.deepEqual(await deliveries(n.id), [
    { channel: "EMAIL", status: "SENT" },
    { channel: "PUSH", status: "FAILED" },
  ]);
});

test("de noche un aviso no urgente queda aplazado (DEFERRED) y no se envía nada", async () => {
  const t = await makeTenant();
  const user = await makeMember(t, "OWNER_EXTERNAL");
  await callerAs(createCaller, user).notifications.subscribe(sub());
  const f = fakes();

  const n = await makeNotification(t.id, user.userId);
  await notify({ notificationId: n.id, urgent: false, now: NIGHT, push: f.push, email: f.email });

  assert.deepEqual(await deliveries(n.id), [{ channel: "PUSH", status: "DEFERRED" }]);
  assert.deepEqual([f.pushed.length, f.emailed.length], [0, 0]);
});

test("notifications.setPreference apaga un canal para un tipo y notify lo respeta", async () => {
  const t = await makeTenant();
  const user = await makeMember(t, "OWNER_EXTERNAL");
  const caller = callerAs(createCaller, user);
  await caller.notifications.setPreference({ kind: "HEALTH_DUE", push: true, email: false });
  await caller.notifications.setPreference({ kind: "HEALTH_DUE", push: true, email: false });
  assert.deepEqual(
    (await caller.notifications.preferences()).find((p) => p.kind === "HEALTH_DUE"),
    { kind: "HEALTH_DUE", push: true, email: false },
  );
  const f = fakes();

  // Sin push y con el email de vencimientos apagado: no sale nada.
  const n = await makeNotification(t.id, user.userId);
  await notify({ notificationId: n.id, urgent: false, now: DAY, push: f.push, email: f.email });
  assert.deepEqual(await deliveries(n.id), []);
  assert.equal(f.emailed.length, 0);
});
