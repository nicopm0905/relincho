"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Buildings, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { isValidNif } from "@/lib/nif";

interface TenantSettingsFormProps {
  tenant: {
    id: string;
    name: string;
    fiscalName: string | null;
    nif: string | null;
    address: string | null;
    postalCode: string | null;
    city: string | null;
    province: string | null;
    regaCode: string | null;
  };
}

const FIELDS = [
  { key: "fiscalName", label: "Razón social", placeholder: "Si no coincide con el nombre" },
  { key: "nif", label: "NIF / CIF", placeholder: "B12345674" },
  { key: "address", label: "Dirección fiscal", placeholder: "Carretera, finca, nº" },
  { key: "postalCode", label: "Código postal", placeholder: "11400" },
  { key: "city", label: "Municipio", placeholder: "Jerez de la Frontera" },
  { key: "province", label: "Provincia", placeholder: "Cádiz" },
  { key: "regaCode", label: "Código REGA", placeholder: "ES110200000123" },
] as const;
type FieldKey = (typeof FIELDS)[number]["key"];

export function TenantSettingsForm({ tenant }: TenantSettingsFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState<Record<"name" | FieldKey, string>>({
    name: tenant.name,
    fiscalName: tenant.fiscalName ?? "",
    nif: tenant.nif ?? "",
    address: tenant.address ?? "",
    postalCode: tenant.postalCode ?? "",
    city: tenant.city ?? "",
    province: tenant.province ?? "",
    regaCode: tenant.regaCode ?? "",
  });

  const updateTenant = trpc.tenant.update.useMutation({
    onSuccess: () => {
      toast.success("Ajustes actualizados");
      setIsEditing(false);
      router.refresh();
    },
    // El servidor explica que dato falla (NIF, REGA, codigo postal).
    onError: (err) => toast.error(err.message || "Error al guardar los ajustes"),
  });

  // Lo que hace falta para emitir facturas.
  const missing = [
    !tenant.nif || !isValidNif(tenant.nif) ? "NIF" : null,
    !tenant.address ? "dirección fiscal" : null,
  ].filter(Boolean);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    updateTenant.mutate(form);
  }

  if (!isEditing) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Buildings weight="fill" className="h-4 w-4" />
            Información de la finca
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Editar
          </Button>
        </CardHeader>
        <CardContent className="space-y-0 text-sm">
          {missing.length > 0 && (
            <p className="mb-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
              <WarningCircle weight="fill" className="mt-0.5 h-4 w-4 shrink-0" />
              Para emitir facturas falta: {missing.join(" y ")}.
            </p>
          )}
          <div className="flex justify-between items-center py-3 border-b border-border/50">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{tenant.name}</span>
          </div>
          {FIELDS.map((field) => (
            <div key={field.key} className="flex justify-between items-center gap-4 py-3 border-b border-border/50 last:border-0">
              <span className="text-muted-foreground">{field.label}</span>
              <span className={`text-right font-medium ${field.key === "regaCode" ? "font-mono text-xs" : ""}`}>
                {tenant[field.key] || "—"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Buildings weight="fill" className="h-4 w-4" />
          Editar Información
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre de la finca *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className={`space-y-1.5 ${field.key === "address" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  value={form[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={updateTenant.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateTenant.isPending}>
              {updateTenant.isPending && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
