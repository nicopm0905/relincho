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
};

export default withNextIntl(nextConfig);
