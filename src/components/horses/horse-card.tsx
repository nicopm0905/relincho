import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { CheckCircle, Warning } from "@phosphor-icons/react/dist/ssr";
import type { ReproPhase } from "@/lib/repro-engine";
import { ageInYears, horseCategory } from "@/lib/horse-category";
import { cn } from "@/lib/utils";
import { StateBadge } from "@/components/ui/state-badge";
import { ReproPhaseBadge } from "@/components/reproduction/repro-phase-badge";

export type HorseRow = {
  id: string;
  name: string;
  sex: string;
  status: string;
  breed: string | null;
  coat: string | null;
  birthDate: Date | null;
  photoUrl: string | null;
  uelnCode: string | null;
  boxLocation?: string | null;
  /** Fase reproductiva de las yeguas en seguimiento. */
  phase?: ReproPhase;
  /** Lo más urgente de sanidad, ya en palabras. */
  healthNote?: { label: string; overdue: boolean };
};

/** Photo, or the initial as a portrait when there is none. */
export function HorseAvatar({
  horse,
  className,
}: {
  horse: Pick<HorseRow, "name" | "photoUrl">;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10",
        className,
      )}
    >
      {horse.photoUrl ? (
        <Image src={horse.photoUrl} alt="" fill sizes="64px" className="object-cover" />
      ) : (
        <span aria-hidden className="font-serif text-heading font-medium text-primary-ink">
          {horse.name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function useHorseFacts() {
  const t = useTranslations("horses");
  return (horse: HorseRow) =>
    [
      t(`category.${horseCategory(horse)}`),
      horse.birthDate ? t("age", { years: ageInYears(horse.birthDate) }) : null,
      horse.coat,
    ]
      .filter(Boolean)
      .join(" · ");
}

export function HorseHealthNote({ note }: { note?: HorseRow["healthNote"] }) {
  const t = useTranslations("horses");
  if (!note) {
    return (
      <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
        <CheckCircle aria-hidden weight="fill" className="h-3.5 w-3.5 text-state-ok" />
        {t("healthOk")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 text-caption",
        note.overdue ? "font-semibold text-state-alert-ink" : "text-muted-foreground",
      )}
    >
      <Warning
        aria-hidden
        weight={note.overdue ? "fill" : "regular"}
        className={cn("h-3.5 w-3.5 shrink-0", note.overdue && "text-state-alert")}
      />
      <span className="truncate">{note.label}</span>
    </span>
  );
}

/**
 * One horse at a glance: who it is, what state it is in and whether anything
 * is due. Wide rather than tall, so a screen holds a whole paddock.
 */
export function HorseCard({ horse, tenantSlug }: { horse: HorseRow; tenantSlug: string }) {
  const t = useTranslations("horses");
  const facts = useHorseFacts();
  const inactive = horse.status !== "ACTIVE";

  return (
    <Link
      href={`/${tenantSlug}/caballos/${horse.id}`}
      className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-200 hover:border-primary/30 hover:shadow-raised"
    >
      <div className="flex items-start gap-3">
        <HorseAvatar horse={horse} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-body font-semibold text-foreground group-hover:text-primary-ink">
              {horse.name}
            </h3>
            {horse.phase ? (
              <ReproPhaseBadge phase={horse.phase} />
            ) : inactive ? (
              <StateBadge tone="empty">{t(`status.${horse.status}` as "status.ACTIVE")}</StateBadge>
            ) : null}
          </div>
          <p className="truncate text-label text-muted-foreground">{facts(horse)}</p>
          {horse.boxLocation && (
            <p className="truncate text-caption text-muted-foreground">{horse.boxLocation}</p>
          )}
        </div>
      </div>
      <div className="mt-auto border-t border-border/70 pt-2.5">
        <HorseHealthNote note={horse.healthNote} />
      </div>
    </Link>
  );
}
