"use client";

/**
 * Aviso de un fallo visto en el navegador.
 *
 * Se manda al servidor, que lo anota en los logs y, si hay webhook
 * configurado, avisa. Nunca lanza: si el propio aviso falla, el usuario ya
 * tiene bastante con la pantalla de error.
 */
export function reportClientError(
  error: Error & { digest?: string },
  context: Record<string, unknown> = {},
): void {
  try {
    void fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: error.message,
        name: error.name,
        digest: error.digest ?? null,
        stack: error.stack?.split("\n").slice(0, 12).join("\n") ?? null,
        url: typeof window !== "undefined" ? window.location.pathname : null,
        ...context,
      }),
    }).catch(() => {
      /* el aviso es best-effort */
    });
  } catch {
    /* idem */
  }
}
