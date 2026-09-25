import { format } from "date-fns";
import { es } from "date-fns/locale";

type Point = {
  date: Date | string;
  leftFollicleMm: number | null;
  rightFollicleMm: number | null;
  ovulated: boolean;
  treatments: string[];
};

const W = 640;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

/**
 * Crecimiento del foliculo dominante de cada ovario a lo largo de la
 * temporada, con las ovulaciones, las cubriciones y el umbral preovulatorio.
 */
export function FollicleChart({
  exams,
  coverings,
  thresholdMm,
}: {
  exams: Point[];
  coverings: { date: Date | string }[];
  thresholdMm: number;
}) {
  const measured = exams.filter((e) => e.leftFollicleMm || e.rightFollicleMm || e.ovulated);
  if (measured.length < 2) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
        Con dos exploraciones con medida de folículo aparecerá aquí la curva de crecimiento.
      </p>
    );
  }

  const times = [...measured.map((e) => new Date(e.date).getTime()), ...coverings.map((c) => new Date(c.date).getTime())];
  const t0 = Math.min(...times) - 12 * 3600e3;
  const t1 = Math.max(...times) + 12 * 3600e3;
  const maxMm = Math.max(
    thresholdMm + 10,
    ...measured.map((e) => Math.max(e.leftFollicleMm ?? 0, e.rightFollicleMm ?? 0) + 5),
  );
  const x = (d: Date | string) =>
    PAD.left + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
  const y = (mm: number) => PAD.top + (1 - mm / maxMm) * (H - PAD.top - PAD.bottom);

  const line = (key: "leftFollicleMm" | "rightFollicleMm") =>
    measured
      .filter((e) => e[key])
      .map((e, i) => `${i === 0 ? "M" : "L"}${x(e.date).toFixed(1)},${y(e[key]!).toFixed(1)}`)
      .join(" ");

  const ticks = Array.from({ length: Math.floor(maxMm / 10) + 1 }, (_, i) => i * 10);
  const dayTicks = Math.min(8, measured.length);
  const xTicks = Array.from({ length: dayTicks }, (_, i) => new Date(t0 + ((t1 - t0) * (i + 0.5)) / dayTicks));

  return (
    <figure className="space-y-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full text-muted-foreground"
        role="img"
        aria-label="Crecimiento folicular por ovario"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={PAD.left - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="currentColor">
              {t}
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d.toISOString()} x={x(d)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor">
            {format(d, "d MMM", { locale: es })}
          </text>
        ))}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(thresholdMm)}
          y2={y(thresholdMm)}
          stroke="#d97706"
          strokeDasharray="4 4"
          strokeWidth={1.2}
        />
        <text x={W - PAD.right} y={y(thresholdMm) - 4} textAnchor="end" fontSize={10} fill="#b45309">
          Preovulatorio {thresholdMm} mm
        </text>
        {coverings.map((c, i) => (
          <line
            key={`c${i}`}
            x1={x(c.date)}
            x2={x(c.date)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="#0284c7"
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        ))}
        <path d={line("leftFollicleMm")} fill="none" stroke="#7c3aed" strokeWidth={2} />
        <path d={line("rightFollicleMm")} fill="none" stroke="#059669" strokeWidth={2} />
        {measured.map((e, i) => (
          <g key={i}>
            {e.leftFollicleMm ? <circle cx={x(e.date)} cy={y(e.leftFollicleMm)} r={3} fill="#7c3aed" /> : null}
            {e.rightFollicleMm ? <circle cx={x(e.date)} cy={y(e.rightFollicleMm)} r={3} fill="#059669" /> : null}
            {e.ovulated && (
              <g>
                <line x1={x(e.date)} x2={x(e.date)} y1={PAD.top} y2={H - PAD.bottom} stroke="#b45309" strokeWidth={1.5} />
                <text x={x(e.date) + 3} y={PAD.top + 8} fontSize={10} fill="#b45309">
                  Ovulación
                </text>
              </g>
            )}
            {e.treatments.some((t) => t === "HCG" || t === "DESLORELIN") && (
              <text x={x(e.date)} y={H - PAD.bottom - 4} textAnchor="middle" fontSize={11} fill="#b45309">
                ▲
              </text>
            )}
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-violet-600" /> Ovario izquierdo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-emerald-600" /> Ovario derecho
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0.5 bg-sky-600" /> Cubrición
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-amber-700">▲</span> Inducción
        </span>
      </figcaption>
    </figure>
  );
}
