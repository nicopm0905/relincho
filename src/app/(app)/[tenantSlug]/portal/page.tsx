import Link from "next/link";
import Image from "next/image";
import { getFormatter, getTranslations } from "next-intl/server";
import { createServerCaller } from "@/lib/trpc/server";
import { calendarDayOffset } from "@/lib/day-window";
import { emptyRunLabel, groupEmptyDays, healthDueDetail, relativeDue } from "@/lib/portal-view";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Barbell,
  CaretRight,
  CheckCircle,
  Heartbeat,
  Horse,
  Hammer,
  Receipt,
  Warning,
} from "@phosphor-icons/react/dist/ssr";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

const TZ = "Europe/Madrid";

export async function generateMetadata({ params }: PageProps) {
  const [{ tenantSlug }, t] = await Promise.all([params, getTranslations("portal.home")]);
  return { title: `${t("metaTitle")} — ${tenantSlug}` };
}

/** Fila enlazada de la portada: toda la fila es el objetivo táctil (≥ 44 px). */
function Row({
  href,
  icon,
  title,
  detail,
  aside,
  tone = "neutral",
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  aside?: string;
  tone?: "neutral" | "alert" | "danger" | "ok";
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-11 items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <span
          aria-hidden
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg [&>svg]:h-5 [&>svg]:w-5",
            tone === "danger" && "bg-state-danger-soft text-state-danger-ink",
            tone === "alert" && "bg-state-alert-soft text-state-alert-ink",
            tone === "ok" && "bg-state-ok-soft text-state-ok-ink",
            tone === "neutral" && "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-foreground">{title}</span>
          {detail && <span className="block truncate text-label text-muted-foreground">{detail}</span>}
        </span>
        {aside && (
          <span
            className={cn(
              "shrink-0 text-right text-label font-medium",
              tone === "danger" && "text-state-danger-ink",
              tone === "alert" && "text-state-alert-ink",
              (tone === "neutral" || tone === "ok") && "text-muted-foreground",
            )}
          >
            {aside}
          </span>
        )}
        <CaretRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-heading font-semibold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

const LIST = "divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card shadow-card";

export default async function PortalHomePage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const base = `/${tenantSlug}/portal`;
  const now = new Date();
  const [caller, t, tTypes, format] = await Promise.all([
    createServerCaller(tenantSlug),
    getTranslations("portal.home"),
    getTranslations("home.healthTypes"),
    getFormatter(),
  ]);
  const [home, horses, balance] = await Promise.all([
    caller.portal.home(),
    caller.portal.myHorses(),
    caller.portal.balance(),
  ]);

  const day = (d: Date) => format.dateTime(d, { dateStyle: "medium", timeZone: TZ });
  const shortDay = (d: Date) =>
    format.dateTime(d, { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
  /** `YYYY-MM-DD` de Madrid a fecha, a mediodía UTC para no cambiar de día. */
  const isoDate = (isoDay: string) => new Date(`${isoDay}T12:00:00Z`);
  const dayMonth = (isoDay: string) => format.dateTime(isoDate(isoDay), { day: "numeric", month: "long", timeZone: TZ });
  // `feedByDay` da los días de hoy hacia atrás: el primero es hoy y el segundo, ayer.
  const today = home.activity[0]?.day ?? "";
  const yesterday = home.activity[1]?.day ?? "";
  const emptyRun = (run: { from: string; to: string }) => {
    const label = emptyRunLabel(run, today);
    if (label.key === "today") return t("emptyToday");
    if (label.key === "yesterday") return t("emptyYesterday");
    if (label.key === "day") return t("emptyDay", { date: dayMonth(label.date) });
    return t("emptyRange", {
      from: label.sameMonth
        ? format.dateTime(isoDate(label.from), { day: "numeric", timeZone: TZ })
        : dayMonth(label.from),
      to: dayMonth(label.to),
    });
  };
  /** `YYYY-MM-DD` de Madrid → "lunes, 7 de diciembre". */
  const weekday = (isoDay: string) =>
    format.dateTime(isoDate(isoDay), { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  const euros = (n: number) => format.number(n, { style: "currency", currency: "EUR" });
  const dueLabel = (d: Date) => {
    const { key, days } = relativeDue(calendarDayOffset(d, now));
    return t(`due.${key}`, { days });
  };
  const typeLabel = (type: string) => (tTypes.has(type) ? tTypes(type) : type);
  const horseName = new Map(home.lastFarrier.map((h) => [h.horseId, h.horseName]));
  const ageLabel = (birthDate: Date | null) =>
    birthDate
      ? t("age", { years: Math.floor((now.getTime() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000)) })
      : t("ageUnknown");

  const isOwner = home.audience === "OWNER";
  const attention = home.items.filter((i) => i.kind !== "HEALTH_DUE");
  const upcoming = home.items.filter((i) => i.kind === "HEALTH_DUE");

  return (
    <div className="animate-in fade-in-0 space-y-8 duration-300">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-title tracking-tight text-foreground">
          {isOwner ? t("ownerTitle") : t("studentTitle")}
        </h1>
        <p className="text-body text-muted-foreground">
          {isOwner ? t("ownerSubtitle") : t("studentSubtitle")}
        </p>
      </div>

      {home.emptyState === "OWNER_ALL_CLEAR" && (
        <EmptyState icon={<CheckCircle />} title={t("empty.ownerTitle")} description={t("empty.ownerBody")} />
      )}

      {/* 1. Lo que pide acción: incidencias sin confirmar y facturas vencidas. */}
      {attention.length > 0 && (
        <Section id="portal-attention" title={t("attention")}>
          <ul className={LIST}>
            {attention.map((item) =>
              item.kind === "INCIDENT" ? (
                <Row
                  key={`i-${item.id}`}
                  href={`${base}/caballos/${item.horseId}`}
                  icon={<Warning weight="fill" />}
                  tone={item.severity === "HIGH" ? "danger" : "alert"}
                  title={t("incident", { horse: horseName.get(item.horseId) ?? "" })}
                  detail={day(item.at)}
                  aside={t(`severity.${item.severity}`)}
                />
              ) : item.kind === "INVOICE_OVERDUE" ? (
                <Row
                  key={`f-${item.id}`}
                  href={`${base}/facturas`}
                  icon={<Receipt weight="fill" />}
                  tone="danger"
                  title={item.number ? t("overdueInvoice", { number: item.number }) : t("overdueInvoiceNoNumber")}
                  detail={t("amountPending", { amount: euros(item.pending) })}
                  aside={item.dueDate ? dueLabel(item.dueDate) : undefined}
                />
              ) : null,
            )}
          </ul>
        </Section>
      )}

      {/* 2. Próximos vencimientos y último herraje de cada caballo. */}
      {upcoming.length > 0 && (
        <Section id="portal-upcoming" title={t("upcoming")}>
          <ul className={LIST}>
            {upcoming.map((item) =>
              item.kind === "HEALTH_DUE" ? (
                <Row
                  key={`h-${item.id}`}
                  href={`${base}/caballos/${item.horseId}`}
                  icon={<Heartbeat />}
                  tone={item.offset < 0 ? "alert" : "neutral"}
                  title={item.name}
                  detail={healthDueDetail(item.horseName, item.name, typeLabel(item.type), day(item.due))}
                  aside={dueLabel(item.due)}
                />
              ) : null,
            )}
          </ul>
        </Section>
      )}

      {home.lastFarrier.length > 0 && (
        <Section id="portal-farrier" title={t("lastFarrier")}>
          <ul className={LIST}>
            {home.lastFarrier.map((h) => (
              <Row
                key={h.horseId}
                href={`${base}/caballos/${h.horseId}`}
                icon={<Hammer />}
                title={h.horseName}
                detail={h.date ? day(h.date) : t("farrierNever")}
                aside={h.date ? t("farrierAgo", { days: -calendarDayOffset(h.date, now) }) : undefined}
              />
            ))}
          </ul>
        </Section>
      )}

      {/* 3. Facturas pendientes que aún no han vencido. */}
      {home.pendingInvoices.length > 0 && (
        <Section id="portal-invoices" title={t("pendingInvoices")}>
          <ul className={LIST}>
            {home.pendingInvoices.map((inv) => (
              <Row
                key={inv.id}
                href={`${base}/facturas`}
                icon={<Receipt />}
                title={inv.number ? t("invoice", { number: inv.number }) : t("invoiceNoNumber")}
                detail={inv.dueDate ? t("dueOn", { date: day(inv.dueDate) }) : t("noDueDate")}
                aside={euros(inv.pending)}
              />
            ))}
          </ul>
        </Section>
      )}

      {(balance > 0 || home.pendingInvoices.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-2 shadow-card">
          <p className={cn("text-body font-semibold tabular-nums", balance > 0 ? "text-state-alert-ink" : "text-state-ok-ink")}>
            {t("balance", { amount: euros(balance) })}
          </p>
          <Link
            href={`${base}/facturas`}
            className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-label font-medium text-primary-ink outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("allInvoices")}
            <CaretRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      )}

      {/* 4. Qué se ha hecho con sus caballos esta semana y qué está programado. */}
      {home.activity.length > 0 && (
        <Section id="portal-activity" title={t("activity")}>
          <ol className="space-y-4">
            {groupEmptyDays(home.activity).map((block) =>
              block.kind === "empty" ? (
                <li key={`vacio-${block.to}`}>
                  <p className="px-1 text-label text-muted-foreground">{emptyRun(block)}</p>
                </li>
              ) : (
                <li key={block.day} className="space-y-1.5">
                  <h3 className="text-label font-semibold text-muted-foreground">
                    {block.day === today ? t("today") : block.day === yesterday ? t("yesterday") : weekday(block.day)}
                  </h3>
                  <ul className={LIST}>
                    {block.items.map((a) => (
                      <Row
                        key={`${a.source}-${a.id}`}
                        href={`${base}/caballos/${a.horseId}`}
                        icon={a.source === "training" ? <Barbell /> : a.kind === "FARRIER" ? <Hammer /> : a.source === "health" ? <Heartbeat /> : <Horse />}
                        title={[
                          a.kind === "HEALTH" ? typeLabel(a.healthType ?? "OTHER") : t(`activityKinds.${a.kind}`),
                          a.title,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        detail={a.horseName}
                        aside={a.durationMin ? t("minutes", { minutes: a.durationMin }) : undefined}
                      />
                    ))}
                  </ul>
                </li>
              ),
            )}
          </ol>
        </Section>
      )}

      {isOwner && (
        <Section id="portal-scheduled" title={t("scheduled")}>
          {home.scheduledTrainings.length === 0 ? (
            <p className="text-label text-muted-foreground">{t("noScheduled")}</p>
          ) : (
            <ul className={LIST}>
              {home.scheduledTrainings.map((s) => (
                <Row
                  key={s.id}
                  href={`${base}/caballos/${s.horseId}`}
                  icon={<Barbell />}
                  title={s.type || t("training")}
                  detail={`${s.horseName} · ${t("minutes", { minutes: s.minutes })}`}
                  aside={shortDay(s.date)}
                />
              ))}
            </ul>
          )}
        </Section>
      )}

      {/* Alumno: sin caballos no se le habla de "tu caballo". */}
      {home.emptyState === "STUDENT_NO_HORSE" && (
        <EmptyState
          icon={<Receipt />}
          title={t("empty.studentTitle")}
          description={t("empty.studentBody")}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`${base}/facturas`}
                className="flex min-h-11 items-center rounded-xl bg-primary px-4 text-label font-semibold text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t("empty.goInvoices")}
              </Link>
              <Link
                href={`${base}/documentos`}
                className="flex min-h-11 items-center rounded-xl border border-border px-4 text-label font-semibold text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("empty.goDocuments")}
              </Link>
            </div>
          }
        />
      )}

      {/* 5. Mis caballos, como la portada anterior. */}
      {horses.length > 0 && (
        <Section id="portal-horses" title={t("horsesSection")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {horses.map((horse) => (
              <Link
                key={horse.id}
                href={`${base}/caballos/${horse.id}`}
                className="group flex min-h-11 gap-4 overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-card transition-colors outline-none hover:border-foreground/20 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {horse.photoUrl ? (
                    <Image src={horse.photoUrl} alt="" fill sizes="5rem" className="object-cover" />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Horse aria-hidden className="h-7 w-7 text-muted-foreground/40" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{horse.name}</p>
                  <p className="truncate text-label text-muted-foreground">
                    {horse.breed || t("noBreed")} · {ageLabel(horse.birthDate)}
                  </p>
                  <p className="truncate text-label text-muted-foreground">
                    {t("box", { box: horse.boxLocation || t("noBox") })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
