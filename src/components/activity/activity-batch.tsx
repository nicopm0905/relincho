"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";

const KINDS = ["PADDOCK", "RIDDEN", "LUNGED", "WALKER", "GROOMED"] as const;
type Kind = (typeof KINDS)[number];

/**
 * Registro rápido en lote (E6): el mozo marca los caballos, toca lo que han
 * hecho y registra. Objetivo del roadmap: 8 caballos en menos de 15 s. El
 * `clientMutationId` se mantiene mientras se reintenta, así un doble toque o
 * una red mala no duplican nada.
 */
export function ActivityBatch({ horses }: { horses: { id: string; name: string; boxLocation: string | null }[] }) {
  const t = useTranslations("activityLog");
  const [selected, setSelected] = useState<string[]>([]);
  const [kind, setKind] = useState<Kind>("PADDOCK");
  const [mutationId, setMutationId] = useState(() => crypto.randomUUID());

  const log = trpc.activity.logBatch.useMutation({
    onSuccess: (res) => {
      toast.success(t("saved", { kind: t(`kinds.${kind}`), count: res.created || selected.length }));
      setSelected([]);
      setMutationId(crypto.randomUUID());
    },
    onError: (err) => toast.error(err.message || t("error")),
  });

  if (horses.length === 0) return <p className="text-sm text-muted-foreground">{t("noHorses")}</p>;

  const all = selected.length === horses.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <div className="flex items-center justify-between">
          <legend className="text-sm font-semibold">{t("horses")}</legend>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11"
            onClick={() => setSelected(all ? [] : horses.map((h) => h.id))}
          >
            {all ? t("none") : t("all")}
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {horses.map((h) => (
            <Chip key={h.id} on={selected.includes(h.id)} onClick={() => toggle(h.id)}>
              <span className="block truncate">{h.name}</span>
              {h.boxLocation && <span className="block truncate text-xs opacity-75">{h.boxLocation}</span>}
            </Chip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">{t("kind")}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {KINDS.map((k) => (
            <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
              {t(`kinds.${k}`)}
            </Chip>
          ))}
        </div>
      </fieldset>

      {/* Franja fija con fondo opaco; en el móvil, encima de la barra inferior (h-16 más la zona segura). */}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] -mx-4 bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
        <Button
          className="h-14 w-full text-base shadow-lg"
          disabled={selected.length === 0 || log.isPending}
          onClick={() => log.mutate({ horseIds: selected, kind, clientMutationId: mutationId })}
        >
          {log.isPending && <CircleNotch weight="bold" aria-hidden className="mr-2 h-5 w-5 animate-spin" />}
          {log.isPending ? t("saving") : t("submit", { count: selected.length })}
        </Button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
