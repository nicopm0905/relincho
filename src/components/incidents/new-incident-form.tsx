"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, CircleNotch, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/react";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/compress-image";

export const INCIDENT_CATEGORIES = [
  "LAMENESS",
  "INJURY",
  "NOT_EATING",
  "COLIC_SIGNS",
  "BEHAVIOR",
  "EQUIPMENT",
  "OTHER",
] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH"] as const;
const MAX_PHOTOS = 6;
type Category = (typeof INCIDENT_CATEGORIES)[number];
type Severity = (typeof SEVERITIES)[number];

/** Gravedad que se propone al elegir el tipo: el mozo solo la cambia si hace falta. */
const DEFAULT_SEVERITY: Record<Category, Severity> = {
  LAMENESS: "MEDIUM",
  INJURY: "MEDIUM",
  NOT_EATING: "MEDIUM",
  COLIC_SIGNS: "HIGH",
  BEHAVIOR: "LOW",
  EQUIPMENT: "LOW",
  OTHER: "LOW",
};

/**
 * Nueva incidencia (E5) en pocos toques: caballo, qué pasa y enviar. La
 * gravedad se propone según el tipo. El `clientMutationId` se mantiene
 * mientras se reintenta, así un doble toque o una red mala no la duplican, y
 * es también el borrador bajo el que se suben las fotos (comprimidas antes).
 */
export function NewIncidentForm({ horses }: { horses: { id: string; name: string }[] }) {
  const t = useTranslations("incidents");
  const router = useRouter();
  const [horseId, setHorseId] = useState(horses.length === 1 ? horses[0]!.id : "");
  const [category, setCategory] = useState<Category | "">("");
  const [severity, setSeverity] = useState<Severity>("LOW");
  const [description, setDescription] = useState("");
  const [mutationId, setMutationId] = useState(() => crypto.randomUUID());
  const [photos, setPhotos] = useState<{ key: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const sign = trpc.incidents.photoUploadUrl.useMutation();

  function clearPhotos() {
    photos.forEach((p) => URL.revokeObjectURL(p.preview));
    setPhotos([]);
  }

  async function addPhotos(files: FileList | null) {
    if (!files || !horseId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - photos.length)) {
        const blob = await compressImage(file);
        const { key, uploadUrl } = await sign.mutateAsync({
          horseId,
          draftId: mutationId,
          contentType: blob.type || "image/jpeg",
          sizeBytes: blob.size,
        });
        const put = await fetch(uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "image/jpeg" } });
        if (!put.ok) throw new Error("upload");
        setPhotos((prev) => [...prev, { key, preview: URL.createObjectURL(blob) }]);
      }
    } catch {
      toast.error(t("new.photoError"));
    } finally {
      setUploading(false);
    }
  }

  const create = trpc.incidents.create.useMutation({
    onSuccess: (res) => {
      if (res.callOwner) toast.warning(t("new.savedCallOwner"));
      else toast.success(t("new.saved"));
      setCategory("");
      setSeverity("LOW");
      setDescription("");
      clearPhotos();
      setMutationId(crypto.randomUUID());
      router.refresh();
    },
    onError: (err) => toast.error(err.message || t("new.error")),
  });

  if (horses.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("new.noHorses")}</p>;
  }

  const ready = horseId && category && !create.isPending && !uploading;

  function pick(c: Category) {
    setCategory(c);
    setSeverity(DEFAULT_SEVERITY[c]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!horseId || !category) return;
    create.mutate({
      horseId,
      category,
      severity,
      description: description.trim() || t(`category.${category}`),
      photoKeys: photos.map((p) => p.key),
      clientMutationId: mutationId,
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("new.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="incident-horse">{t("new.horse")}</Label>
            <NativeSelect
              id="incident-horse"
              className="h-11"
              value={horseId}
              required
              onChange={(e) => {
                // Las fotos se guardan bajo la carpeta del caballo: cambiarlo las descarta.
                clearPhotos();
                setHorseId(e.target.value);
              }}
            >
              <option value="" disabled>
                {t("new.horsePlaceholder")}
              </option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("new.category")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {INCIDENT_CATEGORIES.map((c) => (
                <Chip key={c} on={category === c} onClick={() => pick(c)}>
                  {t(`category.${c}`)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("new.severity")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITIES.map((s) => (
                <Chip key={s} on={severity === s} danger={s === "HIGH"} onClick={() => setSeverity(s)}>
                  {t(`severity.${s}`)}
                </Chip>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="incident-description">{t("new.description")}</Label>
            <Textarea
              id="incident-description"
              value={description}
              maxLength={2000}
              rows={3}
              placeholder={t("new.descriptionPlaceholder")}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {photos.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label={t("new.photosCount", { count: photos.length })}>
                {photos.map((p, n) => (
                  <li key={p.key} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
                    <img src={p.preview} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <button
                      type="button"
                      aria-label={t("new.removePhoto", { n: n + 1 })}
                      onClick={() => {
                        URL.revokeObjectURL(p.preview);
                        setPhotos((prev) => prev.filter((x) => x.key !== p.key));
                      }}
                      className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <X aria-hidden className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {photos.length < MAX_PHOTOS && (
              <label
                className={cn(
                  "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 text-sm font-medium",
                  (!horseId || uploading) && "pointer-events-none opacity-50",
                )}
              >
                {uploading ? (
                  <CircleNotch weight="bold" aria-hidden className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera aria-hidden className="h-4 w-4" />
                )}
                {uploading ? t("new.uploading") : horseId ? t("new.addPhoto") : t("new.photoNeedsHorse")}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="sr-only"
                  disabled={!horseId || uploading}
                  onChange={(e) => {
                    void addPhotos(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          <Button type="submit" className="h-11 w-full" disabled={!ready}>
            {create.isPending && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            {create.isPending ? t("new.saving") : t("new.submit")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Chip({
  on,
  danger,
  onClick,
  children,
}: {
  on: boolean;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on
          ? danger
            ? "border-state-danger bg-state-danger-soft text-state-danger-ink"
            : "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
