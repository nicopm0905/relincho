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
  });

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
        folder: "horses",
      });
      if (result.error || !result.uploadUrl) {
        toast.error("Error al obtener URL de subida");
        return;
      }
      await fetch(result.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
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
    } catch {
      toast.error("Error al guardar el caballo");
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
                <div className="h-20 w-20 rounded-2xl border bg-muted flex items-center justify-center text-2xl">
                  🐴
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
                  <SelectValue />
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
                  <SelectValue />
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
              <Label htmlFor="uelnCode">UELN / LG PRE</Label>
              <Input
                id="uelnCode"
                value={form.uelnCode}
                onChange={(e) => set("uelnCode", e.target.value)}
                placeholder="724XXXXXXXXXXXX"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="microchip">Microchip</Label>
              <Input
                id="microchip"
                value={form.microchip}
                onChange={(e) => set("microchip", e.target.value)}
                placeholder="724XXXXXXXXXXXX"
              />
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

