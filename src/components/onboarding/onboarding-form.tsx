"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTenantAction } from "@/server/actions/tenant";
import { CircleNotch } from "@phosphor-icons/react";

export function OnboardingForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    province: "",
    nif: "",
  });

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.slug.trim()) {
      setError("El nombre y el identificador son obligatorios");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setError("El identificador solo puede contener letras minúsculas, números y guiones");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await createTenantAction(form);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/${form.slug}/caballos`);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crea tu finca en Relincho</CardTitle>
        <CardDescription>
          Configura los datos básicos de tu yeguada o picadero.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre de la finca *</Label>
            <Input
              id="name"
              placeholder="Yeguada El Rocío"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!form.slug) {
                  set("slug", generateSlug(e.target.value));
                }
              }}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Identificador URL *</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground shrink-0">
                Relincho.es/
              </span>
              <Input
                id="slug"
                placeholder="yeguada-el-rocio"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="province">Provincia</Label>
            <Input
              id="province"
              placeholder="Sevilla"
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nif">NIF / CIF (opcional)</Label>
            <Input
              id="nif"
              placeholder="12345678A"
              value={form.nif}
              onChange={(e) => set("nif", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />}
            Crear mi finca
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
