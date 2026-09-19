import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPinLine, Eye } from "@phosphor-icons/react/dist/ssr";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <MapPinLine weight="duotone" className="h-6 w-6 text-muted-foreground" />
        </div>
        <h1 className="font-heading text-xl font-bold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("body")}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href="/">{t("home")}</Link>
          </Button>
          {/* Un enlace mal escrito suele venir de un QR o un mensaje: la demo
              es el sitio más util al que llevarle. */}
          <Button asChild variant="outline">
            <Link href="/demo">
              <Eye weight="bold" />
              {t("demo")}
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
