import "server-only";

/**
 * Avisos de fallo sin depender de ningun servicio externo.
 *
 * Todo error acaba como una linea JSON en `console.error`, que Vercel recoge y
 * guarda en los logs del despliegue. Si ademas existe `ERROR_WEBHOOK_URL`
 * (un webhook de Slack, Discord o similar), se manda el aviso para que alguien
 * se entere sin tener que mirar los logs.
 *
 * Esta funcion nunca lanza: si el propio aviso falla, no puede tumbar la
 * peticion que lo estaba llamando.
 */
export async function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
): Promise<void> {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const payload = {
    source: "relincho",
    message,
    ...context,
    at: new Date().toISOString(),
  };

  console.error(`[relincho] ${JSON.stringify(payload)}`);

  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;

  const text = `Relincho · ${message}${
    Object.keys(context).length ? ` · ${JSON.stringify(context)}` : ""
  }`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `text` lo entiende Slack y `content` Discord; cada uno ignora el otro.
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (webhookError) {
    console.error(
      `[relincho] no se pudo avisar por webhook: ${
        webhookError instanceof Error ? webhookError.message : String(webhookError)
      }`,
    );
  }
}

/** Traza barata de un evento de negocio (alta, cobro, importacion...). */
export function logEvent(name: string, data: Record<string, unknown> = {}): void {
  console.log(
    `[relincho] ${JSON.stringify({ event: name, ...data, at: new Date().toISOString() })}`,
  );
}
