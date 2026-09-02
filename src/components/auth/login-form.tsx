"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleLogo, CircleNotch } from "@phosphor-icons/react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("resend", { email, callbackUrl: "/dashboard" });
    setLoading(false);
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    await signIn("google", { callbackUrl: "/dashboard" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Iniciar sesión</CardTitle>
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
          Continuar con Google
        </Button>

        <div className="flex items-center gap-4">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">o</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={handleMagicLink} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              placeholder="nombre@yeguada.es"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && (
              <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
            )}
            Enviar enlace mágico
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
