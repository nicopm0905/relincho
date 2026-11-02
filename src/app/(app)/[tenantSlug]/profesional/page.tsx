import { getTranslations } from "next-intl/server";
import { createServerCaller } from "@/lib/trpc/server";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Horse } from "@phosphor-icons/react/dist/ssr";
import { RecordVisitForm } from "@/components/professional/record-visit-form";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations("professional");
  return { title: t("metaTitle") };
}

export default async function ProfessionalHomePage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const t = await getTranslations("professional");
  const caller = await createServerCaller(tenantSlug);
  const horses = await caller.professional.myHorses();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("myHorses")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {horses.length > 0 && (
        <RecordVisitForm horses={horses.map((h) => ({ id: h.id, name: h.name }))} />
      )}

      {horses.length === 0 ? (
        <EmptyState icon={<Horse />} title={t("empty")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {horses.map((h) => (
            <li key={h.id}>
              <Card>
                <CardContent className="flex items-center gap-3 p-4">
                  <Horse className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{h.name}</p>
                    {(h.breed || h.boxLocation) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[h.breed, h.boxLocation && t("box", { box: h.boxLocation })]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
