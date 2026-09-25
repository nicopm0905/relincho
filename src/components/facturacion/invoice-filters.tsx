"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

const STATUSES = [
  { value: "ALL", label: "Todos los estados" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ISSUED", label: "Pendiente" },
  { value: "PAID", label: "Cobrada" },
  { value: "OVERDUE", label: "Vencida" },
  { value: "CANCELLED", label: "Anulada" },
];

const QUARTERS = [
  { value: "ALL", label: "Todo el año" },
  { value: "1", label: "1.er trimestre" },
  { value: "2", label: "2.º trimestre" },
  { value: "3", label: "3.er trimestre" },
  { value: "4", label: "4.º trimestre" },
];

/**
 * Filtros del listado. Todo vive en la URL (`q`, `status`, `year`, `quarter`,
 * `page`): se puede compartir el enlace y el botón de atrás funciona.
 */
export function InvoiceFilters({
  years,
  current,
}: {
  years: number[];
  current: { q?: string; status?: string; year?: number; quarter?: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(current.q ?? "");

  function push(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "" || value === "ALL") params.delete(key);
      else params.set(key, value);
    }
    // Cambiar un filtro vuelve a la primera pagina.
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <form
        className="relative sm:w-64"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() });
        }}
        role="search"
      >
        <MagnifyingGlass aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Buscar por cliente o número"
          placeholder="Cliente o número…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onBlur={() => q.trim() !== (current.q ?? "") && push({ q: q.trim() })}
          className="pl-9"
        />
      </form>
      <NativeSelect
        aria-label="Año"
        containerClassName="sm:w-28"
        value={current.year ? String(current.year) : "ALL"}
        onChange={(e) => push({ year: e.target.value, ...(e.target.value === "ALL" ? { quarter: null } : {}) })}
      >
        <option value="ALL">Todos los años</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Trimestre"
        containerClassName="sm:w-40"
        disabled={!current.year}
        value={current.quarter ? String(current.quarter) : "ALL"}
        onChange={(e) => push({ quarter: e.target.value })}
      >
        {QUARTERS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label="Estado"
        containerClassName="sm:w-44"
        value={current.status ?? "ALL"}
        onChange={(e) => push({ status: e.target.value })}
      >
        {STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
