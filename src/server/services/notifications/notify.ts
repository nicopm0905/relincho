import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";

import { deliverAt, planChannels, shouldDropSubscription, type Channel } from "@/lib/notify-channels";
import { buildPushPayload } from "@/lib/push-payload";
import { reportError } from "@/lib/observability";
import { prisma } from "@/server/db/prisma";
import { sendNotificationEmail, type SendResult } from "./email";
import { sendWebPush, type PushResult, type PushTarget } from "./push";

export type PushSend = (target: PushTarget, payload: string) => Promise<PushResult>;
export type EmailSend = (opts: Parameters<typeof sendNotificationEmail>[0]) => Promise<SendResult>;

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Entrega una `Notification` ya guardada (E4). El motor `notify-channels`
 * decide los canales con la suscripción y la preferencia del usuario; aquí se
 * envía y se anota una `NotificationDelivery` por canal usado.
 *
 * - De noche, lo no urgente queda DEFERRED (sin enviar) para las 07:00.
 * - Si todas las suscripciones push están muertas (404/410), se borran y el
 *   aviso cae a email, si el usuario no lo ha apagado.
 * - Nunca lanza: un fallo de envío es un FAILED con su motivo.
 */
export async function notify({
  notificationId,
  urgent,
  now = new Date(),
  db = prisma,
  push = sendWebPush,
  email = sendNotificationEmail,
}: {
  notificationId: string;
  urgent: boolean;
  now?: Date;
  db?: Db;
  push?: PushSend;
  email?: EmailSend;
}): Promise<{ channels: Channel[]; deferred: boolean }> {
  const n = await db.notification.findUniqueOrThrow({
    where: { id: notificationId },
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      url: true,
      user: {
        select: {
          email: true,
          name: true,
          pushSubscriptions: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
          notificationPreferences: { select: { kind: true, push: true, email: true } },
        },
      },
    },
  });
  const pref = n.user.notificationPreferences.find((p) => p.kind === n.kind);
  const subs = n.user.pushSubscriptions;
  const channels = planChannels({
    kind: n.kind,
    urgent,
    hasPush: subs.length > 0,
    ...(pref ? { preference: { push: pref.push, email: pref.email } } : {}),
  });

  const record = (channel: Channel, status: "SENT" | "FAILED" | "SKIPPED" | "DEFERRED", error?: string | null) =>
    db.notificationDelivery.create({
      data: { notificationId: n.id, channel, status, error: error?.slice(0, 500) ?? null },
    });

  if (deliverAt({ now, urgent }).getTime() > now.getTime()) {
    for (const c of channels) await record(c, "DEFERRED");
    return { channels, deferred: true };
  }

  const sendEmail = async () => {
    let result: SendResult;
    try {
      result = await email({ to: n.user.email, name: n.user.name ?? n.user.email, title: n.title, body: n.body, url: n.url ?? "/" });
    } catch (error) {
      result = { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    await record("EMAIL", result.ok ? "SENT" : result.skipped ? "SKIPPED" : "FAILED", result.ok ? null : result.error);
  };

  let pushReached = false;
  if (channels.includes("PUSH")) {
    const payload = buildPushPayload({ kind: n.kind, title: n.title, body: n.body, url: n.url });
    const errors: string[] = [];
    let skipped = false;
    for (const s of subs) {
      let r: PushResult;
      try {
        r = await push(s, payload);
      } catch (error) {
        r = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      if (r.ok) {
        pushReached = true;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastSuccessAt: now, failedCount: 0 } });
      } else if (r.skipped) {
        skipped = true;
      } else if (r.statusCode && shouldDropSubscription(r.statusCode)) {
        await db.pushSubscription.deleteMany({ where: { id: s.id } });
        errors.push(`${r.statusCode} ${r.error ?? ""}`.trim());
      } else {
        await db.pushSubscription.update({ where: { id: s.id }, data: { failedCount: { increment: 1 } } });
        errors.push(r.error ?? String(r.statusCode ?? "error"));
      }
    }
    await record("PUSH", pushReached ? "SENT" : skipped && errors.length === 0 ? "SKIPPED" : "FAILED", pushReached ? null : errors.join("; ") || null);
    if (errors.length) await reportError(new Error("push"), { scope: "notify", notificationId: n.id, errors });
  }

  // Email: si el motor lo eligió, o si el push no llegó a ningún sitio y el usuario no lo apagó.
  const emailAllowed = pref ? pref.email : true;
  if (channels.includes("EMAIL") || (channels.includes("PUSH") && !pushReached && emailAllowed)) {
    await sendEmail();
  }
  return { channels, deferred: false };
}
