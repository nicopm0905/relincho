"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { getUploadUrlAction } from "@/server/actions/storage";
import { trpc } from "@/lib/trpc/react";
import { CircleNotch, UploadSimple, Horse } from "@phosphor-icons/react";
import { toast } from "sonner";
import Image from "next/image";
import { isValidMicrochip, isValidUeln } from "@/lib/identifiers";

const SEX_LABELS: Record<string, string> = {
  MALE: "Semental",
  FEMALE: "Yegua",
  GELDING: "Castrado",
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  IN_TRAINING: "En doma",
  SOLD: "Vendido",
  RETIRED: "Retirado",
  DEAD: "Fallecido",
};

const NONE = "__none__";

interface FormState {
  name: string;
  sex: "MALE" | "FEMALE" | "GELDING";
  status: "ACTIVE" | "SOLD" | "DEAD" | "RETIRED" | "IN_TRAINING";
  breed: string;
  coat: string;
  birthDate: string;
  uelnCode: string;
  microchip: string;
  hierro: string;
  boxLocation: string;
  sireId: string;
  damId: string;
  currentOwnerId: string;
  breederId: string;
  lgNumber: string;
}

interface HorseFormProps {
  tenantSlug: string;
  tenantId: string;
  defaultValues?: Partial<FormState & { id: string; photoUrl?: string }>;
}

