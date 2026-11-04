import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { StateBadge } from "@/components/ui/state-badge";
import { AcknowledgeIncident } from "@/components/incidents/acknowledge-incident";

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations("incidents");
  return { title: t("metaTitle") };
}

/**
 * Incidencia vista por el propietario (E5): qué ha pasado, las
 * actualizaciones del centro y el botón para confirmar que la ha leído.
 */
export default async function PortalIncidentPage({ params }: PageProps) {
  const { tenantSlug, id } = await params;
  const [t, format] = await Promise.all([getTranslations("incidents"), getFormatter()]);
  const caller = await createServerCaller(tenantSlug);

  let incident;
  try {
    incident = await caller.incidents.get({ id });
  } catch {
    notFound();
  }
  const when = (d: Date) =>
    format.dateTime(d, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });

  return (
    <div className="space-y-5">
      <Link
        href={`/${tenantSlug}/portal`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t("detail.back")}
      </Link>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t(`category.${incident.category}`)} · {incident.horseName}
        </h1>
        <div className="flex flex-wrap gap-2">
          <StateBadge tone={incident.severity === "HIGH" ? "danger" : "alert"}>
            {t(`severity.${incident.severity}`)}
          </StateBadge>
          <StateBadge tone={incident.status === "OPEN" ? "alert" : "ok"}>{t(`status.${incident.status}`)}</StateBadge>
        </div>
        <p className="text-sm text-muted-foreground">{t("detail.reported", { when: when(incident.occurredAt) })}</p>
      </div>

      <p className="rounded-2xl border bg-card p-4 text-foreground">{incident.description}</p>

      {incident.photos.length > 0 && (
        <section aria-labelledby="incident-photos" className="space-y-2">
          <h2 id="incident-photos" className="font-semibold text-foreground">
            {t("detail.photos")}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {incident.photos.map((p, n) => (
              <li key={n}>
                <a href={p.url} target="_blank" rel="noreferrer" className="block min-h-11">
                  {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que caduca: no pasa por el optimizador */}
                  <img
                    src={p.url}
                    alt={t("detail.photoAlt", { n: n + 1 })}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {incident.updates.length > 0 && (
        <section aria-labelledby="incident-updates" className="space-y-2">
          <h2 id="incident-updates" className="font-semibold text-foreground">
            {t("detail.updates")}
          </h2>
          <ul className="space-y-2">
            {incident.updates.map((u, n) => (
              <li key={n} className="rounded-xl bg-muted/60 p-3 text-sm">
                <p className="text-foreground">{u.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[u.author, when(u.at)].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {incident.resolutionNote && (
        <p className="text-sm text-muted-foreground">{t("detail.resolvedNote", { note: incident.resolutionNote })}</p>
      )}

      {incident.myReceipt && (
        <AcknowledgeIncident
          id={incident.id}
          read={incident.myReceipt.readAt !== null}
          acknowledgedAt={incident.myReceipt.acknowledgedAt}
          resolved={incident.status === "RESOLVED"}
        />
      )}
    </div>
  );
}
