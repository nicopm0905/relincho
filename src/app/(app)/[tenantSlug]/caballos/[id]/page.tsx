import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { gestation, mareState } from "@/lib/reproduction";
import { withdrawalStatus } from "@/lib/treatments";
import { pendingHealthDue } from "@/lib/health-due";
import { cn } from "@/lib/utils";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { TabsContent } from "@/components/ui/tabs";
import { SectionHeading } from "@/components/layout/page-header";
import { BreedingRationCard } from "@/components/horses/breeding-ration-card";
import { BodyConditionCard } from "@/components/horses/body-condition-card";
import { HorseHeader } from "@/components/horses/detail/horse-header";
import { HorseTabs } from "@/components/horses/detail/horse-tabs";
import { HORSE_TABS, type HorseTab } from "@/components/horses/detail/horse-tab-list";
import { ReproTab } from "@/components/horses/detail/repro-tab";
import { HealthTab } from "@/components/horses/detail/health-tab";

const block = (height: string) =>
  function Loading() {
    return <div className={cn("animate-pulse rounded-2xl bg-muted/50", height)} aria-busy="true" />;
  };
const PedigreeTree = dynamic(() => import("@/components/horses/pedigree-tree").then((m) => m.PedigreeTree), { loading: block("h-96") });
const HorseTimeline = dynamic(() => import("@/components/horses/timeline").then((m) => m.HorseTimeline), { loading: block("h-64") });
const DailyJournalForm = dynamic(() => import("@/components/horses/daily-journal-form").then((m) => m.DailyJournalForm), { loading: block("h-48") });
const JournalFeed = dynamic(() => import("@/components/horses/journal-feed").then((m) => m.JournalFeed), { loading: block("h-32") });
const HorseChat = dynamic(() => import("@/components/horses/horse-chat").then((m) => m.HorseChat), { loading: block("h-96") });
const DocumentsManager = dynamic(() => import("@/components/documentos/documents-manager").then((m) => m.DocumentsManager), { loading: block("h-64") });
const FeedingPlanCard = dynamic(() => import("@/components/horses/feeding-plan-card").then((m) => m.FeedingPlanCard), { loading: block("h-48") });

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/** Ventana de "pendiente" en la pestaña de sanidad. */
const HEALTH_AHEAD_DAYS = 30;

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-label text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-w-0 truncate text-right text-body font-medium",
          value ? "text-foreground" : "text-muted-foreground",
          value && mono && "font-mono text-label",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

