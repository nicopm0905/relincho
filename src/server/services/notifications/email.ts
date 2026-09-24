import "server-only";
import { Resend } from "resend";

import { getBaseUrl } from "@/lib/utils";
import { reportError } from "@/lib/observability";
import type { WeeklyDigest } from "@/server/services/performance/digest";
import { workTypeLabels } from "@/components/rendimiento/labels";

/**
 * Sin RESEND_API_KEY no hay cliente, y sin EMAIL_FROM no hay remitente valido:
 * Resend rechaza cualquier `from` de un dominio no verificado. En vez de
 * inventarse un remitente y tragarse el rechazo, los envios se saltan y se
 * dejan anotados, para que quien lea el log sepa que no salio nada.
 */
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const FROM = process.env.EMAIL_FROM ?? null;

export type SendResult = {
  ok: boolean;
  /** true cuando faltaba configuracion: no es un fallo, es un envio omitido. */
  skipped?: boolean;
  error?: string;
};

/** Si es false, ningun aviso por email de la app llegara a su destino. */
export function isEmailConfigured(): boolean {
  return Boolean(resend && FROM);
}

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  if (!resend || !FROM) {
    console.warn(
      `[relincho] email omitido (falta RESEND_API_KEY o EMAIL_FROM): "${opts.subject}" para ${opts.to}`,
    );
    return { ok: false, skipped: true, error: "email-not-configured" };
  }

  try {
    // Resend devuelve el error en el cuerpo, no lanzando: hay que mirarlo.
    const { error } = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) {
      await reportError(error, { scope: "email", subject: opts.subject });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    await reportError(err, { scope: "email", subject: opts.subject });
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendHealthReminder(opts: {
  to: string;
  ownerName: string;
  horseName: string;
  eventName: string;
  eventType: string;
  dueDate: Date;
  tenantName: string;
  tenantSlug: string;
  /** Dias que faltan: 7 para el aviso previo, 0 para el del mismo dia. */
  daysUntil?: number;
}): Promise<SendResult> {
  const { to, ownerName, horseName, eventName, dueDate, tenantName, tenantSlug } =
    opts;
  const daysUntil = opts.daysUntil ?? 7;
  const when = daysUntil === 0 ? "hoy" : daysUntil === 1 ? "mañana" : `en ${daysUntil} días`;
  const formattedDate = dueDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });

  return sendEmail({
    to,
    subject: `Recordatorio: ${eventName} de ${horseName} ${when}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;">Recordatorio sanitario — ${esc(tenantName)}</h2>
        <p>Hola ${esc(ownerName)},</p>
        <p>Te recordamos que <strong>${esc(horseName)}</strong> tiene pendiente:</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
          <strong>${esc(eventName)}</strong><br>
          Fecha prevista: <strong>${esc(formattedDate)}</strong>
        </div>
        <p>
          <a href="${getBaseUrl()}/${encodeURIComponent(tenantSlug)}/sanidad"
             style="background:#171717;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Ver en Relincho
          </a>
        </p>
        <p style="color:#888;font-size:12px;">Relincho · Gestión equina profesional</p>
      </div>
    `,
  });
}

