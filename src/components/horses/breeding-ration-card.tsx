import { Grains } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { breedingRation, type RationInput } from "@/lib/breeding-ration";

const range = ([a, b]: [number, number]) =>
  a === b ? `${a.toLocaleString("es-ES")}` : `${a.toLocaleString("es-ES")}–${b.toLocaleString("es-ES")}`;

/**
 * Racion orientativa segun su etapa (gestacion, lactacion, crecimiento), que
 * se calcula sola con lo que ya esta registrado. Componente de servidor.
 */
export function BreedingRationCard({ input }: { input: RationInput }) {
  const r = breedingRation(input);
  return (
    <Card className="p-6 border-border bg-card">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
          <Grains weight="duotone" className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">Ración orientativa</h3>
          <p className="text-xs text-muted-foreground">
            {r.label}
            {r.detail ? ` · ${r.detail}` : ""}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-muted/50 px-2 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Forraje</dt>
          <dd className="mt-1 text-base font-bold text-foreground">{range(r.forageKg)} kg</dd>
        </div>
        <div className="rounded-xl bg-muted/50 px-2 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Concentrado</dt>
          <dd className="mt-1 text-base font-bold text-foreground">{range(r.concentrateKg)} kg</dd>
        </div>
        <div className="rounded-xl bg-muted/50 px-2 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Proteína</dt>
          <dd className="mt-1 text-base font-bold text-foreground">{r.proteinPct}%</dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
        {r.notes.map((note) => (
          <li key={note}>· {note}</li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
        Al día, para {r.weightKg} kg de peso{r.weightEstimated ? " estimado por su edad (registra el peso real en su perfil veterinario)" : ""}.
        Pautas NRC orientativas: ajústalas con tu veterinario según su condición corporal.
      </p>
    </Card>
  );
}
