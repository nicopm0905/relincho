"use client";

import { useRef } from "react";
import Image from "next/image";
import { ArrowUpRight, Info } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useTranslations } from "next-intl";
import { CARD_CAMPO, CARD_CUADRA, LOGO, RETRATO_JINETE } from "./assets";
import { useCountUp } from "./use-count-up";

interface BarRowProps {
  label: string;
  value: string;
  /** Ancho fijo del relleno, en porcentaje. No se anima. */
  percent: number;
  fill: string;
}

function BarRow({ label, value, percent, fill }: BarRowProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between">
        <span
          className="font-sans text-[13px]"
          style={{ color: "rgba(255,255,255,0.70)" }}
        >
          {label}
        </span>
        <span className="font-sans text-[13px] font-medium text-white">
          {value}
        </span>
      </div>
      <div
        aria-hidden
        className="relative w-full"
        style={{ height: 5, borderRadius: 5, marginTop: 6 }}
      >
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.13,
            borderRadius: 5,
            backgroundImage:
              "linear-gradient(90deg, #040504 0%, rgba(4,5,4,0.5) 100%)",
          }}
        />
        <div
          className="absolute top-0 left-0 h-full"
          style={{ width: `${percent}%`, borderRadius: 5, backgroundImage: fill }}
        />
      </div>
    </div>
  );
}

