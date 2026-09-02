import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Resend from "next-auth/providers/resend";
import { authConfig } from "./config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prismaAdapter = new PrismaPg(pool);
const authPrisma = new PrismaClient({ adapter: prismaAdapter });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Resend({
      apiKey: process.env.RESEND_API_KEY || "missing",
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      async sendVerificationRequest(params) {
        if (process.env.NODE_ENV === "development") {
          console.log(`\n\n[DEV LOGIN LINK] Haz click en el siguiente enlace para iniciar sesión como ${params.identifier}:\n${params.url}\n\n`);
          return;
        }
        
        if (!process.env.RESEND_API_KEY) {
          throw new Error("RESEND_API_KEY no está configurado");
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
        if (!res.ok) throw new Error("Resend error: " + await res.text());
      }
    }),
  ],
  adapter: PrismaAdapter(authPrisma),
  session: { strategy: "jwt" },
});
