import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA (E4). Instalada en la pantalla de inicio, Relincho se
 * abre como una app y puede recibir push; en iOS es la única forma (16.4+).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Relincho",
    short_name: "Relincho",
    description: "Tu caballo y tu centro hípico, en el móvil.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#f7f8f4",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
