import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // La metadata en streaming choca con el layout raiz (lee cookies() para el
  // locale): cada pagina renderiza dinamico y el boundary de metadata
  // desincroniza servidor/cliente, tirando el arbol entero al hidratar y
  // dejando los botones sin enganchar. Se sirve como los bots: bloqueante.
  // No quitar mientras el locale salga de una cookie en el layout raiz.
  htmlLimitedBots: /.*/,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react", "lucide-react", "framer-motion"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  serverExternalPackages: ["@prisma/client", "prisma", "pdfkit"],
  // Service worker de los avisos push (E4): sin caché, para que el navegador
  // coja siempre la última versión, y con CSP propia (guía PWA de Next).
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
