import type { Metadata } from "next";
import { Newsreader, Inter, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Relincho — Gestión equina para yeguadas PRE",
  description:
    "Software de gestión para yeguadas y picaderos en Andalucía. Sanidad, reproducción, pupilaje y facturación Veri*Factu.",
};

import { CookieBanner } from "@/components/cookie-banner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <CookieBanner />
      </body>
    </html>
  );
}
