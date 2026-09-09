"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleLogo, CircleNotch } from "@phosphor-icons/react";

export function LoginForm() {
  const t = useTranslations("auth.login");

  // Adonde iba el usuario antes de que le pidieramos entrar, por ejemplo la
  // ficha del caballo cuyo QR acaba de escanear.
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("resend", { email, callbackUrl });
    setLoading(false);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">{t("cardTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">{t("or")}</span>
          <Separator className="flex-1" />
        </div>

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
        </form>
      </CardContent>
    </Card>
  );
}
