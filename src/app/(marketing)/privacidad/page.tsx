import { getTranslations } from "next-intl/server";
import { auth } from "@/server/auth";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";

export async function generateMetadata() {
  const t = await getTranslations("metadata.privacy");
  return { title: t("title") };
}

export default async function PrivacidadPage() {
  const session = await auth();
  const t = await getTranslations("legal.privacy");
  const tc = await getTranslations("legal.common");
  const s1Items = t.raw("s1.items") as string[];
  const s2Items = t.raw("s2.items") as string[];

  return (
    <div className="flex min-h-screen flex-col selection:bg-primary/20 bg-white">
      <Header session={session} />

      <main className="flex-1 container max-w-4xl mx-auto px-4 sm:px-6 py-32 md:py-40">
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
          {t("title")}
        </h1>

        <div className="prose prose-slate max-w-none text-muted-foreground prose-headings:font-heading prose-headings:text-foreground">
          <p className="lead text-lg mb-8">
            {tc("lastUpdated", { date: tc("updatedDate") })}
          </p>

          <h2 className="text-2xl font-bold mt-12 mb-4">{t("s1.title")}</h2>
          <p className="mb-4">{t("s1.intro")}</p>
          <ul className="mb-6 list-disc space-y-2 pl-6">
            {s1Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold mt-12 mb-4">{t("s2.title")}</h2>
          <p className="mb-4">{t("s2.intro")}</p>
          <ul className="mb-6 list-disc space-y-2 pl-6">
            {s2Items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h2 className="text-2xl font-bold mt-12 mb-4">{t("s3.title")}</h2>
          <p className="mb-6">{t("s3.body")}</p>

          <h2 className="text-2xl font-bold mt-12 mb-4">{t("s4.title")}</h2>
          <p className="mb-6">{t("s4.body")}</p>

          <h2 className="text-2xl font-bold mt-12 mb-4">{t("s5.title")}</h2>
          <p className="mb-6">{t("s5.body")}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
