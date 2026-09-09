import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("metadata.authError");
  return { title: t("title") };
}

export default async function AuthErrorPage() {
  const t = await getTranslations("auth.error");

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
