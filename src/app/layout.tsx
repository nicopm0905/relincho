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
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${inter.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
