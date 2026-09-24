"use client";

import { useMemo, useState } from "react";
import {
  MagnifyingGlass,
  Heartbeat,
  X,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ListRow, ListRows, RowIcon } from "@/components/ui/list-row";
import {
  EditHealthEventDialog,
  type EditableHealthEvent,
} from "./edit-health-event-dialog";

export const healthTypeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión vet.",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
};

type HealthEvent = EditableHealthEvent;

export function HealthEventsList({ events }: { events: HealthEvent[] }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("ALL");

  // Only offer filters for the types actually present in the history.
  const availableTypes = useMemo(() => {
    const seen = new Set(events.map((event) => event.type));
    return Object.keys(healthTypeLabels).filter((key) => seen.has(key));
  }, [events]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (type !== "ALL" && event.type !== type) return false;
      if (!needle) return true;
      return (
        event.name.toLowerCase().includes(needle) ||
        event.horse.name.toLowerCase().includes(needle)
      );
    });
  }, [events, query, type]);

  if (events.length === 0) {
    return (
      <EmptyState
        variant="plain"
        icon={<Heartbeat weight="duotone" />}
        title="Sin eventos registrados"
        description="Los tratamientos, vacunas y revisiones que registres aparecerán aquí."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="relative">
          <MagnifyingGlass
            weight="bold"
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por caballo o tratamiento…"
            aria-label="Buscar eventos sanitarios"
            className="pr-9 pl-9"
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

        {availableTypes.length > 1 && (
          <div
            role="group"
            aria-label="Filtrar por tipo de evento"
            className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5"
          >
            {["ALL", ...availableTypes].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-[background-color,border-color,color] duration-150",
                  type === value
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:bg-primary/[0.05] hover:text-foreground",
                )}
              >
                {value === "ALL" ? "Todos" : healthTypeLabels[value]}
              </button>
            ))}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          variant="plain"
          icon={<MagnifyingGlass weight="duotone" />}
          title="Ningún evento coincide"
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQuery("");
                setType("ALL");
              }}
            >
              Limpiar filtros
            </Button>
          }
        />
      ) : (
        <ListRows>
          {filtered.map((event) => (
            <ListRow
              key={event.id}
              leading={
                <RowIcon>
                  <Heartbeat weight="duotone" />
                </RowIcon>
              }
              title={event.name}
              subtitle={`${event.horse.name} · ${healthTypeLabels[event.type] ?? event.type}`}
              meta={
                <>
                  <span>{formatDate(event.date)}</span>
                  {event.nextDueDate && (
                    <Badge variant="warning">
                      Próx. {formatDate(event.nextDueDate)}
                    </Badge>
                  )}
                  <EditHealthEventDialog event={event} />
                </>
              }
            />
          ))}
        </ListRows>
      )}
    </div>
  );
}
