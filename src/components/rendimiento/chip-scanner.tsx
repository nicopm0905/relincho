"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ScanSmiley, SpinnerGap, Warning, Bandaids } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ScanResponse } from "@/lib/schemas/performance";
import {
  disciplineLabels,
  phaseBarColor,
  phaseLabels,
  workTypeLabels,
} from "./labels";

/** Web NFC solo existe en Chrome para Android; el resto teclea el codigo. */
type NDEFReaderCtor = new () => {
  scan: () => Promise<void>;
  onreading: ((event: { serialNumber?: string }) => void) | null;
};

function getNdefReader(): NDEFReaderCtor | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as unknown as { NDEFReader?: NDEFReaderCtor }).NDEFReader;
  return candidate ?? null;
}

export function ChipScanner({ tenantSlug }: { tenantSlug: string }) {
  const [chipId, setChipId] = useState("");
  const [loading, setLoading] = useState(false);
  const [nfcActive, setNfcActive] = useState(false);
  const [result, setResult] = useState<ScanResponse | null>(null);

  const lookup = async (value: string) => {
    const code = value.trim();
    if (!code) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/horses/scan?chip_id=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo leer el chip");
        return;
      }
      setResult(data as ScanResponse);
    } catch {
      toast.error("Error de red al consultar el chip");
    } finally {
      setLoading(false);
    }
  };

  const startNfc = async () => {
    const Reader = getNdefReader();
    if (!Reader) {
      toast.error("Este dispositivo o navegador no permite leer NFC. Teclea el código.");
      return;
    }
    try {
      const reader = new Reader();
      await reader.scan();
      setNfcActive(true);
      reader.onreading = (event) => {
        const serial = event.serialNumber;
        if (serial) {
          setChipId(serial);
          void lookup(serial);
        }
      };
      toast.success("Acerca el chip al teléfono");
    } catch {
      setNfcActive(false);
      toast.error("No se pudo activar la lectura NFC");
    }
  };

  const target = result?.periodization_plan?.daily_load_target ?? null;
  const bufferAlert =
    result?.periodization_plan?.recovery_metrics.fatigue_index_alert ?? false;
  const phase = result?.periodization_plan?.current_mesocycle ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="chip">Código del chip</Label>
              <Input
                id="chip"
                value={chipId}
                onChange={(e) => setChipId(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void lookup(chipId);
                }}
                placeholder="NFC-123456"
                autoFocus
                className="font-mono"
              />
            </div>
            <Button onClick={() => void lookup(chipId)} disabled={loading}>
              {loading ? (
                <SpinnerGap className="animate-spin" />
              ) : (
                <ScanSmiley weight="fill" />
              )}
              Consultar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={startNfc}
              disabled={nfcActive}
            >
              <span
                className={cn(
                  "mr-1.5 h-1.5 w-1.5 rounded-full",
                  nfcActive ? "animate-pulse bg-emerald-500" : "bg-border",
                )}
                aria-hidden
              />
              {nfcActive ? "Esperando chip" : "Leer por NFC"}
            </Button>
            <p className="text-[12px] text-muted-foreground">
              La lectura sin contacto necesita Chrome en Android.
            </p>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {result.name}
              {result.discipline && (
                <Badge variant="secondary">
                  {disciplineLabels[result.discipline] ?? result.discipline}
                </Badge>
              )}
              {result.veterinary_constraints.tendon_history_alert && (
                <Badge variant="warning">Alerta de tendón</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.competition_target && (
              <p className="text-[13px] text-muted-foreground">
                Próxima competición: {result.competition_target.event_name} el{" "}
                {result.competition_target.date}
              </p>
            )}

            <div className="relative overflow-hidden rounded-lg border border-border bg-muted/40 px-3.5 py-3">
              {phase && (
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 w-1",
                    phaseBarColor[phase] ?? "bg-border",
                  )}
                  aria-hidden
                />
              )}
              <div className="text-[12px] text-muted-foreground">Trabajo de hoy</div>
              {target ? (
                <>
                  <div className="mt-1 text-[17px] leading-none font-semibold text-foreground">
                    {workTypeLabels[target.work_type] ?? target.work_type}
                  </div>
                  <div className="mt-1.5 text-[12.5px] tabular-nums text-muted-foreground">
                    {target.duration_minutes} min · RPE {target.rpe_target}
                    {result.periodization_plan?.current_mesocycle &&
                      ` · ${phaseLabels[result.periodization_plan.current_mesocycle]}, semana ${
                        result.periodization_plan.microcycle_week
                      }`}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-[13px] text-muted-foreground">
                  Sin carga planificada para hoy.
                </div>
              )}
            </div>

            {result.veterinary_constraints.max_impact_surface_minutes != null && (
              <p className="text-[12.5px] text-muted-foreground">
                Máximo{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {result.veterinary_constraints.max_impact_surface_minutes} min
                </span>{" "}
                sobre superficie de impacto por sesión.
              </p>
            )}

            {bufferAlert && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/70 bg-amber-50/50 px-3.5 py-3">
                <Warning
                  weight="fill"
                  className="mt-px h-4 w-4 shrink-0 text-amber-600"
                />
                <p className="text-[13px] leading-relaxed text-amber-900">
                  El margen de recuperación de esta semana está agotado. Revisa la
                  carga antes de subir la intensidad.
                </p>
              </div>
            )}

            {result.injury_history.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
                  <Bandaids weight="duotone" className="h-4 w-4 text-muted-foreground" />
                  Historial de lesiones
                </div>
                <ul className="mt-1.5 space-y-1">
                  {result.injury_history.slice(0, 5).map((injury, index) => (
                    <li
                      key={`${injury.date}-${index}`}
                      className="text-[12.5px] text-muted-foreground"
                    >
                      <span className="tabular-nums">{injury.date}</span> ·{" "}
                      {injury.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button asChild className="w-full">
              <Link href={`/${tenantSlug}/rendimiento/${result.horse_id}`}>
                Abrir plan del caballo
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
