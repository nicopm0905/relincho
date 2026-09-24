import type { Metadata } from "next";
import { Newsreader, Inter, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { getBaseUrl } from "@/lib/utils";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-heading",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.home");
  const title = t("title");
  const description = t("description");

  return {
    // Sin `metadataBase`, las rutas relativas de las imágenes sociales se
    // resuelven mal y las vistas previas salen sin imagen.
    metadataBase: new URL(getBaseUrl()),
    title,
    description,
    // La imagen se genera en `opengraph-image.tsx`: nada que subir a mano.
    openGraph: {
      type: "website",
      siteName: "Relincho",
      title,
      description,
      locale: "es_ES",
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

import { CookieBanner } from "@/components/cookie-banner";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, messages, common] = await Promise.all([
    getLocale(),
    getMessages(),
    getTranslations("common"),
  ]);

  return (
    <html lang={locale}>
      <body
        className={`${inter.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main-content"
            className="fixed top-3 left-3 z-[100] -translate-y-20 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background shadow-lg transition-transform focus:translate-y-0"
          >
            {common("skipToContent")}
          </a>
          {children}
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
