import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";

export async function generateMetadata() {
  const t = await getTranslations("metadata.verify");
  return { title: t("title") };
}

export default async function VerifyPage() {
  const t = await getTranslations("auth.verify");

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
          <EnvelopeSimple weight="duotone" className="h-6 w-6 text-neutral-600" />
        </div>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center text-sm text-muted-foreground">
        <p>{t("body")}</p>
        <p className="mt-2">{t("closeTab")}</p>
      </CardContent>
    </Card>
  );
}
