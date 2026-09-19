import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.authError");
  return { title: t("title"), robots: { index: false, follow: false } };
}

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AuthErrorPage({ searchParams }: PageProps) {
  const t = await getTranslations("auth.error");
  const { error } = await searchParams;
  const support = await getTranslations("legal.contact.support");

  // Auth.js manda el codigo en la query. Traducirlo evita el mensaje generico
  // que decia "el enlace ha expirado" incluso cuando el problema era que el
  // proveedor no estaba configurado.
  const code = error && t.has(`codes.${error}`) ? error : "Default";
  const supportHref = `mailto:${support("email")}?subject=${encodeURIComponent(
    support("emailSubject"),
  )}`;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">{t(`codes.${code}`)}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">{t("backToLogin")}</Link>
        </Button>
        {code === "Configuration" && (
          <p className="text-xs text-muted-foreground">
            <a href={supportHref} className="underline underline-offset-2">
              {t("contactSupport")}
            </a>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
