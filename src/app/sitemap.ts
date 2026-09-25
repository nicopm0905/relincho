import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/utils";

/**
 * Solo se anuncia lo público. El panel de cada yeguada vive bajo un slug
 * arbitrario y exige sesión, así que no tiene sentido listarlo: quien intente
 * entrar acaba en el acceso.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getBaseUrl();
  const now = new Date();

  const routes: { path: string; priority: number; frequency: "daily" | "weekly" | "monthly" | "yearly" }[] = [
    { path: "", priority: 1, frequency: "weekly" },
    { path: "/demo", priority: 0.9, frequency: "weekly" },
    { path: "/precios", priority: 0.9, frequency: "weekly" },
    { path: "/fundadores", priority: 0.7, frequency: "monthly" },
    { path: "/contacto", priority: 0.6, frequency: "monthly" },
    { path: "/privacidad", priority: 0.3, frequency: "yearly" },
    { path: "/terminos", priority: 0.3, frequency: "yearly" },
    { path: "/cookies", priority: 0.3, frequency: "yearly" },
  ];

  return routes.map((route) => ({
    url: `${base}${route.path}`,
    lastModified: now,
    changeFrequency: route.frequency,
    priority: route.priority,
  }));
}
