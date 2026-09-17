"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { CARD_CAMPO, CARD_CUADRA, CARD_TEXTURA, EASE, LOGO } from "./assets";
import { ArbolClasificacion } from "./arbol-clasificacion";

const QA_COUNT = 3;

interface CardFooterProps {
  title: string;
  body: string;
}

/** Bloque de titulo comun a las tres tarjetas. */
function CardFooter({ title, body }: CardFooterProps) {
  return (
    <div className="relative z-[2] px-6 pt-6 pb-6 md:absolute md:right-6 md:bottom-7 md:left-6 md:p-0">
      <p
        className="font-heading font-normal text-white italic"
        style={{ fontSize: 26, marginBottom: 8 }}
      >
        {title}
      </p>
      <p
        className="font-sans text-[13px] font-normal"
        style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.65)" }}
      >
        {body}
      </p>
    </div>
  );
}

export function IaV2() {
  const t = useTranslations("landingV2.ia");
  const reduceMotion = useReducedMotion();
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-100px" });
  const [qIdx, setQIdx] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const rotation = setInterval(
      () => setQIdx((current) => (current + 1) % QA_COUNT),
      4000,
    );
    return () => clearInterval(rotation);
  }, [reduceMotion]);

  return (
    <section
      id="ia"
      className="overflow-hidden px-5 py-16 md:px-12 md:py-20"
      style={{ backgroundColor: "#0b0d08" }}
    >
      <div ref={headerRef} className="mb-16 text-center">
        <p
          className="font-sans text-xs font-medium"
          style={{
            letterSpacing: 2,
            color: "rgba(255,255,255,0.50)",
            marginBottom: 16,
          }}
        >
          {t("eyebrow")}
        </p>

        <motion.h2
          initial={{ opacity: 0, filter: "blur(12px)", y: 30 }}
          animate={isInView ? { opacity: 1, filter: "blur(0px)", y: 0 } : undefined}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-white"
          style={{
            fontSize: "clamp(2.25rem, 6vw, 4.5rem)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          <span className="font-sans font-normal">{t("titleLead")}</span>
          <span className="font-heading font-normal italic">{t("titleAccent")}</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, filter: "blur(8px)", y: 20 }}
          animate={isInView ? { opacity: 1, filter: "blur(0px)", y: 0 } : undefined}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-4 max-w-2xl font-sans text-base font-normal"
          style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.60)" }}
        >
          {t("subtitle")}
        </motion.p>
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col items-stretch gap-4 md:flex-row">
        {/* ── Tarjeta 1 — preguntas en lenguaje natural ─────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
          className="relative flex-1 overflow-hidden rounded-3xl md:min-h-[560px]"
        >
          <Image
            src={CARD_CUADRA}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="z-0 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "rgba(0,0,0,0.30)" }}
          />

          <div
            className="relative z-[2] m-6 backdrop-blur-[56px] md:absolute md:top-8 md:right-6 md:left-6 md:m-0"
            style={{
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.20)",
              backgroundColor: "rgba(255,255,255,0.10)",
              padding: 20,
            }}
          >
            <div className="mb-4 flex items-center gap-2.5">
              <span
                className="flex items-center justify-center bg-white"
                style={{ width: 40, height: 40, borderRadius: 12 }}
              >
                <Image
                  src={LOGO}
                  alt=""
                  aria-hidden
                  width={22}
                  height={22}
                  className="object-contain"
                />
              </span>
              <span className="font-sans text-base font-medium text-white">
                {t("brand")}
              </span>
            </div>

            <div
              aria-hidden
              style={{
                borderTop: "1px dashed rgba(255,255,255,0.20)",
                marginBottom: 16,
              }}
            />

            <div className="relative min-h-[160px] md:h-[160px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={qIdx}
                  initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
                  animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  exit={{ opacity: 0, filter: "blur(8px)", y: -6 }}
                  transition={{ duration: 0.6, ease: EASE }}
                  className="md:absolute md:inset-0"
                >
                  <p
                    className="font-sans text-base font-medium text-white"
                    style={{ marginBottom: 12, lineHeight: 1.4 }}
                  >
                    {t(`q${qIdx + 1}`)}
                  </p>
                  <div className="flex items-start gap-2">
                    <span
                      className="flex shrink-0 items-center justify-center"
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        backgroundColor: "rgba(255,255,255,0.15)",
                      }}
                    >
                      <Image
                        src={LOGO}
                        alt=""
                        aria-hidden
                        width={12}
                        height={12}
                        className="object-contain opacity-80"
                      />
                    </span>
                    <p
                      className="font-sans text-xs font-normal"
                      style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.55)" }}
                    >
                      {t(`a${qIdx + 1}`)}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="flex items-center gap-2 border-0 font-sans text-[13px] font-medium"
                style={{
                  backgroundColor: "#fff",
                  color: "#000",
                  padding: "6px 6px 6px 16px",
                  borderRadius: 9999,
                }}
              >
                {t("tryAssistant")}
                <span
                  className="flex items-center justify-center rounded-full"
                  style={{ width: 22, height: 22, backgroundColor: "#000" }}
                >
                  <ArrowUpRight size={12} color="#fff" />
                </span>
              </button>
              <span
                className="font-sans text-[13px] font-medium underline"
                style={{ color: "rgba(255,255,255,0.80)" }}
              >
                {t("askYours")}
              </span>
            </div>
          </div>

          <CardFooter title={t("card1Title")} body={t("card1Body")} />
        </motion.div>

        {/* ── Tarjeta 2 — prediccion y prevision ────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.35, ease: "easeOut" }}
          className="relative flex-1 overflow-hidden rounded-3xl md:min-h-[560px]"
        >
          <Image
            src={CARD_CAMPO}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="z-0 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "rgba(0,0,0,0.20)" }}
          />

          <div
            className="relative z-[2] m-6 text-center md:absolute md:top-8 md:right-6 md:left-6 md:m-0"
            style={{
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.92)",
              padding: "24px 20px 20px",
            }}
          >
            <p
              className="font-sans text-xs font-normal"
              style={{ color: "rgba(0,0,0,0.50)", lineHeight: 1.5, marginBottom: 4 }}
            >
              {t("forecastLabelTop")}
              <br />
              {t("forecastLabelBottom")}
            </p>
            <p
              className="font-heading font-normal italic"
              style={{
                fontSize: 52,
                color: "#000",
                letterSpacing: "-1px",
                lineHeight: 1,
              }}
            >
              {t("forecastValue")}
            </p>

            <div aria-hidden style={{ height: 16 }} />

            <div
              aria-hidden
              className="relative mx-auto max-w-full"
              style={{ width: 280, height: 145, overflow: "visible" }}
            >
              {/* El y negativo del viewBox deja aire arriba para el punto flotante. */}
              <svg
                viewBox="60 -25 220 145"
                width="100%"
                height="100%"
                preserveAspectRatio="none"
                style={{ overflow: "visible" }}
              >
                <defs>
                  <linearGradient id="rlv2AreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(163,184,70,0.85)" />
                    <stop offset="100%" stopColor="rgba(163,184,70,0.10)" />
                  </linearGradient>
                  <clipPath id="rlv2Reveal">
                    <motion.rect
                      x={60}
                      y={-25}
                      height={145}
                      initial={{ width: 0 }}
                      animate={isInView ? { width: 220 } : undefined}
                      transition={{ duration: 1.4, delay: 0.3, ease: "easeOut" }}
                    />
                  </clipPath>
                </defs>

                <g clipPath="url(#rlv2Reveal)">
                  <path
                    d="M 60 75 L 150 20 L 280 28 L 280 120 L 60 120 Z"
                    fill="url(#rlv2AreaFill)"
                  />
                  <path
                    d="M 60 75 L 150 20 L 280 28"
                    fill="none"
                    stroke="#7d9033"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <line
                    x1={60}
                    y1={75}
                    x2={60}
                    y2={120}
                    stroke="#7d9033"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                  <line
                    x1={280}
                    y1={28}
                    x2={280}
                    y2={120}
                    stroke="#7d9033"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                    opacity={0.6}
                  />
                  <motion.line
                    x1={150}
                    y1={-15}
                    x2={150}
                    y2={20}
                    stroke="#a3b846"
                    strokeWidth={1.2}
                    initial={{ pathLength: 0 }}
                    animate={isInView ? { pathLength: 1 } : undefined}
                    transition={{ duration: 0.5, delay: 1.4, ease: "easeOut" }}
                  />
                  <motion.circle
                    cx={150}
                    cy={-15}
                    r={4.5}
                    fill="#a3b846"
                    style={{ transformOrigin: "150px -15px" }}
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : undefined}
                    transition={{ duration: 0.3, delay: 1.7, ease: "easeOut" }}
                  />
                </g>
              </svg>
            </div>

            <p
              className="mt-4 inline-block font-sans text-[11px] backdrop-blur-[8px]"
              style={{
                borderRadius: 9999,
                border: "1px solid rgba(0,0,0,0.12)",
                backgroundColor: "rgba(255,255,255,0.80)",
                padding: "8px 16px",
                color: "rgba(0,0,0,0.60)",
              }}
            >
              {t("forecastTip")}
            </p>
          </div>

          <CardFooter title={t("card2Title")} body={t("card2Body")} />
        </motion.div>

        {/* ── Tarjeta 3 — clasificacion automatica ──────────── */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
          className="relative flex-1 overflow-hidden rounded-3xl md:min-h-[560px]"
        >
          <Image
            src={CARD_TEXTURA}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="z-0 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "rgba(0,0,0,0.30)" }}
          />

          <div className="relative z-[2] px-4 py-8 md:absolute md:top-8 md:right-4 md:bottom-[110px] md:left-4 md:p-0">
            <ArbolClasificacion
              active={isInView}
              labels={{
                raiz: t("treeRoot"),
                sanidad: t("treeHealth"),
                sanidadDetalle: t("treeHealthDetail"),
                reproduccion: t("treeRepro"),
                reproduccionDetalle: t("treeReproDetail"),
                pupilaje: t("treeBoarding"),
                pupilajeDetalle: t("treeBoardingDetail"),
              }}
            />
          </div>

          <CardFooter title={t("card3Title")} body={t("card3Body")} />
        </motion.div>
      </div>
    </section>
  );
}
