import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Recibe los fallos que ve el navegador. Es un endpoint público, así que lleva
 * dos frenos: un tope por IP (en memoria, por instancia) y un límite de tamaño
 * y de longitud de los campos. Sin ellos, cualquiera podría llenar el canal de
 * avisos.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.resetAt < now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

function clamp(value: unknown, max = 500): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, max);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconocida";

  if (!allow(ip)) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const message = clamp(payload.message);
  if (!message) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  await reportError(message, {
    scope: "client",
    name: clamp(payload.name, 80),
    digest: clamp(payload.digest, 80),
    url: clamp(payload.url, 200),
    stack: clamp(payload.stack, 1200),
  });

  return NextResponse.json({ ok: true });
}