export async function sendTeamInvite(opts: {
  to: string;
  tenantName: string;
  inviterName?: string | null;
  url: string;
}): Promise<SendResult> {
  const { to, tenantName, inviterName, url } = opts;
  return sendEmail({
    to,
    subject: `Te han invitado a ${tenantName} en Relincho`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;">Te han invitado a ${esc(tenantName)}</h2>
        <p>
          ${inviterName ? `${esc(inviterName)} te ha` : "Te han"} dado acceso al equipo
          de <strong>${esc(tenantName)}</strong> en Relincho.
        </p>
        <p>Haz clic en el botón para acceder. Te pediremos tu email para iniciar sesión.</p>
        <p>
          <a href="${url}"
             style="background:#171717;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Aceptar invitación
          </a>
        </p>
        <p style="color:#888;font-size:12px;">Si no esperabas esta invitación, ignora este email.</p>
      </div>
    `,
  });
}

/**
 * Aviso de suscripcion con el pago pendiente. Es el unico correo que se manda
 * al responsable de la yeguada cuando Stripe no puede cobrar.
 */
export async function sendPaymentFailed(opts: {
  to: string;
  tenantName: string;
  tenantSlug: string;
  amountDue?: string | null;
}): Promise<SendResult> {
  const { to, tenantName, tenantSlug, amountDue } = opts;
  return sendEmail({
    to,
    subject: `No hemos podido cobrar la suscripción de ${tenantName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;">Pago pendiente</h2>
        <p>No hemos podido cobrar la suscripción de <strong>${esc(tenantName)}</strong>${
          amountDue ? ` (${esc(amountDue)})` : ""
        }.</p>
        <p>
          La yeguada sigue funcionando, pero conviene revisar el método de pago
          para no perder el acceso al plan de pago.
        </p>
        <p>
          <a href="${getBaseUrl()}/${encodeURIComponent(tenantSlug)}/ajustes"
             style="background:#171717;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Revisar la suscripción
          </a>
        </p>
        <p style="color:#888;font-size:12px;">Relincho · Gestión equina profesional</p>
      </div>
    `,
  });
}

/** Los nombres vienen de la base de datos: al HTML no entra nada crudo. */
function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortDate(date: Date) {
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function section(title: string, body: string) {
  return `
    <div style="border:1px solid #e7e7e2;border-radius:12px;padding:16px;margin:14px 0;">
      <p style="margin:0 0 8px;font-weight:700;color:#171717;">${title}</p>
      <div style="color:#5f5f5c;font-size:14px;line-height:1.5;">${body}</div>
    </div>
  `;
}

/**
 * Resumen semanal de la yeguada. Recoge los tres avisos que ya viven en el
 * inicio (carga, sesiones sin confirmar y alertas de rendimiento) para que el
 * mensaje llegue sin abrir la app.
 */
export async function sendWeeklyDigest(opts: {
  to: string;
  ownerName: string;
  digest: WeeklyDigest;
}): Promise<SendResult> {
  const { to, ownerName, digest } = opts;
  const { plannedLoadUa, actualLoadUa, pendingCheckIns } = digest;
  const pct = plannedLoadUa > 0 ? Math.round((actualLoadUa / plannedLoadUa) * 100) : 0;
  const barColor = pct >= 70 ? "#a3b846" : pct >= 35 ? "#d8b13a" : "#d2675a";
  const base = getBaseUrl();

  const blocks: string[] = [];

  blocks.push(
    section(
      "Carga de la semana",
      `<p style="margin:0 0 10px;">
         <strong style="font-size:22px;color:#171717;">${actualLoadUa} UA</strong>
         de ${plannedLoadUa} UA planificadas (${pct}%)
       </p>
       <div style="background:#eee;border-radius:999px;height:8px;overflow:hidden;">
         <div style="background:${barColor};height:8px;width:${Math.min(100, pct)}%;"></div>
       </div>`,
    ),
  );

  if (pendingCheckIns.length > 0) {
    const rows = pendingCheckIns
      .slice(0, 6)
      .map(
        (session) =>
          `<li style="margin-bottom:6px;"><strong>${esc(session.horseName)}</strong> — ${esc(
            shortDate(session.date),
          )} · ${esc(workTypeLabels[session.workType] ?? session.workType)} · ${
            session.durationMinutes
          } min · intensidad ${session.rpeTarget}/10</li>`,
      )
      .join("");
    const extra =
      pendingCheckIns.length > 6
        ? `<p style="margin:8px 0 0;">y ${pendingCheckIns.length - 6} más.</p>`
        : "";
    blocks.push(
      section(
        `Sesiones sin confirmar: ${pendingCheckIns.length}`,
        `<p style="margin:0 0 10px;">
           Sin confirmarlas la carga real se queda corta y el plan no se reajusta.
         </p>
         <ul style="margin:0;padding-left:18px;">${rows}</ul>${extra}`,
      ),
    );
  }

  if (digest.tendonAlerts.length > 0) {
    blocks.push(
      section(
        `Historial de tendón: ${digest.tendonAlerts.length}`,
        `<p style="margin:0;">${digest.tendonAlerts
          .map((horse) => esc(horse.name))
          .join(" · ")}</p>
         <p style="margin:8px 0 0;">
           El plan mantiene su intensidad por debajo del límite del veterinario.
         </p>`,
      ),
    );
  }

  if (digest.bufferExhausted.length > 0) {
    blocks.push(
      section(
        `Margen de recuperación agotado: ${digest.bufferExhausted.length}`,
        `<p style="margin:0;">${digest.bufferExhausted
          .map((horse) => esc(horse.name))
          .join(" · ")}</p>`,
      ),
    );
  }

  return sendEmail({
    to,
    subject: `Tu semana en Relincho — ${digest.tenantName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;margin-bottom:4px;">Tu semana en Relincho</h2>
        <p style="color:#5f5f5c;margin-top:0;">${esc(digest.tenantName)} · semana del ${esc(
          shortDate(digest.weekStart),
        )}</p>
        <p>Hola ${esc(ownerName)},</p>
        ${blocks.join("")}
        <p>
          <a href="${base}/${encodeURIComponent(digest.tenantSlug)}/rendimiento"
             style="background:#171717;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Abrir el panel de rendimiento
          </a>
        </p>
        <p style="color:#888;font-size:12px;">
          Relincho · Gestión equina profesional<br>
          Recibes este resumen por ser responsable de ${esc(digest.tenantName)}.
        </p>
      </div>
    `,
  });
}
