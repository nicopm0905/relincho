import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/utils";

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // El panel va bajo el slug de cada yeguada y no se puede excluir por
        // ruta; lo que sí se cierra es todo lo que no debe indexarse nunca.
        disallow: ["/api/", "/login", "/onboarding", "/dashboard"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
