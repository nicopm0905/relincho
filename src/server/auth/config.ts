import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

export const authConfig: NextAuthConfig = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
