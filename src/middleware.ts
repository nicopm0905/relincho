import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth/config";

const { auth } = NextAuth(authConfig);

/**
 * Anota la ruta solicitada en una cabecera. Los layouts la leen para devolver
 * al usuario a donde iba despues de iniciar sesion, por ejemplo la ficha del
 * caballo cuyo QR acaba de escanear en la puerta del box.
 */
export default auth((request) => {
  const headers = new Headers(request.headers);
  headers.set(
    "x-requested-path",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.next({ request: { headers } });
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
