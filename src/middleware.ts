import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth/config";
import {
  ATTRIBUTION_MAX_AGE_SECONDS,
  CONSENT_COOKIE,
  parseConsent,
  ATTRIBUTION_REFERRER_COOKIE,
  ATTRIBUTION_SOURCE_COOKIE,
  normalizeSource,
  referrerHost,
} from "@/lib/attribution";

const { auth } = NextAuth(authConfig);

/**
 * Anota la ruta solicitada en una cabecera. Los layouts la leen para devolver
 * al usuario a donde iba despues de iniciar sesion, por ejemplo la ficha del
 * caballo cuyo QR acaba de escanear.
 *
 * Ademas guarda el canal de llegada: quien entra por `?src=flyer-jerez` y
 * acepta las cookies se lleva esa marca en una cookie, y el alta la escribe en
 * su yeguada.
 */
export default auth((request) => {
  const headers = new Headers(request.headers);
  headers.set(
    "x-requested-path",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  const response = NextResponse.next({ request: { headers } });

  // Solo con permiso: sin un "si" en el aviso de cookies no se guarda el
  // origen (el aviso lo guarda al aceptar si la visita trae `?src=`). Con un
  // "no", se borra lo que hubiera.
  const consent = parseConsent(request.cookies.get(CONSENT_COOKIE)?.value);
  if (consent === "no") {
    if (request.cookies.has(ATTRIBUTION_SOURCE_COOKIE)) {
      response.cookies.delete(ATTRIBUTION_SOURCE_COOKIE);
    }
    if (request.cookies.has(ATTRIBUTION_REFERRER_COOKIE)) {
      response.cookies.delete(ATTRIBUTION_REFERRER_COOKIE);
    }
  }

  // Solo el primer toque: si ya hay marca, no se pisa con la de la visita de
  // hoy (que casi siempre es "directo" o el buscador).
  if (consent === "si" && !request.cookies.has(ATTRIBUTION_SOURCE_COOKIE)) {
    const source = normalizeSource(request.nextUrl.searchParams.get("src"));
    if (source) {
      const options = {
        path: "/",
        maxAge: ATTRIBUTION_MAX_AGE_SECONDS,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
      };
      response.cookies.set(ATTRIBUTION_SOURCE_COOKIE, source, options);

      const referrer = referrerHost(request.headers.get("referer"));
      if (referrer) {
        response.cookies.set(ATTRIBUTION_REFERRER_COOKIE, referrer, options);
      }
    }
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
