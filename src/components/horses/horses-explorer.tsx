"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass, Plus, Horse as HorseIcon, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { HorseCard } from "@/components/horses/horse-card";
import { cn } from "@/lib/utils";

type Horse = {
  id: string;
  name: string;
  sex: string;
  status: string;
  breed: string | null;
  coat: string | null;
  birthDate: Date | null;
  photoUrl: string | null;
  uelnCode: string | null;
};

const sexFilters = [
  { value: "ALL", label: "Todos" },
  { value: "FEMALE", label: "Yeguas" },
  { value: "MALE", label: "Sementales" },
  { value: "GELDING", label: "Castrados" },
] as const;

const statusFilters = [
  { value: "ALL", label: "Todos" },
  { value: "ACTIVE", label: "Activos" },
  { value: "IN_TRAINING", label: "En doma" },
  { value: "RETIRED", label: "Retirados" },
  { value: "SOLD", label: "Vendidos" },
] as const;

function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 rounded-md border px-2.5 py-1 text-[12.5px] font-medium transition-colors duration-150",
            value === option.value
              ? "border-transparent bg-foreground text-background"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function HorsesExplorer({
  horses,
  tenantSlug,
}: {
  horses: Horse[];
  tenantSlug: string;
}) {
  const [query, setQuery] = useState("");
  const [sex, setSex] = useState<(typeof sexFilters)[number]["value"]>("ALL");
  const [status, setStatus] =
    useState<(typeof statusFilters)[number]["value"]>("ALL");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return horses.filter((horse) => {
      if (sex !== "ALL" && horse.sex !== sex) return false;
      if (status !== "ALL" && horse.status !== status) return false;
      if (!needle) return true;
      return [horse.name, horse.breed, horse.coat, horse.uelnCode]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle));
    });
  }, [horses, query, sex, status]);

  const filtersActive = query.trim() !== "" || sex !== "ALL" || status !== "ALL";

  const resetFilters = () => {
    setQuery("");
    setSex("ALL");
    setStatus("ALL");
  };

  if (horses.length === 0) {
    return (
      <EmptyState
        icon={<HorseIcon weight="duotone" />}
        title="Sin caballos aún"
        description="Registra tu primer caballo para empezar a llevar su sanidad, su reproducción y su documentación."
        action={
          <Button asChild>
            <Link href={`/${tenantSlug}/caballos/nuevo`}>
              <Plus weight="bold" />
              Añadir el primero
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlass
            weight="bold"
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, raza, capa o UELN…"
            aria-label="Buscar caballos"
            className="h-9 pr-9 pl-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Borrar búsqueda"
              className="absolute top-1/2 right-2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X weight="bold" className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-6">
          <FilterChips
            label="Filtrar por sexo"
            options={sexFilters}
            value={sex}
            onChange={setSex}
          />
          <div className="hidden h-5 w-px shrink-0 bg-border lg:block" />
          <FilterChips
            label="Filtrar por estado"
            options={statusFilters}
            value={status}
            onChange={setStatus}
          />
        </div>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">
          {filtered.length}{" "}
          {filtered.length === 1 ? "caballo" : "caballos"}
          {filtersActive && ` de ${horses.length}`}
        </p>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Limpiar filtros
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<MagnifyingGlass weight="duotone" />}
          title="Ningún caballo coincide"
          description="Prueba con otro término de búsqueda o quita algún filtro."
          action={
            <Button variant="outline" onClick={resetFilters}>
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((horse) => (
            <HorseCard key={horse.id} horse={horse} tenantSlug={tenantSlug} />
          ))}
        </div>
      )}
    </div>
  );
}
