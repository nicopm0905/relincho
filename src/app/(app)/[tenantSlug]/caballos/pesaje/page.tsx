import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { WeighDialog } from "@/components/horses/weigh-dialog";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import {
  WEIGHT_METHOD_LABELS,
  WEIGH_EVERY_DAYS,
  daysSince,
  fmtScore,
  hennekeName,
  type WeightMethod,
} from "@/lib/body-condition";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Pesaje — ${tenantSlug}` };
}

/**
 * Pesaje de la cuadra: el repaso mensual de peso y condición de todos los
 * caballos, uno detrás de otro, sin entrar en cada ficha.
 */
export default async function PesajePage({ params }: PageProps) {
  const [{ tenantSlug }, session] = await Promise.all([params, getSession()]);
  const caller = await createServerCaller(tenantSlug);
  const [herd, access] = await Promise.all([
    caller.bodyCondition.herd(),
    getTenantAccess(tenantSlug, session?.user?.id),
  ]);
  const canRecord = ["OWNER", "MANAGER", "GROOM", "VET_EXTERNAL"].includes(access.membership?.role ?? "");

  const now = new Date();
  const due = herd.filter((h) => !h.weightDate || daysSince(h.weightDate, now) > WEIGH_EVERY_DAYS);
  const outOfRange = herd.filter((h) => h.bodyCondition != null && (h.bodyCondition <= 3 || h.bodyCondition >= 7));
  // Primero lo que toca pesar.
  const rows = [...herd].sort((a, b) => {
    const da = a.weightDate ? daysSince(a.weightDate, now) : Infinity;
    const db = b.weightDate ? daysSince(b.weightDate, now) : Infinity;
    return db - da;
  });

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-500">
      <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground">
        <Link href={`/${tenantSlug}/caballos`}>
          <CaretLeft weight="bold" />
          Caballos
        </Link>
      </Button>

      <PageHeader
        title="Pesaje de la cuadra"
        description={`Peso y condición corporal de todos los caballos. Lo ideal: pesarlos una vez cada ${WEIGH_EVERY_DAYS} días, siempre igual y antes de comer.`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Caballos en activo" value={herd.length} />
        <StatCard
          label="Toca pesar"
          value={due.length}
          hint={`Sin pesar en más de ${WEIGH_EVERY_DAYS} días`}
          emphasis={due.length > 0}
        />
        <StatCard
          label="Condición fuera de rango"
          value={outOfRange.length}
          hint="3 o menos, o 7 o más"
        />
      </div>

      <Card className="gap-0 py-0">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[36rem] text-[13.5px]">
            <caption className="sr-only">Último peso y condición de cada caballo</caption>
            <thead>
              <tr className="border-b border-border/70 text-left text-[12px] text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Caballo</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Peso</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Pesado</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Condición</th>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h) => {
                const days = h.weightDate ? daysSince(h.weightDate, now) : null;
                const late = days == null || days > WEIGH_EVERY_DAYS;
                const cc = h.bodyCondition;
                return (
                  <tr key={h.id} className="border-b border-border/40 last:border-b-0">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/${tenantSlug}/caballos/${h.id}`}
                        className="font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {h.name}
                      </Link>
                      {h.boxLocation && (
                        <span className="block text-[12px] text-muted-foreground">{h.boxLocation}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">
                      {h.weightKg != null ? `${h.weightKg.toLocaleString("es-ES")} kg` : "—"}
                      {h.method && (
                        <span className="block text-[12px] text-muted-foreground">
                          {WEIGHT_METHOD_LABELS[h.method as WeightMethod]}
                        </span>
                      )}
                    </td>
                    <td className={cn("px-3 py-2.5", late ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
                      {h.weightDate ? formatDate(h.weightDate) : "Nunca"}
                      {days != null && (
                        <span className="block text-[12px]">
                          {days <= 0 ? "hoy" : days === 1 ? "ayer" : `hace ${days} días`}
                        </span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2.5 tabular-nums",
                        cc != null && (cc <= 3 || cc >= 8)
                          ? "font-medium text-red-700 dark:text-red-400"
                          : cc != null && cc >= 7
                            ? "font-medium text-amber-700 dark:text-amber-400"
                            : "text-foreground",
                      )}
                    >
                      {cc != null ? `${fmtScore(cc)} · ${hennekeName(cc)}` : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {canRecord && (
                        <WeighDialog
                          horseId={h.id}
                          horseName={h.name}
                          birthDate={h.birthDate}
                          lastMethod={(h.method as WeightMethod | null) ?? null}
                          triggerVariant={late ? "default" : "outline"}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
