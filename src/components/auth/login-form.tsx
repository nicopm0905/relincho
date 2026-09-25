"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleLogo, CircleNotch, WarningCircle } from "@phosphor-icons/react";

interface LoginFormProps {
  /** Google solo se ofrece si sus credenciales estan dadas de alta. */
  googleEnabled: boolean;
  /** El enlace magico necesita un remitente con dominio verificado. */
  emailEnabled: boolean;
  supportEmail: string;
  supportSubject: string;
}

export function LoginForm({
  googleEnabled,
  emailEnabled,
  supportEmail,
  supportSubject,
}: LoginFormProps) {
  const t = useTranslations("auth.login");

  // Adonde iba el usuario antes de que le pidieramos entrar, por ejemplo la
  // ficha del caballo cuyo QR acaba de escanear.
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supportHref = `mailto:${supportEmail}?subject=${encodeURIComponent(
    supportSubject,
  )}`;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    // `redirect: false` para poder ver si el envio ha fallado de verdad: antes
    // se mostraba "revisa tu correo" aunque Resend hubiera rechazado el email.
    const result = await signIn("resend", { email, callbackUrl, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError(t("emailError"));
      return;
    }
    router.push("/login/verify");
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setGoogleLoading(false);
      setError(t("googleError"));
    }
  }

  // Sin ninguna via configurada no se pinta un formulario que no puede
  // funcionar: se dice que el acceso no esta disponible y a quien escribir.
  if (!googleEnabled && !emailEnabled) {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
            <WarningCircle className="h-6 w-6 text-amber-600" />
          </div>
          <CardTitle className="text-center">{t("unavailableTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{t("unavailableBody")}</p>
          <Button asChild variant="outline" className="w-full">
            <a href={supportHref}>{t("unavailableCta")}</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">{t("cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleEnabled && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleLogo weight="bold" className="mr-2 h-4 w-4" />
            )}
            {t("google")}
          </Button>
        )}

        {googleEnabled && emailEnabled && (
          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">{t("or")}</span>
            <Separator className="flex-1" />
          </div>
        )}

        {emailEnabled && (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && (
                <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("submit")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("emailNote")}
            </p>
          </form>
        )}

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
