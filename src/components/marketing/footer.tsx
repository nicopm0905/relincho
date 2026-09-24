import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";

export async function Footer() {
  const t = await getTranslations("footer.links");

  return (
    <footer className="border-t border-border/70 bg-background py-12 md:py-16">
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-6">

        <div className="flex items-center gap-2 opacity-80">
          <Image src="/logo.png" alt="Relincho" width={24} height={24} className="grayscale opacity-60" />
          <span className="font-heading font-bold text-foreground">Relincho</span>
          <span className="text-muted-foreground text-sm ml-2">© {new Date().getFullYear()}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/demo" className="hover:text-foreground transition-colors">{t("demo")}</Link>
          <Link href="/fundadores" className="hover:text-foreground transition-colors">{t("founders")}</Link>
          <Link href="/terminos" className="hover:text-foreground transition-colors">{t("terms")}</Link>
          <Link href="/privacidad" className="hover:text-foreground transition-colors">{t("privacy")}</Link>
          <Link href="/cookies" className="hover:text-foreground transition-colors">{t("cookies")}</Link>
          <Link href="/contacto" className="hover:text-foreground transition-colors">{t("contact")}</Link>
        </div>

      </div>
    </footer>
  );
}
