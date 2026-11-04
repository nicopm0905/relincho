"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BellRinging, CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";
import { pushSupport, vapidKeyToBytes, type PushSupport } from "@/lib/push-support";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
/** Los tipos que hoy existen en la app; reservas y stock llegarán con sus épicas. */
const KINDS = ["HEALTH_DUE", "INCIDENT", "INCIDENT_ESCALATION", "VISIT", "INVOICE", "ANNOUNCEMENT"] as const;

const noSubscribe = () => () => {};

function detect(): PushSupport {
  const nav = navigator as Navigator & { standalone?: boolean };
  return pushSupport({
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
    isStandalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
    permission: "Notification" in window ? Notification.permission : "default",
    hasVapidKey: VAPID_PUBLIC_KEY.length > 0,
  });
}

/**
 * Avisos (E4): activar el push en este dispositivo y elegir, por tipo, si
 * llega al móvil y por email. Sin push (iPhone sin instalar, permiso
 * denegado, navegador sin soporte) se explica por qué y llega el email.
 */
export function NotificationSettings() {
  const t = useTranslations("pushSettings");
  // Se lee del navegador; en el servidor no hay `window` (null = aún sin saber).
  const detected = useSyncExternalStore(noSubscribe, detect, () => null);
  // Lo que cambia después: permiso denegado al pedirlo o fallo al registrar.
  const [override, setSupport] = useState<PushSupport | null>(null);
  const support = override ?? detected;
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false);
  const subscribe = trpc.notifications.subscribe.useMutation();
  const unsubscribe = trpc.notifications.unsubscribe.useMutation();

  useEffect(() => {
    if (detected !== "READY") return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then(setSubscription)
      .catch(() => setSupport("UNSUPPORTED"));
  }, [detected]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setSupport(permission === "denied" ? "DENIED" : "READY");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyToBytes(VAPID_PUBLIC_KEY) as BufferSource,
      });
      const json = sub.toJSON();
      await subscribe.mutateAsync({
        endpoint: sub.endpoint,
        keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setSubscription(sub);
      toast.success(t("device.enabledToast"));
    } catch {
      toast.error(t("device.error"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!subscription) return;
    setBusy(true);
    try {
      await unsubscribe.mutateAsync({ endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      setSubscription(null);
      toast.success(t("device.disabledToast"));
    } finally {
      setBusy(false);
    }
  }

  const notice: Partial<Record<PushSupport, string>> = {
    IOS_NEEDS_INSTALL: t("device.iosInstall"),
    DENIED: t("device.denied"),
    UNSUPPORTED: t("device.unsupported"),
    NOT_CONFIGURED: t("device.notConfigured"),
  };

  return (
    <div className="space-y-6">
      <section aria-labelledby="push-device" className="space-y-3 rounded-2xl border bg-card p-4">
        <h2 id="push-device" className="flex items-center gap-2 font-semibold text-foreground">
          <BellRinging aria-hidden className="h-5 w-5" />
          {t("device.title")}
        </h2>
        {support === null ? null : support !== "READY" ? (
          <p className="text-sm text-muted-foreground">{notice[support]}</p>
        ) : subscription ? (
          <>
            <p className="text-sm text-foreground">{t("device.enabled")}</p>
            <Button variant="outline" className="h-11" disabled={busy} onClick={disable}>
              {t("device.disable")}
            </Button>
          </>
        ) : (
          <Button className="h-11 w-full" disabled={busy} onClick={enable}>
            {busy && <CircleNotch weight="bold" aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
            {busy ? t("device.working") : t("device.enable")}
          </Button>
        )}
      </section>
      <Preferences />
    </div>
  );
}

function Preferences() {
  const t = useTranslations("pushSettings.prefs");
  const utils = trpc.useUtils();
  const prefs = trpc.notifications.preferences.useQuery();
  // Optimista: la casilla cambia al tocarla; si no se guarda, vuelve a su estado.
  const set = trpc.notifications.setPreference.useMutation({
    onMutate: async (next) => {
      await utils.notifications.preferences.cancel();
      const previous = utils.notifications.preferences.getData();
      utils.notifications.preferences.setData(undefined, (rows) =>
        rows?.map((r) => (r.kind === next.kind ? { ...r, push: next.push, email: next.email } : r)),
      );
      return { previous };
    },
    onSuccess: () => toast.success(t("saved")),
    onError: (_err, _next, context) => {
      utils.notifications.preferences.setData(undefined, context?.previous);
      toast.error(t("error"));
    },
    onSettled: () => void utils.notifications.preferences.invalidate(),
  });

  return (
    <section aria-labelledby="push-prefs" className="space-y-3">
      <div>
        <h2 id="push-prefs" className="font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="divide-y divide-border/60 overflow-hidden rounded-2xl border bg-card">
        {KINDS.map((kind) => {
          const p = prefs.data?.find((x) => x.kind === kind) ?? { kind, push: true, email: true };
          return (
            <li key={kind} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
              <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{t(`kinds.${kind}`)}</span>
              {(["push", "email"] as const).map((channel) => (
                <label key={channel} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-primary"
                    checked={p[channel]}
                    disabled={!prefs.data}
                    aria-label={`${t(`kinds.${kind}`)}: ${t(channel)}`}
                    onChange={(e) => set.mutate({ kind, push: p.push, email: p.email, [channel]: e.target.checked })}
                  />
                  {t(channel)}
                </label>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
