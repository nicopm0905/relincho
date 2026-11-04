import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { NewIncidentForm } from "@/components/incidents/new-incident-form";
import { IncidentList } from "@/components/incidents/incident-list";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations("incidents");
  return { title: t("metaTitle") };
}

/** Incidencias del centro (E5): abrir una en pocos toques y ver quién la ha confirmado. */
export default async function IncidentsPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const t = await getTranslations("incidents");
  const caller = await createServerCaller(tenantSlug);

  let data;
  try {
    // Solo el personal: a cualquier otro rol las procedures le cortan.
    const [incidents, horses] = await Promise.all([
      caller.incidents.list({}),
      caller.horses.list({ status: "ACTIVE" }),
    ]);
    data = { incidents, horses };
  } catch {
    notFound();
  }

  return (
    <div className="animate-in fade-in-0 max-w-2xl space-y-6 duration-500">
      <PageHeader title={t("title")} description={t("intro")} />
      <NewIncidentForm horses={data.horses.map((h) => ({ id: h.id, name: h.name }))} />
      <section aria-labelledby="incidents-list" className="space-y-3">
        <h2 id="incidents-list" className="text-lg font-semibold text-foreground">
          {t("list.title")}
        </h2>
        <IncidentList incidents={data.incidents} />
      </section>
    </div>
  );
}
