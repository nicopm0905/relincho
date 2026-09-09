import "server-only";

import { headers } from "next/headers";

/**
 * URL de login que recuerda a donde iba el usuario. La ruta la deja el
 * middleware en una cabecera, porque un componente de servidor no puede leer
 * la direccion actual por si mismo.
 */
export async function loginUrlForCurrentPage(fallback = "/dashboard") {
  const requested = (await headers()).get("x-requested-path");
  const target = requested && requested.startsWith("/") ? requested : fallback;
  if (target === "/login" || target.startsWith("/login/")) return "/login";
  return `/login?callbackUrl=${encodeURIComponent(target)}`;
}
