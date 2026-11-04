/**
 * ¿Puede este navegador recibir push y qué hay que decirle al usuario? (E4)
 * Motor puro: el componente le pasa lo que detecta en `window`.
 * En iOS solo hay push con la app instalada en la pantalla de inicio (16.4+).
 */
export type PushSupport = "READY" | "IOS_NEEDS_INSTALL" | "DENIED" | "UNSUPPORTED" | "NOT_CONFIGURED";

export function pushSupport(o: {
  hasServiceWorker: boolean;
  hasPushManager: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  permission: "default" | "granted" | "denied";
  hasVapidKey: boolean;
}): PushSupport {
  if (!o.hasVapidKey) return "NOT_CONFIGURED";
  if (o.isIOS && !o.isStandalone) return "IOS_NEEDS_INSTALL";
  if (!o.hasServiceWorker || !o.hasPushManager) return "UNSUPPORTED";
  if (o.permission === "denied") return "DENIED";
  return "READY";
}

/** Clave pública VAPID (base64url) → bytes para `applicationServerKey`. */
export function vapidKeyToBytes(base64url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
