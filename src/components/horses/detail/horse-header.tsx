import Link from "next/link";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { FilePdf, PencilSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { StateBadge, type StateTone } from "@/components/ui/state-badge";
import { ageInYears, horseCategory } from "@/lib/horse-category";
import type { MareState } from "@/lib/reproduction";
import { cn } from "@/lib/utils";

type Parent = { id: string; name: string } | null | undefined;

export const mareStateTone: Record<MareState, StateTone> = {
  EMPTY: "empty",
  COVERED: "covered",
  PREGNANT: "pregnant",
  TWINS: "pregnant",
  LOST: "danger",
  FOALED: "foaled",
};

export type HorseHeaderProps = {
  tenantSlug: string;
  horse: {
    id: string;
    name: string;
    sex: string;
    status: string;
    breed: string | null;
    coat: string | null;
    birthDate: Date | null;
    photoUrl: string | null;
    uelnCode: string | null;
    microchip: string | null;
    lgNumber: string | null;
    boxLocation: string | null;
    sire: Parent;
    dam: Parent;
  };
  /** Estado reproductivo de una yegua con cubriciones. */
  repro: { state: MareState; gestation: { days: number; expected: Date; percent: number } | null } | null;
  /** Lo más urgente de sanidad. */
  health: { name: string; due: Date; overdue: boolean } | null;
  weight: { kg: number; condition: number | null } | null;
  withdrawal: { until: Date; name: string; date: Date } | null;
};

function Fact({
  label,
  value,
  hint,
  tone,
  children,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "alert";
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <dt className="text-caption font-medium text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 truncate text-body font-semibold text-foreground",
          tone === "alert" && "text-state-alert-ink",
        )}
      >
        {value}
      </dd>
      {hint && <dd className="mt-0.5 truncate text-caption text-muted-foreground">{hint}</dd>}
      {children}
    </div>
  );
}

/**
 * Who the horse is (photo, name, identifiers, parents) and how it is doing
 * (breeding, health, location), before any tab is opened.
 */
export function HorseHeader({ tenantSlug, horse, repro, health, weight, withdrawal }: HorseHeaderProps) {
  const t = useTranslations("horseDetail");
  const tHorses = useTranslations("horses");
  const format = useFormatter();
  const date = (value: Date) => format.dateTime(value, { day: "numeric", month: "short", year: "numeric" });

  const meta = [
    tHorses(`category.${horseCategory(horse)}`),
    horse.breed,
    horse.coat,
    horse.birthDate ? tHorses("age", { years: ageInYears(horse.birthDate) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const parent = (p: Parent, role: "sire" | "dam") =>
    p ? (
      <Link
        href={`/${tenantSlug}/caballos/${p.id}`}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        {p.name}
      </Link>
    ) : (
      <span className="text-muted-foreground">{role === "sire" ? t("unknownSire") : t("unknownDam")}</span>
    );

  const ids = [
    { label: t("ids.ueln"), value: horse.uelnCode },
    { label: t("ids.microchip"), value: horse.microchip },
    { label: t("ids.lg"), value: horse.lgNumber },
  ].filter((id) => id.value);

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {/* Foto y nombre en la primera fila; identificadores y acciones debajo,
            a todo el ancho en el móvil y bajo el nombre en escritorio. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-4 p-4 sm:gap-x-6 sm:p-6">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-primary/10 sm:row-span-2 sm:size-32 sm:rounded-2xl">
            {horse.photoUrl ? (
              <Image src={horse.photoUrl} alt={horse.name} fill sizes="128px" className="object-cover" priority />
            ) : (
              <span
                aria-hidden
                className="flex size-full items-center justify-center font-serif text-title font-medium text-primary-ink sm:text-display"
              >
                {horse.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="font-serif text-title font-medium text-foreground">{horse.name}</h1>
              {repro && (
                <StateBadge tone={mareStateTone[repro.state]}>{t(`mareState.${repro.state}`)}</StateBadge>
              )}
              {horse.status !== "ACTIVE" && (
                <StateBadge tone="empty">{tHorses(`status.${horse.status}` as "status.ACTIVE")}</StateBadge>
              )}
            </div>
            {meta && <p className="text-body text-muted-foreground">{meta}</p>}
            {(horse.sire || horse.dam) && (
              <p className="text-body text-muted-foreground">
                {t("childOf", { sex: horse.sex })} {parent(horse.sire, "sire")} {t("and")} {parent(horse.dam, "dam")}
              </p>
            )}
          </div>

          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1 sm:col-start-2 lg:flex-row lg:items-end lg:justify-between">
            {ids.length > 0 && (
              <dl className="flex flex-wrap gap-2">
                {ids.map((id) => (
                  <div
                    key={id.label}
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1"
                  >
                    <dt className="text-caption text-muted-foreground">{id.label}</dt>
                    <dd className="font-mono text-caption font-medium text-foreground">{id.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={`/api/horses/${horse.id}/ficha-venta`} target="_blank" rel="noreferrer">
                  <FilePdf weight="bold" />
                  {t("actions.saleSheet")}
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/${tenantSlug}/caballos/${horse.id}/editar`}>
                  <PencilSimple weight="bold" />
                  {t("actions.edit")}
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-border bg-muted/30 lg:grid-cols-4 [&>div]:border-border [&>div:nth-child(-n+2)]:border-b lg:[&>div:nth-child(-n+2)]:border-b-0 [&>div:nth-child(odd)]:border-r lg:[&>div:not(:last-child)]:border-r">
          {repro ? (
            <Fact
              label={t("facts.repro")}
              value={t(`mareState.${repro.state}`)}
              hint={repro.gestation ? t("facts.dueDate", { date: date(repro.gestation.expected) }) : undefined}
            >
              {repro.gestation && (
                <dd
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-state-pregnant-soft"
                  role="progressbar"
                  aria-label={t("repro.progress")}
                  aria-valuenow={Math.round(repro.gestation.percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span
                    className="block h-full rounded-full bg-state-pregnant"
                    style={{ width: `${Math.min(100, repro.gestation.percent)}%` }}
                  />
                </dd>
              )}
            </Fact>
          ) : (
            <Fact
              label={t("facts.weight")}
              value={weight ? `${weight.kg} kg` : "—"}
              hint={weight?.condition ? t("facts.condition", { value: weight.condition }) : undefined}
            />
          )}
          <Fact
            label={health?.overdue ? t("facts.overdueHealth") : t("facts.nextHealth")}
            value={health ? date(health.due) : t("facts.nothingDue")}
            hint={health?.name}
            tone={health?.overdue ? "alert" : undefined}
          />
          <Fact label={t("facts.location")} value={horse.boxLocation || t("facts.unassigned")} />
          <Fact
            label={t("facts.born")}
            value={horse.birthDate ? date(horse.birthDate) : "—"}
            hint={horse.birthDate ? tHorses("age", { years: ageInYears(horse.birthDate) }) : undefined}
          />
        </dl>
      </section>

      {withdrawal && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-state-danger/30 bg-state-danger-soft p-4"
        >
          <WarningCircle aria-hidden weight="fill" className="mt-0.5 h-5 w-5 shrink-0 text-state-danger" />
          <div className="text-body">
            <p className="font-semibold text-state-danger-ink">
              {t("withdrawal.title", { date: date(withdrawal.until) })}
            </p>
            <p className="mt-0.5 text-state-danger-ink">
              {t("withdrawal.body", { name: withdrawal.name, date: date(withdrawal.date) })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
