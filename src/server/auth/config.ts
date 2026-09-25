import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/** Google esta disponible solo si existen las dos credenciales. */
export const googleAuthEnabled = Boolean(googleClientId && googleClientSecret);

/**
 * El enlace magico necesita un remitente con dominio verificado en Resend.
 * Mientras no exista, el formulario se esconde en produccion para no prometer
 * un correo que rebotaria; en local se mantiene, porque el enlace se imprime en
 * la consola y no depende de ningun servicio externo.
 */
export const emailAuthEnabled =
  process.env.EMAIL_LOGIN_ENABLED === "true" ||
  (process.env.NODE_ENV !== "production" && !googleAuthEnabled);

/** Si no hay ninguna via, la pantalla de acceso lo dice en vez de fallar. */
export const hasAnyAuthProvider = googleAuthEnabled || emailAuthEnabled;

export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    ...(googleAuthEnabled
      ? [
          Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
            // Un usuario invitado por email (Ajustes > Equipo) o que entro por
            // enlace magico existe sin cuenta de Google: sin esto, al entrar
            // con Google recibia OAuthAccountNotLinked. Google solo entrega
            // emails verificados, y quien controla ese correo ya podia entrar
            // con un enlace magico, asi que vincular por email no abre nada.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  callbacks: {
    /** La vinculacion por email solo es segura con emails verificados por Google. */
    signIn({ account, profile }) {
      if (account?.provider === "google") return profile?.email_verified === true;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
    session({ session, token, user }) {
      if (token?.sub) {
        session.user.id = token.sub;
      } else if (user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
};
