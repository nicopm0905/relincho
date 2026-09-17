"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { EASE, HERO_POSTER, HERO_VIDEO } from "./assets";
import { StoryCardV2 } from "./story-card-v2";

// TODO: sustituir por logos reales con permiso de uso (public/landing-v2/logos/).
// Hasta entonces la marquesina muestra texto, no marcas ajenas.
const trustMarks = ["ANCCE", "SICAB", "RFHE", "VERI*FACTU"] as const;

function HeroBackground({ posterAlt }: { posterAlt: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // iOS solo reproduce inline y en silencio si estas flags van tambien en el DOM.
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("webkit-playsinline", "true");
    video.play().catch((error: unknown) => {
      console.warn("landing-v2: el vídeo del hero no ha podido arrancar", error);
    });
  }, []);

  if (!HERO_VIDEO) {
    return (
      <Image
        src={HERO_POSTER}
        alt={posterAlt}
        fill
        sizes="100vw"
        className="z-0 object-cover"
        priority
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 z-0 h-full w-full object-cover"
      poster={HERO_POSTER}
      autoPlay
      loop
      muted
      playsInline
      aria-label={posterAlt}
    >
      <source src={HERO_VIDEO} type="video/mp4" />
    </video>
  );
}

export function HeroV2() {
  const t = useTranslations("landingV2.hero");

  return (
    <section
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "#0b0d08" }}
    >
      <HeroBackground posterAlt={t("posterAlt")} />

      <div
        aria-hidden
        className="absolute inset-0 z-[1]"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(11,13,8,0.60) 0%, rgba(11,13,8,0.15) 50%, rgba(11,13,8,0.70) 100%)",
        }}
      />

      {/* Flujo normal en vez de `absolute inset-0`: centra igual cuando hay sitio,
          pero crece en lugar de recortarse en pantallas bajas. */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pt-28 pb-24">
        <motion.h1
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE }}
          className="m-0 text-center text-white"
          style={{
            fontSize: "clamp(2.75rem, 8vw, 6.375rem)",
            lineHeight: 0.94,
            letterSpacing: "-0.02em",
          }}
        >
          <span className="block font-sans font-normal">{t("titleLine1")}</span>
          <span className="block font-normal">
            <span className="font-sans">{t("titleLine2Lead")} </span>
            <span className="font-heading italic">{t("titleLine2Accent")}</span>
          </span>
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE }}
          className="mt-8"
        >
          <Link
            href="/login"
            className="flex items-center gap-2 font-sans text-[15px] font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: "#fff",
              color: "#000",
              padding: "6px 8px 6px 24px",
              borderRadius: 9999,
            }}
          >
            {t("cta")}
            <span
              aria-hidden
              className="flex items-center justify-center rounded-full"
              style={{ width: 24, height: 24, backgroundColor: "#000" }}
            >
              <ArrowUpRight size={14} strokeWidth={2.5} color="#fff" />
            </span>
          </Link>
        </motion.div>

        <StoryCardV2 />
      </div>

      {/* Prueba social — estorba al hero en pantallas pequenas */}
      <div className="absolute bottom-10 left-10 z-10 hidden lg:block">
        <p
          className="font-sans"
          style={{
            fontSize: 21,
            lineHeight: 1.2,
            color: "rgba(255,255,255,0.6)",
            marginBottom: 18,
          }}
        >
          {t("trustTitle")}
        </p>
        <div className="overflow-hidden" style={{ width: 430 }}>
          <div className="rlv2-marquee flex" style={{ gap: 54, width: "max-content" }}>
            {[...trustMarks, ...trustMarks].map((mark, i) => (
              <span
                key={`${mark}-${i}`}
                className="shrink-0 font-sans uppercase"
                style={{
                  fontSize: 13,
                  letterSpacing: 2,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {mark}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute right-10 bottom-10 z-10 hidden max-w-[430px] lg:block">
        <p
          className="font-sans text-white"
          style={{ fontSize: 21, lineHeight: 1.4, marginBottom: 12 }}
        >
          {t("blurb")}
        </p>
        <Link
          href="#features"
          className="font-sans text-white underline"
          style={{ fontSize: 21 }}
        >
          {t("learnMore")}
        </Link>
      </div>
    </section>
  );
}
