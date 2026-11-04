import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { createServerCaller } from "@/lib/trpc/server";
import { ActivityBatch } from "@/components/activity/activity-batch";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata() {
  const t = await getTranslations("activityLog");
  return { title: t("metaTitle") };
}

/** Registro de actividad en lote desde el kiosko (E6): paddock, montado, cuerda… */
export default async function KioskActivityPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const t = await getTranslations("activityLog");
  const caller = await createServerCaller(tenantSlug);

  let horses;
  try {
    horses = await caller.horses.list({ status: "ACTIVE" });
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-8">
      <Link
        href={`/${tenantSlug}/kiosko`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" />
        {t("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <ActivityBatch horses={horses.map((h) => ({ id: h.id, name: h.name, boxLocation: h.boxLocation }))} />
    </div>
  );
}
