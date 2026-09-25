import Link from "next/link";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RateRow, SeasonStats } from "@/lib/repro-stats";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ temporada?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Estadísticas reproductivas — ${tenantSlug}` };
}

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)} %`);

function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return undefined;
  const diff = Math.round((current - previous) * 100);
  if (diff === 0) return "Igual que la temporada anterior";
  return `${diff > 0 ? "+" : ""}${diff} puntos frente a la anterior`;
}

function RateTable({ title, rows, empty }: { title: string; rows: RateRow[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px]">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead className="text-left text-[12px] text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium"> </th>
                  <th className="py-2 pr-3 text-right font-medium">Yeguas</th>
                  <th className="py-2 pr-3 text-right font-medium">Ciclos</th>
                  <th className="py-2 pr-3 text-right font-medium">Preñados</th>
                  <th className="w-[38%] py-2 font-medium">Preñez por ciclo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="py-2 pr-3 font-medium text-foreground">{r.label}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.mares}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.cycles}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{r.pregnantCycles}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                          role="meter"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round((r.perCycleRate ?? 0) * 100)}
                          aria-label={`Preñez por ciclo de ${r.label}`}
                        >
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(r.perCycleRate ?? 0) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right tabular-nums">{pct(r.perCycleRate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Kpis({ s, prev }: { s: SeasonStats; prev: SeasonStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Yeguas cubiertas" value={s.maresBred} hint={`${s.cyclesBred} ciclos cubiertos`} />
      <StatCard
        label="Preñez por ciclo"
        value={pct(s.perCycleRate)}
        hint={delta(s.perCycleRate, prev.perCycleRate) ?? `${s.pregnantCycles} de ${s.cyclesBred} ciclos`}
      />
      <StatCard
        label="Yeguas preñadas"
        value={pct(s.seasonRate)}
        hint={delta(s.seasonRate, prev.seasonRate) ?? `${s.maresPregnant} de ${s.maresBred}`}
      />
      <StatCard
        label="Ciclos por gestación"
        value={s.cyclesPerPregnancy === null ? "—" : s.cyclesPerPregnancy.toFixed(1)}
      />
      <StatCard
        label="Pérdidas gestacionales"
        value={pct(s.lossRate)}
        hint={`${s.losses} ${s.losses === 1 ? "pérdida" : "pérdidas"}`}
        emphasis={(s.lossRate ?? 0) > 0.15}
      />
      <StatCard label="Gemelares" value={s.twins} />
      <StatCard label="Potros vivos" value={s.liveFoals} hint={`${pct(s.liveFoalRate)} de las yeguas cubiertas`} />
      <StatCard
        label="Dosis por gestación"
        value={s.dosesPerPregnancy === null ? "—" : s.dosesPerPregnancy.toFixed(1)}
        hint="Solo cubriciones con lote de semen"
      />
    </div>
  );
}

export default async function ReproStatsPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const { temporada } = await searchParams;
  const thisYear = new Date().getFullYear();
  const season = Number(temporada) >= 2000 && Number(temporada) <= 2100 ? Number(temporada) : thisYear;
  const caller = await createServerCaller(tenantSlug);
  const { current, previous, seasons } = await caller.reproduction.stats({ season });
  const options = [...new Set([thisYear, ...seasons])].sort((a, b) => b - a);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        backHref={`/${tenantSlug}/reproduccion`}
        backLabel="Reproducción"
        title="Estadísticas reproductivas"
        description="Por temporada de cubrición. Los partos de una temporada caen al año siguiente."
      />
      <nav aria-label="Temporadas" className="flex flex-wrap gap-1.5">
        {options.map((y) => (
          <Link
            key={y}
            href={`/${tenantSlug}/reproduccion/estadisticas?temporada=${y}`}
            aria-current={y === season ? "page" : undefined}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[12.5px] font-medium",
              y === season
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {y}
          </Link>
        ))}
      </nav>

      {current.maresBred === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-[13.5px] text-muted-foreground">
          Sin cubriciones en {season}.
        </p>
      ) : (
        <>
          <Kpis s={current} prev={previous} />
          <div className="grid gap-4 lg:grid-cols-2">
            <RateTable title="Por semental" rows={current.byStallion} empty="Sin datos." />
            <RateTable title="Por método" rows={current.byMethod} empty="Sin datos." />
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Un ciclo son las cubriciones de una yegua en el mismo celo (menos de 10 días entre sí). Cuenta como preñado si
            alguna ecografía salió positiva, aunque después se perdiera.
          </p>
        </>
      )}
    </div>
  );
}
