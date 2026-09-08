import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { fatigueZoneLabels } from "./labels";

interface Prescription {
  fatigueZone: string;
  internalLoadUa: number;
  forageKg: unknown;
  concentrateKg: unknown;
  extraConcentrateGrams: number;
  proteinPercentTarget: number;
  electrolytesGrams: number;
  vitaminEIu: number;
  bcaa: boolean;
  totalMeals: number;
  instructionsForStaff: string;
  clampNotes: string[];
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[17px] leading-none font-semibold tabular-nums text-foreground">
        {value}
        {note && (
          <span className="ml-1.5 text-[12px] font-medium text-amber-700">{note}</span>
        )}
      </dd>
    </div>
  );
}

/** Racion del dia calculada por el motor de nutricion. */
export function RationCard({ prescription }: { prescription: Prescription | null }) {
  if (!prescription) {
    return (
      <EmptyState
        variant="plain"
        title="Todavía sin ración calculada"
        description="Se genera al reportar la sesión del día."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {fatigueZoneLabels[prescription.fatigueZone]}
        </Badge>
        <span className="text-[12.5px] tabular-nums text-muted-foreground">
          {prescription.internalLoadUa} UA de carga interna
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
        <Figure label="Forraje" value={`${Number(prescription.forageKg)} kg`} />
        <Figure
          label="Concentrado"
          value={`${Number(prescription.concentrateKg)} kg`}
          note={
            prescription.extraConcentrateGrams > 0
              ? `+${prescription.extraConcentrateGrams} g`
              : undefined
          }
        />
        <Figure
          label="Proteína objetivo"
          value={`${prescription.proteinPercentTarget}%`}
        />
        <Figure label="Tomas" value={String(prescription.totalMeals)} />
      </dl>

      {(prescription.electrolytesGrams > 0 || prescription.bcaa) && (
        <div className="flex flex-wrap gap-2">
          {prescription.electrolytesGrams > 0 && (
            <Badge variant="warning">
              Electrolitos {prescription.electrolytesGrams} g
            </Badge>
          )}
          {prescription.bcaa && <Badge variant="info">Aminoácidos</Badge>}
        </div>
      )}

      <p className="rounded-lg border border-border bg-muted/50 p-3 text-[13px] leading-relaxed text-foreground">
        {prescription.instructionsForStaff}
      </p>

      {prescription.clampNotes.length > 0 && (
        <ul className="space-y-1">
          {prescription.clampNotes.map((note) => (
            <li key={note} className="text-[12px] leading-snug text-amber-700">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
