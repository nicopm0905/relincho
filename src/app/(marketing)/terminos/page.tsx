import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

export async function generateMetadata() {
  const t = await getTranslations("metadata.terms");
  return { title: t("title") };
}

export default async function TerminosPage() {
  const session = await auth();
  const t = await getTranslations("legal.terms");
  const tc = await getTranslations("legal.common");

  const sections = ["s1", "s2", "s3", "s4", "s5"] as const;

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-background">
      <Header session={session} />

      <main id="main-content" tabIndex={-1} className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
          {t("title")}
        </h1>

        <div className="prose prose-slate max-w-none text-muted-foreground prose-headings:font-heading prose-headings:text-foreground">
          <p className="lead text-lg mb-8">
            {tc("lastUpdated", { date: tc("updatedDate") })}
          </p>

          {sections.map((s) => (
            <div key={s}>
              <h2 className="text-2xl font-bold mt-12 mb-4">{t(`${s}.title`)}</h2>
              <p className="mb-6">{t(`${s}.body`)}</p>
            </div>
          ))}

          <p className="mt-12 text-sm">{t("contactNote")}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
