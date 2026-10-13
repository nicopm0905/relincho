"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  MagnifyingGlass,
  Plus,
  Horse as HorseIcon,
  X,
  SquaresFour,
  Rows,
  Warning,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState } from "@/components/ui/empty-state";
import { StateBadge } from "@/components/ui/state-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HorseAvatar,
  HorseCard,
  HorseHealthNote,
  type HorseRow,
} from "@/components/horses/horse-card";
import { ReproPhaseBadge } from "@/components/reproduction/repro-phase-badge";
import { HorseImportDialog } from "@/components/horses/horse-import-dialog";
import { ageInYears, horseCategory } from "@/lib/horse-category";
import { cn } from "@/lib/utils";

const CATEGORIES = ["all", "mare", "stallion", "young", "gelding"] as const;
type CategoryFilter = (typeof CATEGORIES)[number];
const STATUSES = ["census", "IN_TRAINING", "RETIRED", "SOLD", "DEAD", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];
type View = "cards" | "table";

function matchesCategory(horse: HorseRow, filter: CategoryFilter) {
  if (filter === "all") return true;
  const category = horseCategory(horse);
  if (filter === "young") return category === "colt" || category === "filly";
  return category === filter;
}

function matchesStatus(horse: HorseRow, filter: StatusFilter) {
  if (filter === "all") return true;
  // "En la yeguada" es el censo vivo: los ancestros fallecidos o vendidos
  // están para el pedigrí, no para el trabajo diario.
  if (filter === "census") return horse.status === "ACTIVE" || horse.status === "IN_TRAINING";
  return horse.status === filter;
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-label font-medium transition-colors duration-150",
        pressed
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function HorsesExplorer({
  horses,
  tenantSlug,
}: {
  horses: HorseRow[];
  tenantSlug: string;
}) {
  const t = useTranslations("horses");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("census");
  const [alertsOnly, setAlertsOnly] = useState(false);
  // La vista vive en la URL (?vista=tabla): se puede compartir y sobrevive
  // a volver atrás desde una ficha, sin depender del almacenamiento local.
  const searchParams = useSearchParams();
  const view: View = searchParams.get("vista") === "tabla" ? "table" : "cards";
  const chooseView = (next: View) => {
    const url = new URL(window.location.href);
    if (next === "table") url.searchParams.set("vista", "tabla");
    else url.searchParams.delete("vista");
    window.history.replaceState(window.history.state, "", url);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return horses.filter((horse) => {
      if (!matchesStatus(horse, status)) return false;
      if (!matchesCategory(horse, category)) return false;
      if (alertsOnly && !horse.healthNote?.overdue) return false;
      if (!needle) return true;
      return [horse.name, horse.breed, horse.coat, horse.uelnCode, horse.boxLocation]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [horses, query, category, status, alertsOnly]);

  const census = horses.filter((horse) => matchesStatus(horse, "census"));
  const withAlerts = census.filter((horse) => horse.healthNote?.overdue).length;
  const filtersActive =
    query.trim() !== "" || category !== "all" || status !== "census" || alertsOnly;

  const resetFilters = () => {
    setQuery("");
    setCategory("all");
    setStatus("census");
    setAlertsOnly(false);
  };

  if (horses.length === 0) {
    return (
      <EmptyState
        icon={<HorseIcon />}
        title={t("empty.title")}
        description={t("empty.body")}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <HorseImportDialog triggerVariant="default" />
            <Button asChild variant="outline" size="lg">
              <Link href={`/${tenantSlug}/caballos/nuevo`}>
                <Plus weight="bold" />
                {t("empty.add")}
              </Link>
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <MagnifyingGlass
              aria-hidden
              weight="bold"
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search.placeholder")}
              aria-label={t("search.label")}
              className="h-11 pr-10 pl-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("search.clear")}
                className="absolute top-1/2 right-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X aria-hidden weight="bold" className="h-4 w-4" />
              </button>
            )}
          </div>
          <NativeSelect
            aria-label={t("filters.statusLabel")}
            containerClassName="sm:w-48"
            className="h-11"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(`filters.status.${value}`)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div
            role="group"
            aria-label={t("filters.categoryLabel")}
            className="no-scrollbar -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 py-0.5"
          >
            {CATEGORIES.map((value) => (
              <Chip key={value} pressed={category === value} onClick={() => setCategory(value)}>
                {t(`filters.category.${value}`)}
              </Chip>
            ))}
            {withAlerts > 0 && (
              <Chip pressed={alertsOnly} onClick={() => setAlertsOnly((on) => !on)}>
                <Warning aria-hidden weight="fill" className={cn("h-3.5 w-3.5", !alertsOnly && "text-state-alert")} />
                {t("filters.alertsOnly")}
                <span className="tabular-nums">{withAlerts}</span>
              </Chip>
            )}
          </div>
          <div
            role="group"
            aria-label={t("view.label")}
            className="hidden shrink-0 rounded-full border border-border bg-card p-0.5 sm:flex"
          >
            {(
              [
                ["cards", SquaresFour],
                ["table", Rows],
              ] as const
            ).map(([value, Icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                aria-label={t(`view.${value}`)}
                title={t(`view.${value}`)}
                onClick={() => chooseView(value)}
                className={cn(
                  "flex h-8 w-9 items-center justify-center rounded-full transition-colors",
                  view === value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3">
        <p className="text-label text-muted-foreground" aria-live="polite">
          {filtersActive
            ? t("resultsOf", { shown: filtered.length, total: census.length })
            : t("results", { shown: filtered.length })}
        </p>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            {t("filters.reset")}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass />}
          title={t("noMatch.title")}
          description={t("noMatch.body")}
          action={
            <Button variant="outline" onClick={resetFilters}>
              {t("filters.reset")}
            </Button>
          }
        />
      ) : view === "table" ? (
        <HorsesTable horses={filtered} tenantSlug={tenantSlug} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((horse) => (
            <HorseCard key={horse.id} horse={horse} tenantSlug={tenantSlug} />
          ))}
        </div>
      )}
    </div>
  );
}

function HorsesTable({ horses, tenantSlug }: { horses: HorseRow[]; tenantSlug: string }) {
  const t = useTranslations("horses");
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">{t("columns.name")}</TableHead>
            <TableHead>{t("columns.category")}</TableHead>
            <TableHead className="text-right">{t("columns.age")}</TableHead>
            <TableHead>{t("columns.coat")}</TableHead>
            <TableHead>{t("columns.location")}</TableHead>
            <TableHead>{t("columns.repro")}</TableHead>
            <TableHead>{t("columns.health")}</TableHead>
            <TableHead className="pr-4">{t("columns.ueln")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {horses.map((horse) => (
            <TableRow key={horse.id}>
              <TableCell className="pl-4">
                <Link
                  href={`/${tenantSlug}/caballos/${horse.id}`}
                  className="flex items-center gap-3 font-semibold text-foreground hover:text-primary-ink"
                >
                  <HorseAvatar horse={horse} className="h-9 w-9 rounded-lg" />
                  <span className="truncate">{horse.name}</span>
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">{t(`category.${horseCategory(horse)}`)}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">
                {horse.birthDate ? ageInYears(horse.birthDate) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">{horse.coat ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{horse.boxLocation ?? "—"}</TableCell>
              <TableCell>
                {horse.phase ? (
                  <ReproPhaseBadge phase={horse.phase} />
                ) : horse.status !== "ACTIVE" ? (
                  <StateBadge tone="empty">{t(`status.${horse.status}` as "status.ACTIVE")}</StateBadge>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="max-w-56">
                <HorseHealthNote note={horse.healthNote} />
              </TableCell>
              <TableCell className="pr-4 font-mono text-caption text-muted-foreground">
                {horse.uelnCode ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