export default async function CaballoDetailPage({ params, searchParams }: PageProps) {
  const [{ tenantSlug, id }, { tab }] = await Promise.all([params, searchParams]);
  const caller = await createServerCaller(tenantSlug);

  let horse;
  try {
    horse = await caller.horses.byId({ id });
  } catch {
    notFound();
  }

  // Los documentos viven en su propio router porque la ficha grande no trae
  // las URLs firmadas: aqui se piden ya con enlace temporal resuelto.
  const [horseDocuments, horseHealth, bodyCondition, session, t] = await Promise.all([
    caller.documents.list({ horseId: id }),
    caller.health.list({ horseId: id }),
    caller.bodyCondition.get({ horseId: id }).catch(() => null),
    getSession(),
    getTranslations("horseDetail"),
  ]);
  const { membership } = await getTenantAccess(tenantSlug, session?.user?.id);
  const role = membership?.role ?? "";
  const canRecordWeight = ["OWNER", "MANAGER", "GROOM", "VET_EXTERNAL"].includes(role);
  const canManageWeight = ["OWNER", "MANAGER"].includes(role);
  const isMare = horse.sex === "FEMALE";

  // Tiempo de espera vigente: el tratamiento que libera más tarde manda.
  const activeWithdrawal = horseHealth
    .map((event) => ({ event, ...withdrawalStatus(event, horse) }))
    .filter((w) => w.status === "active" && w.until)
    .sort((a, b) => b.until!.getTime() - a.until!.getTime())[0];

  // Racion orientativa y estado: salen de la ultima cubricion y el ultimo
  // parto, sin que nadie tenga que configurarlo.
  const allCoverings = (horse.reproCycles ?? [])
    .flatMap((cycle) => cycle.coverings ?? [])
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastCovering = allCoverings[0];
  const lastFoaling = allCoverings
    .map((c) => c.foaling)
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
  const lastState = mareState(lastCovering);
  const lastPregnant = lastState === "PREGNANT" || lastState === "TWINS";
  const lastGestation = lastPregnant && lastCovering ? gestation(lastCovering.date) : null;
  const rationInput = {
    sex: horse.sex,
    birthDate: horse.birthDate ? new Date(horse.birthDate) : null,
    weightKg: horse.vetProfile?.baseWeightKg ? Number(horse.vetProfile.baseWeightKg) : null,
    mare: {
      pregnant: lastPregnant,
      coveringDate: lastCovering ? new Date(lastCovering.date) : null,
      lastFoalingDate: lastFoaling ? new Date(lastFoaling.date) : null,
    },
  };

  // Lo sanitario pendiente: por tipo de acto manda el último registrado.
  const due = pendingHealthDue(horseHealth, { withinDays: 365 });
  const nextDue = due[0] ?? null;

  const tabs = HORSE_TABS.filter((value) => value !== "reproduccion" || isMare);
  const initialTab: HorseTab = tabs.includes(tab as HorseTab) ? (tab as HorseTab) : "resumen";

  return (
    <div className="w-full space-y-6 animate-in fade-in-0 duration-500">
      <Link
        href={`/${tenantSlug}/caballos`}
        className="-ml-1 inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-label font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <CaretLeft aria-hidden weight="bold" className="h-3.5 w-3.5" />
        {t("back")}
      </Link>

      <HorseHeader
        tenantSlug={tenantSlug}
        horse={horse}
        repro={isMare && lastCovering ? { state: lastState, gestation: lastGestation } : null}
        health={
          nextDue
            ? { name: nextDue.event.name, due: nextDue.due, overdue: nextDue.offset < 0 }
            : null
        }
        weight={
          horse.vetProfile?.baseWeightKg
            ? {
                kg: Number(horse.vetProfile.baseWeightKg),
                condition: bodyCondition?.lastCondition?.bodyCondition ?? null,
              }
            : null
        }
        withdrawal={
          activeWithdrawal
            ? {
                until: activeWithdrawal.until!,
                name: activeWithdrawal.event.name,
                date: new Date(activeWithdrawal.event.date),
              }
            : null
        }
      />

      <HorseTabs initial={initialTab} tabs={tabs}>
        <TabsContent value="resumen" className="space-y-5 pt-6">
          <section className="rounded-2xl border border-border bg-card shadow-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-heading font-semibold text-foreground">{t("summary.identification")}</h2>
            </div>
            <dl className="grid gap-x-10 px-5 py-1.5 md:grid-cols-2 [&>div]:border-b [&>div]:border-border/70 [&>div:last-child]:border-b-0 md:[&>div:nth-last-child(2)]:border-b-0">
              <Field label={t("ids.ueln")} value={horse.uelnCode} mono />
              <Field label={t("ids.microchip")} value={horse.microchip} mono />
              <Field label={t("ids.lg")} value={horse.lgNumber} mono />
              <Field label={t("ids.hierro")} value={horse.hierro} />
              <Field label={t("summary.breed")} value={horse.breed} />
              <Field label={t("summary.coat")} value={horse.coat} />
              <Field label={t("summary.breeder")} value={horse.breeder?.name ?? t("summary.theFarm")} />
              <Field label={t("summary.owner")} value={horse.owner?.name ?? t("summary.theFarm")} />
            </dl>
          </section>

          {bodyCondition && (
            <BodyConditionCard
              data={bodyCondition}
              birthDate={horse.birthDate ? new Date(horse.birthDate) : null}
              canRecord={canRecordWeight}
              canManage={canManageWeight}
            />
          )}

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <FeedingPlanCard horseId={horse.id} horseName={horse.name} />
            <BreedingRationCard input={rationInput} />
          </div>
        </TabsContent>

        {isMare && (
          <TabsContent value="reproduccion" className="pt-6">
            <ReproTab tenantSlug={tenantSlug} mareId={horse.id} cycles={horse.reproCycles ?? []} />
          </TabsContent>
        )}

        <TabsContent value="sanidad" className="pt-6">
          <HealthTab
            tenantSlug={tenantSlug}
            horseId={horse.id}
            horseName={horse.name}
            pending={due
              .filter((item) => item.offset <= HEALTH_AHEAD_DAYS)
              .map(({ event, offset }) => ({ id: event.id, type: event.type, name: event.name, offset }))}
            history={<HorseTimeline horseId={id} />}
          />
        </TabsContent>

        <TabsContent value="pedigri" className="space-y-3 pt-6">
          <SectionHeading
            title={t("pedigree.title")}
            description={t("pedigree.description", { name: horse.name })}
          />
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-6">
            <PedigreeTree tenantSlug={tenantSlug} horseName={horse.name} sire={horse.sire} dam={horse.dam} />
          </div>
        </TabsContent>

        <TabsContent value="diario" className="pt-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <DailyJournalForm horseId={horse.id} horseName={horse.name} />
              <section className="space-y-3">
                <SectionHeading title={t("journal.history")} />
                <JournalFeed horseId={horse.id} />
              </section>
            </div>
            <div className="h-full">
              <HorseChat horseId={horse.id} horseName={horse.name} tenantSlug={tenantSlug} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="documentos" className="pt-6">
          <DocumentsManager
            tenantId={horseDocuments.tenantId}
            documents={horseDocuments.documents}
            usage={horseDocuments.usage}
            horses={[{ id: horse.id, name: horse.name }]}
            lockedHorseId={horse.id}
            compact
          />
        </TabsContent>
      </HorseTabs>
    </div>
  );
}