export function PanelV2() {
  const t = useTranslations("landingV2.panel");
  const headerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(headerRef, { once: true, margin: "-100px" });

  const monthly = useCountUp({ from: 100, to: 14250, active: isInView });
  const today = useCountUp({ from: 10, to: 925, active: isInView });

  return (
    <section
      id="panel"
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
          <span className="block font-sans font-normal">{t("titleLead")}</span>
          <span className="block font-heading font-normal italic">
            {t("titleAccent")}
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, filter: "blur(8px)", y: 20 }}
          animate={isInView ? { opacity: 1, filter: "blur(0px)", y: 0 } : undefined}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mt-4 font-sans text-base font-normal"
          style={{ color: "rgba(255,255,255,0.60)" }}
        >
          {t("subtitle")}
        </motion.p>
      </div>

      <div className="mx-auto flex max-w-[1200px] flex-col items-stretch gap-4 md:flex-row">
        {/* ── Tarjeta 1 — resumen mensual ───────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          animate={isInView ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl md:min-h-[580px]"
          style={{ flex: 1.4 }}
        >
          <Image
            src={CARD_CUADRA}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 60vw"
            className="z-0 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          />

          {/* En movil todo el contenido pasa a flujo normal; el absolute vuelve en md. */}
          <div
            className="relative z-[2] m-6 backdrop-blur-[56px] md:absolute md:top-8 md:right-8 md:left-8 md:m-0"
            style={{
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.20)",
              backgroundColor: "rgba(255,255,255,0.10)",
              padding: "24px 28px",
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="font-sans text-[11px] font-medium"
                style={{ letterSpacing: 1.5, color: "rgba(255,255,255,0.60)" }}
              >
                {t("summaryLabel")}
              </span>
              <span
                className="font-sans text-[11px] font-medium underline"
                style={{ letterSpacing: 1.5, color: "rgba(255,255,255,0.60)" }}
              >
                {t("summaryPeriod")}
              </span>
            </div>

            <p
              className="font-sans font-normal text-white"
              style={{
                // Fluido: a 42px fijos el importe partia en dos lineas en movil.
                fontSize: "clamp(1.75rem, 7vw, 42px)",
                letterSpacing: "-1px",
                marginBottom: 24,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {monthly}
            </p>

            <div
              aria-hidden
              style={{
                borderTop: "1px dashed rgba(255,255,255,0.20)",
                marginBottom: 20,
              }}
            />

            <BarRow
              label={t("rowInvoiced")}
              value="15.500 €"
              percent={75}
              fill="linear-gradient(90deg, #a3b846 60%, rgba(163,184,70,0) 100%)"
            />
            <BarRow
              label={t("rowBoarding")}
              value="4.250 €"
              percent={45}
              fill="linear-gradient(90deg, #b48f17 56%, rgba(180,143,23,0) 100%)"
            />
            <BarRow
              label={t("rowExpenses")}
              value="8.200 €"
              percent={60}
              fill="linear-gradient(90deg, #fff 52%, rgba(255,255,255,0) 100%)"
            />
          </div>

          <div className="relative z-[2] px-6 pb-6 md:absolute md:right-8 md:bottom-[22px] md:left-8 md:p-0">
            <p
              className="font-heading font-normal text-white italic"
              style={{ fontSize: 26, marginBottom: 8 }}
            >
              {t("card1Title")}
            </p>
            <p
              className="font-sans text-[13px] font-normal"
              style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.65)" }}
            >
              {t("card1Body")}
            </p>
          </div>
        </motion.div>

        {/* ── Tarjeta 2 — cobro del dia ─────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 60 }}
          animate={isInView ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl md:min-h-[580px]"
          style={{ flex: 1 }}
        >
          <Image
            src={CARD_CAMPO}
            alt=""
            aria-hidden
            fill
            sizes="(max-width: 768px) 100vw, 40vw"
            className="z-0 object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 z-[1]"
            style={{ backgroundColor: "rgba(0,0,0,0.25)" }}
          />

          <span
            className="absolute top-6 right-6 z-[2] font-sans text-[11px] font-medium underline"
            style={{ letterSpacing: 1.5, color: "rgba(255,255,255,0.70)" }}
          >
            {t("dailyLabel")}
          </span>

          <div
            className="relative z-[2] mx-6 mt-6 md:absolute md:top-8 md:left-8 md:m-0"
            style={{
              width: 200,
              borderRadius: 16,
              backgroundColor: "#fff",
              padding: "16px 18px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.20)",
            }}
          >
            <div className="flex items-start justify-between">
              <span
                className="font-sans font-normal"
                style={{
                  fontSize: 22,
                  color: "#000",
                  letterSpacing: "-0.5px",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {today}
              </span>
              <Info size={16} color="rgba(0,0,0,0.35)" aria-hidden />
            </div>
            <p
              className="font-sans text-xs"
              style={{ color: "rgba(0,0,0,0.45)", marginBottom: 14 }}
            >
              {t("collectedToday")}
            </p>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="flex w-full items-center justify-between border-0 font-sans text-[13px] font-medium"
              style={{
                backgroundColor: "#000",
                color: "#fff",
                padding: "10px 14px",
                borderRadius: 9999,
              }}
            >
              {t("viewMovement")}
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 24,
                  height: 24,
                  backgroundColor: "rgba(255,255,255,0.15)",
                }}
              >
                <ArrowUpRight size={13} color="#fff" />
              </span>
            </button>
          </div>

          <div className="relative z-[2] mx-auto mt-6 w-[200px] md:absolute md:bottom-[140px] md:left-1/2 md:mt-0 md:-translate-x-1/2">
            <Image
              src={RETRATO_JINETE}
              alt={t("portraitAlt")}
              width={200}
              height={240}
              sizes="200px"
              className="object-cover"
              style={{ objectPosition: "top center", borderRadius: 16, height: 240 }}
            />
          </div>

          <div className="relative z-[3] mt-4 flex items-center justify-center gap-2 md:absolute md:right-6 md:bottom-[160px] md:mt-0 md:justify-start">
            <span
              className="flex items-center gap-2 backdrop-blur-[12px]"
              style={{
                backgroundColor: "rgba(255,255,255,0.15)",
                borderRadius: 9999,
                padding: "8px 16px 8px 10px",
              }}
            >
              <Image
                src={LOGO}
                alt=""
                aria-hidden
                width={20}
                height={20}
                className="h-5 w-5 object-contain"
              />
              <span className="font-sans text-sm font-medium text-white">
                Relincho
              </span>
            </span>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              className="flex items-center justify-center rounded-full border-0 backdrop-blur-[12px]"
              style={{
                width: 36,
                height: 36,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            >
              <ArrowUpRight size={16} color="#fff" />
            </button>
          </div>

          <div className="relative z-[2] px-6 pt-6 pb-6 md:absolute md:right-8 md:bottom-[22px] md:left-8 md:p-0">
            <p
              className="font-heading font-normal text-white italic"
              style={{ fontSize: 24, marginBottom: 8 }}
            >
              {t("card2Title")}
            </p>
            <p
              className="font-sans text-[13px] font-normal"
              style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.65)" }}
            >
              {t("card2Body")}
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
