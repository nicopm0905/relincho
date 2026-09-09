"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("onboarding");
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
      setError(t("errors.required"));
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setError(t("errors.slugFormat"));
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
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">{t("form.nameLabel")}</Label>
            <Input
              id="name"
              placeholder={t("form.namePlaceholder")}
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
            <Label htmlFor="slug">{t("form.slugLabel")}</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground shrink-0">
                {t("form.slugPrefix")}
              </span>
              <Input
                id="slug"
                placeholder={t("form.slugPlaceholder")}
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="province">{t("form.provinceLabel")}</Label>
            <Input
              id="province"
              placeholder={t("form.provincePlaceholder")}
              value={form.province}
              onChange={(e) => set("province", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nif">{t("form.nifLabel")}</Label>
            <Input
              id="nif"
              placeholder={t("form.nifPlaceholder")}
              value={form.nif}
              onChange={(e) => set("nif", e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />}
            {t("form.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
