import "server-only";
import webpush from "web-push";

/**
 * Envío Web Push con claves VAPID (E4). Sin claves configuradas no se envía
 * nada: el resultado es "omitido", como el email sin Resend.
 * Claves: `npx web-push generate-vapid-keys` → NEXT_PUBLIC_VAPID_PUBLIC_KEY y
 * VAPID_PRIVATE_KEY (solo en Vercel), más VAPID_SUBJECT (mailto: del centro).
 */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type PushResult = { ok: boolean; statusCode?: number; skipped?: boolean; error?: string };

let configured: boolean | null = null;

export function isPushConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hola@relincho.app", publicKey, privateKey);
  return (configured = true);
}

export async function sendWebPush(target: PushTarget, payload: string): Promise<PushResult> {
  if (!isPushConfigured()) return { ok: false, skipped: true, error: "push-not-configured" };
  try {
    const res = await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      payload,
      { TTL: 24 * 60 * 60, urgency: "normal" },
    );
    return { ok: true, statusCode: res.statusCode };
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    return { ok: false, statusCode, error: error instanceof Error ? error.message : String(error) };
  }
}
