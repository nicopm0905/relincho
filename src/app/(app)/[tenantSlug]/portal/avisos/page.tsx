import { getTranslations } from "next-intl/server";
import { NotificationSettings } from "@/components/notifications/notification-settings";

export async function generateMetadata() {
  const t = await getTranslations("pushSettings");
  return { title: t("metaTitle") };
}

/** Avisos del propietario (E4): push en este móvil y canales por tipo. */
export default async function PortalNotificationsPage() {
  const t = await getTranslations("pushSettings");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("intro")}</p>
      </div>
      <NotificationSettings />
    </div>
  );
}
