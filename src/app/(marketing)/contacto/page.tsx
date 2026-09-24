import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

export async function generateMetadata() {
  const t = await getTranslations("metadata.contact");
  return { title: t("title") };
}

export default async function ContactoPage() {
  const session = await auth();
  const t = await getTranslations("legal.contact");

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-background">
      <Header session={session} />

      <main id="main-content" tabIndex={-1} className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-6 text-foreground text-center">
          {t("title")}
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-16">
          {t("intro")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="bg-card p-8 rounded-2xl border border-border/70 shadow-bento">
            <h3 className="text-2xl font-bold font-heading mb-4 text-foreground">{t("support.title")}</h3>
            <p className="text-muted-foreground mb-6">
              {t("support.body")}
            </p>
            <a
              href={`mailto:${t("support.email")}?subject=${encodeURIComponent(t("support.emailSubject"))}`}
              className="text-primary font-medium hover:underline"
            >
              {t("support.email")}
            </a>
          </div>

          <div className="bg-card p-8 rounded-2xl border border-border/70 shadow-bento">
            <h3 className="text-2xl font-bold font-heading mb-4 text-foreground">{t("sales.title")}</h3>
            <p className="text-muted-foreground mb-6">
              {t("sales.body")}
            </p>
            <a
              href={`mailto:${t("sales.email")}?subject=${encodeURIComponent(t("sales.emailSubject"))}`}
              className="text-primary font-medium hover:underline"
            >
              {t("sales.email")}
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
