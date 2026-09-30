"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  FOUNDER,
  FOUNDER_HORIZONS_YEARS,
  PLAN_DEFINITIONS,
  annualMonthlyEquivalent,
  formatEuro,
  founderPrice,
  founderSavings,
  planPrice,
  type BillingInterval,
  type PlanKey,
} from "@/lib/pricing";

/** Solo los planes de pago tienen precio de fundador. */
const PAID_PLANS: readonly PlanKey[] = ["cuadra", "rendimiento", "yeguada"];

interface FounderCalculatorProps {
  /** Plazas libres; null si la base de datos no respondió (se oculta el contador). */
  spotsLeft: number | null;
  /** Meses enteros gratis que quedan hasta el primer cobro (se calcula en el servidor). */
  freeMonths: number;
  /** A dónde lleva el botón de reservar plaza. */
  signupHref?: string;
}

/**
 * Franja de fundador de /precios con calculadora: el visitante elige plan,
 * forma de pago y plazo, y ve lo que pagaría con y sin precio de fundador.
 * Todas las cifras salen de `@/lib/pricing`.
 */
export function FounderCalculator({
  spotsLeft,
  freeMonths,
  signupHref = "/login",
}: FounderCalculatorProps) {
  const t = useTranslations("marketing.pricing.founder");
  const tp = useTranslations("marketing.pricing");

  const [plan, setPlan] = useState<PlanKey>("rendimiento");
  const [interval, setInterval] = useState<BillingInterval>("year");
  const [years, setYears] = useState<number>(5);

  const { list, founder, saved } = founderSavings(plan, interval, years);
  const period = interval === "year" ? tp("perYear") : tp("perMonth");
  const founderRatio = list > 0 ? founder / list : 1;

  // Los meses gratis se valoran a lo que pagaría hoy alguien sin plaza de
  // fundador (en anual, su equivalente mensual).
  const listMonthly =
    interval === "year"
      ? annualMonthlyEquivalent(PLAN_DEFINITIONS[plan].monthly)
      : PLAN_DEFINITIONS[plan].monthly;
  const freeValue = Math.round(listMonthly * freeMonths);

  const rules = ["forLife", "comeBack", "notice", "noLockIn"] as const;

  return (
    <div className="rounded-[2rem] border-2 border-primary bg-[#f9f9f6] px-4 py-6 sm:p-6 md:p-10">
      <div className="text-center">
        <span className="inline-flex rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wider text-primary-foreground uppercase">
          {t("badge")}
        </span>
        <h2 className="mt-4 font-heading text-2xl text-foreground text-balance md:text-3xl">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          {t("subtitle", { slots: FOUNDER.slots })}
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 md:gap-8">
        {/* Controles */}
        <div className="space-y-5">
          <Segmented
            label={t("calc.plan")}
            value={plan}
            onChange={setPlan}
            options={PAID_PLANS.map((key) => ({
              value: key,
              label: tp(`plans.${key}.name`),
            }))}
          />
          <Segmented
            label={t("calc.billing")}
            value={interval}
            onChange={setInterval}
            options={[
              { value: "month" as const, label: tp("monthly") },
              { value: "year" as const, label: tp("annual") },
            ]}
          />
          <Segmented
            label={t("calc.horizon")}
            value={years}
            onChange={setYears}
            options={FOUNDER_HORIZONS_YEARS.map((n) => ({
              value: n,
              label: t("calc.years", { n }),
            }))}
          />

          <p className="text-sm text-muted-foreground">
            {t.rich("calc.perCharge", {
              founder: formatEuro(founderPrice(plan, interval)) + period,
              list: formatEuro(planPrice(plan, interval)) + period,
              strong: (chunks) => (
                <strong className="font-semibold text-foreground">{chunks}</strong>
              ),
            })}
          </p>
        </div>

        {/* Resultado */}
        <div
          className="rounded-[1.5rem] border border-border/60 bg-white p-5 shadow-bento sm:p-6"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-muted-foreground">
            {t("calc.savedIn", { years: t("calc.years", { n: years }) })}
          </p>
          <p className="mt-1 font-heading text-4xl font-bold whitespace-nowrap text-primary-ink md:text-5xl">
            {formatEuro(saved)}
          </p>

          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{t("calc.withoutFounder")}</dt>
                <dd className="font-semibold whitespace-nowrap text-muted-foreground line-through decoration-1">
                  {formatEuro(list)}
                </dd>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-muted-foreground/25" aria-hidden />
            </div>
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-semibold text-foreground">{t("calc.asFounder")}</dt>
                <dd className="font-bold whitespace-nowrap text-foreground">
                  {formatEuro(founder)}
                </dd>
              </div>
              <div className="mt-1.5 h-2.5 rounded-full bg-muted" aria-hidden>
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${Math.round(founderRatio * 100)}%` }}
                />
              </div>
            </div>
          </dl>

          {freeMonths > 0 && (
            <p className="mt-5 rounded-xl bg-primary/10 px-4 py-3 text-sm text-foreground">
              {t("calc.freeExtra", {
                n: freeMonths,
                amount: formatEuro(freeValue),
              })}
            </p>
          )}

          <p className="mt-4 text-xs text-muted-foreground">
            {t("calc.note")}
            {PLAN_DEFINITIONS[plan].startsAt && <> {t("calc.fromNote")}</>}
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-border/60 pt-6">
        <h3 className="text-center font-heading text-lg font-bold text-foreground">
          {t("rules.title")}
        </h3>
        <ul className="mx-auto mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
          {rules.map((rule) => (
            <li key={rule} className="flex items-start gap-3 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t(`rules.${rule}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3">
        <Button
          asChild
          className="h-auto min-h-12 w-full px-8 py-3 text-center text-base whitespace-normal sm:w-auto"
        >
          <Link href={signupHref}>{t("calc.cta")}</Link>
        </Button>
        {spotsLeft !== null && (
          <p className="font-semibold text-primary-ink">{t("left", { n: spotsLeft })}</p>
        )}
      </div>
    </div>
  );
}

function Segmented<T extends string | number>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-foreground">{label}</p>
      <div
        role="group"
        aria-label={label}
        className="grid gap-1 rounded-2xl border border-border/60 bg-white p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-xl px-1 py-2 text-xs font-semibold whitespace-nowrap transition-colors min-[400px]:text-[13px] sm:px-3 sm:text-sm ${
              value === option.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
