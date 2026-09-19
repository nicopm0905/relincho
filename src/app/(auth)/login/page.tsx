import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { emailAuthEnabled, googleAuthEnabled } from "@/server/auth/config";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.login");
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.login");
  const support = await getTranslations("legal.contact.support");

  // Las vias de acceso se resuelven en el servidor: el navegador nunca recibe
  // un boton que no puede funcionar.
  const googleEnabled = googleAuthEnabled;

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="mx-auto h-20 w-20 relative rounded-[24px] shadow-bento overflow-hidden flex items-center justify-center bg-white border border-border/40">
          <Image src="/logo.png" alt="Relincho" fill className="object-contain p-2" priority />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Relincho
          </h1>
          <p className="text-[15px] font-medium text-muted-foreground mt-1">
            {t("brandSubtitle")}
          </p>
        </div>
      </div>
      <LoginForm
        googleEnabled={googleEnabled}
        emailEnabled={emailAuthEnabled}
        supportEmail={support("email")}
        supportSubject={support("emailSubject")}
      />
      <div className="flex justify-center">
        <LocaleSwitcher />
      </div>
    </div>
  );
}
