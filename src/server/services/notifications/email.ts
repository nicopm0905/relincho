import "server-only";
import { Resend } from "resend";

import { getBaseUrl } from "@/lib/utils";
import type { WeeklyDigest } from "@/server/services/performance/digest";
import { workTypeLabels } from "@/components/rendimiento/labels";

const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");
const FROM = process.env.EMAIL_FROM ?? "Relincho <hola@Relincho.es>";

export async function sendHealthReminder(opts: {
  to: string;
  ownerName: string;
  horseName: string;
  eventName: string;
  eventType: string;
  dueDate: Date;
  tenantName: string;
  tenantSlug: string;
}) {
  const { to, ownerName, horseName, eventName, dueDate, tenantName, tenantSlug } = opts;
  const formattedDate = dueDate.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Recordatorio: ${eventName} de ${horseName} en 7 días`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;">Recordatorio sanitario — ${tenantName}</h2>
        <p>Hola ${ownerName},</p>
        <p>Te recordamos que <strong>${horseName}</strong> tiene pendiente:</p>
        <div style="background:#f5f5f5;border-radius:8px;padding:16px;margin:16px 0;">
          <strong>${eventName}</strong><br>
          Fecha prevista: <strong>${formattedDate}</strong>
        </div>
        <p>
          <a href="${getBaseUrl()}/${tenantSlug}/sanidad"
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
}) {
  const { to, tenantName, inviterName, url } = opts;
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Te han invitado a ${tenantName} en Relincho`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;">Te han invitado a ${tenantName}</h2>
        <p>
          ${inviterName ? `${inviterName} te ha` : "Te han"} dado acceso al equipo
          de <strong>${tenantName}</strong> en Relincho.
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

export async function sendMagicLink(opts: {
  to: string;
  url: string;
}) {
  await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "Tu enlace de acceso a Relincho",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #171717;">Accede a Relincho</h2>
        <p>Haz clic en el botón para iniciar sesión. El enlace caduca en 24 horas.</p>
        <p>
          <a href="${opts.url}"
             style="background:#171717;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            Iniciar sesión
          </a>
        </p>
        <p style="color:#888;font-size:12px;">Si no solicitaste este enlace, ignora este email.</p>
      </div>
    `,
  });
}

/** Nombres y titulos vienen de la base de datos: al HTML no entra nada crudo. */
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
}) {
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

  await resend.emails.send({
    from: FROM,
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
          <a href="${base}/${digest.tenantSlug}/rendimiento"
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