export function HorseForm({ tenantSlug, tenantId, defaultValues }: HorseFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(defaultValues?.photoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const updateHorse = trpc.horses.update.useMutation();
  const createHorse = trpc.horses.create.useMutation();

  const [form, setForm] = useState<FormState>({
    name: defaultValues?.name ?? "",
    sex: defaultValues?.sex ?? "MALE",
    status: defaultValues?.status ?? "ACTIVE",
    breed: defaultValues?.breed ?? "",
    coat: defaultValues?.coat ?? "",
    birthDate: defaultValues?.birthDate ?? "",
    uelnCode: defaultValues?.uelnCode ?? "",
    microchip: defaultValues?.microchip ?? "",
    hierro: defaultValues?.hierro ?? "",
    boxLocation: defaultValues?.boxLocation ?? "",
    sireId: defaultValues?.sireId ?? "",
    damId: defaultValues?.damId ?? "",
    currentOwnerId: defaultValues?.currentOwnerId ?? "",
    breederId: defaultValues?.breederId ?? "",
    lgNumber: defaultValues?.lgNumber ?? "",
  });

  // Padres entre los caballos de la yeguada (sin el propio), propietario
  // entre los contactos.
  const { data: horses } = trpc.horses.list.useQuery();
  const { data: contacts } = trpc.contacts.list.useQuery(undefined, { retry: false });
  const others = (horses ?? []).filter((h) => h.id !== defaultValues?.id);
  const sires = others.filter((h) => h.sex === "MALE");
  const dams = others.filter((h) => h.sex === "FEMALE");

  // Aviso en vivo; el servidor valida igual.
  const uelnInvalid = form.uelnCode.trim() !== "" && !isValidUeln(form.uelnCode);
  const chipInvalid = form.microchip.trim() !== "" && !isValidMicrochip(form.microchip);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await getUploadUrlAction({
        tenantId,
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        kind: "image",
        folder: "horses",
      });
      if (result.error || !result.uploadUrl) {
        toast.error(result.error ?? "Error al obtener URL de subida");
        return;
      }
      const upload = await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!upload.ok) {
        toast.error("No se ha podido subir la foto");
        return;
      }
      setPhotoUrl(result.publicUrl);
      toast.success("Foto subida correctamente");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }
    if (uelnInvalid || chipInvalid) {
      setError("Revisa el UELN o el microchip");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = {
        ...form,
        birthDate: form.birthDate ? new Date(form.birthDate) : undefined,
        breed: form.breed || undefined,
        coat: form.coat || undefined,
        uelnCode: form.uelnCode || undefined,
        microchip: form.microchip || undefined,
        hierro: form.hierro || undefined,
        boxLocation: form.boxLocation || undefined,
        photoUrl: photoUrl,
        // Al editar, vaciar el campo quita el dato (null); al crear, no se envia.
        sireId: form.sireId || (defaultValues?.id ? null : undefined),
        damId: form.damId || (defaultValues?.id ? null : undefined),
        currentOwnerId: form.currentOwnerId || (defaultValues?.id ? null : undefined),
        breederId: form.breederId || (defaultValues?.id ? null : undefined),
        lgNumber: form.lgNumber || undefined,
      };
      if (defaultValues?.id) {
        await updateHorse.mutateAsync({ id: defaultValues.id, ...payload });
        toast.success("Caballo actualizado");
      } else {
        await createHorse.mutateAsync(payload);
        toast.success("Caballo añadido");
      }
      router.push(`/${tenantSlug}/caballos`);
      router.refresh();
    } catch (err) {
      // El servidor explica el motivo (microchip repetido, padre no valido...).
      const message = err instanceof Error && err.message ? err.message : "Error al guardar el caballo";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Foto */}
          <div className="space-y-2">
            <Label>Foto</Label>
            <div className="flex items-center gap-4">
              {photoUrl ? (
                <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                  <Image src={photoUrl} alt="Foto" fill className="object-cover" />
                </div>
              ) : (
                <div className="h-20 w-20 rounded-2xl border bg-muted flex items-center justify-center">
                  <Horse className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadSimple weight="bold" className="mr-2 h-4 w-4" />
                )}
                {uploading ? "Subiendo..." : "Subir foto"}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Espartero III"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Sexo *</Label>
              <Select value={form.sex} onValueChange={(v) => set("sex", v ?? "MALE")}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => SEX_LABELS[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Semental</SelectItem>
                  <SelectItem value="FEMALE">Yegua</SelectItem>
                  <SelectItem value="GELDING">Castrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v ?? "ACTIVE")}>
                <SelectTrigger>
                  <SelectValue>{(v: string) => STATUS_LABELS[v] ?? v}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="IN_TRAINING">En doma</SelectItem>
                  <SelectItem value="SOLD">Vendido</SelectItem>
                  <SelectItem value="RETIRED">Retirado</SelectItem>
                  <SelectItem value="DEAD">Fallecido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="breed">Raza</Label>
              <Input
                id="breed"
                value={form.breed}
                onChange={(e) => set("breed", e.target.value)}
                placeholder="PRE"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="coat">Capa</Label>
              <Input
                id="coat"
                value={form.coat}
                onChange={(e) => set("coat", e.target.value)}
                placeholder="Tordo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birthDate">Fecha de nacimiento</Label>
              <Input
                id="birthDate"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="uelnCode">UELN</Label>
              <Input
                id="uelnCode"
                value={form.uelnCode}
                onChange={(e) => set("uelnCode", e.target.value)}
                placeholder="724015240123456"
                aria-invalid={uelnInvalid}
                aria-describedby={uelnInvalid ? "uelnCode-error" : undefined}
                className="uppercase"
              />
              {uelnInvalid && (
                <p id="uelnCode-error" className="text-xs text-destructive">
                  15 caracteres, como en el pasaporte
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="microchip">Microchip</Label>
              <Input
                id="microchip"
                value={form.microchip}
                onChange={(e) => set("microchip", e.target.value)}
                placeholder="941000012345678"
                inputMode="numeric"
                aria-invalid={chipInvalid}
                aria-describedby={chipInvalid ? "microchip-error" : undefined}
              />
              {chipInvalid && (
                <p id="microchip-error" className="text-xs text-destructive">
                  15 dígitos
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hierro">Hierro del criador</Label>
              <Input
                id="hierro"
                value={form.hierro}
                onChange={(e) => set("hierro", e.target.value)}
                placeholder="Ej: ER"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="boxLocation">Box / Ubicación</Label>
              <Input
                id="boxLocation"
                value={form.boxLocation}
                onChange={(e) => set("boxLocation", e.target.value)}
                placeholder="Box 3"
              />
            </div>
          </div>

          <fieldset className="space-y-4 border-t border-border/60 pt-5">
            <legend className="text-sm font-semibold text-foreground">Genealogía y propiedad</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="lgNumber">Nº Libro Genealógico (ANCCE)</Label>
                <Input
                  id="lgNumber"
                  value={form.lgNumber}
                  onChange={(e) => set("lgNumber", e.target.value)}
                  placeholder="Como figura en la carta genealógica"
                  className="uppercase"
                />
              </div>
              <RefSelect
                id="breederId"
                label="Criador"
                value={form.breederId}
                onChange={(v) => set("breederId", v)}
                options={(contacts ?? []).map((c) => ({ id: c.id, name: c.name }))}
                empty="La propia yeguada"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <RefSelect
                id="sireId"
                label="Padre"
                value={form.sireId}
                onChange={(v) => set("sireId", v)}
                options={sires}
                empty="Sin indicar"
              />
              <RefSelect
                id="damId"
                label="Madre"
                value={form.damId}
                onChange={(v) => set("damId", v)}
                options={dams}
                empty="Sin indicar"
              />
              <RefSelect
                id="currentOwnerId"
                label="Propietario"
                value={form.currentOwnerId}
                onChange={(v) => set("currentOwnerId", v)}
                options={(contacts ?? []).map((c) => ({ id: c.id, name: c.name }))}
                empty="La propia yeguada"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Si el padre o la madre no están en tu cuadra, añádelos como caballos con estado
              «Retirado» o «Vendido» para tener la genealogía completa.
            </p>
          </fieldset>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading}>
              {loading && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />}
              {defaultValues?.id ? "Guardar cambios" : "Añadir caballo"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function RefSelect({
  id,
  label,
  value,
  onChange,
  options,
  empty,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; name: string }[];
  empty: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || NONE}
        onValueChange={(v) => onChange(!v || v === NONE ? "" : (v as string))}
      >
        <SelectTrigger id={id}>
          <SelectValue>
            {(v: string) => (v === NONE ? empty : (options.find((o) => o.id === v)?.name ?? "Cargando…"))}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{empty}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
