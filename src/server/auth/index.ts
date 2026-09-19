import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { authConfig, emailAuthEnabled } from "./config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prismaAdapter = new PrismaPg(pool);
const authPrisma = new PrismaClient({ adapter: prismaAdapter });

/**
 * Alterar `emailAuthEnabled` (EMAIL_LOGIN_ENABLED) enciende o apaga el acceso
 * por email. No se registra el proveedor cuando no hay forma de entregarlo: asi
 * nadie puede pedir un enlace que nunca llegaria.
 */
const emailProvider = emailAuthEnabled
  ? Resend({
      apiKey: process.env.RESEND_API_KEY || "missing",
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      async sendVerificationRequest(params) {
        // En local el enlace se imprime en la consola: no hace falta dominio
        // verificado ni gastar cuota de Resend durante el desarrollo.
        if (process.env.NODE_ENV !== "production") {
          console.log(
            `\n\n[DEV LOGIN LINK] Inicia sesion como ${params.identifier}:\n${params.url}\n\n`,
          );
          return;
        }

        if (!process.env.RESEND_API_KEY) {
          throw new Error("RESEND_API_KEY no esta configurado");
        }
        if (!process.env.EMAIL_FROM) {
          throw new Error(
            "EMAIL_FROM no esta configurado: Resend solo envia desde un dominio verificado",
          );
        }

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: params.provider.from,
            to: params.identifier,
            subject: "Inicia sesión en Relincho",
            html: `<p>Haz clic en este <a href="${params.url}">enlace</a> para iniciar sesión.</p>`,
          }),
        });
        // Resend responde con 200 y un error dentro del cuerpo en algunos
        // rechazos, asi que no basta con mirar el status.
        const payload = (await res.json().catch(() => null)) as {
          error?: unknown;
        } | null;
        if (!res.ok || payload?.error) {
          throw new Error(
            `Resend rechazo el envio: ${JSON.stringify(payload?.error ?? res.status)}`,
          );
        }
      },
    })
  : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    ...(emailProvider ? [emailProvider] : []),
  ],
  adapter: PrismaAdapter(authPrisma),
  session: { strategy: "jwt" },
});
