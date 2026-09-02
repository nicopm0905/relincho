import "server-only";
import { Resend } from "resend";

import { getBaseUrl } from "@/lib/utils";

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
