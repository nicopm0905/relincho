"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Buildings } from "@phosphor-icons/react";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
import { CircleNotch } from "@phosphor-icons/react";

interface TenantSettingsFormProps {
  tenant: {
    id: string;
    name: string;
    nif: string | null;
    province: string | null;
    regaCode: string | null;
  };
}

export function TenantSettingsForm({ tenant }: TenantSettingsFormProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: tenant.name,
    nif: tenant.nif || "",
    province: tenant.province || "",
    regaCode: tenant.regaCode || "",
  });

  const updateTenant = trpc.tenant.update.useMutation();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    
    setLoading(true);
    try {
      await updateTenant.mutateAsync({
        name: form.name,
        nif: form.nif || undefined,
        province: form.province || undefined,
        regaCode: form.regaCode || undefined,
      });
      toast.success("Ajustes actualizados");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error("Error al guardar los ajustes");
    } finally {
      setLoading(false);
    }
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
          <div className="flex justify-between items-center py-3 border-b border-border/50">
            <span className="text-muted-foreground">Nombre</span>
            <span className="font-medium">{tenant.name}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-border/50">
            <span className="text-muted-foreground">NIF / CIF</span>
            <span className="font-medium">{tenant.nif || "—"}</span>
          </div>
          <div className="flex justify-between items-center py-3 border-b border-border/50">
            <span className="text-muted-foreground">Provincia</span>
            <span className="font-medium">{tenant.province || "—"}</span>
          </div>
          <div className="flex justify-between items-center py-3">
            <span className="text-muted-foreground">Código REGA</span>
            <span className="font-mono text-xs font-medium">{tenant.regaCode || "—"}</span>
          </div>
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
          <div className="space-y-1.5">
            <Label htmlFor="nif">NIF / CIF</Label>
            <Input
              id="nif"
              value={form.nif}
              onChange={(e) => setForm({ ...form, nif: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="province">Provincia</Label>
            <Input
              id="province"
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="regaCode">Código REGA</Label>
            <Input
              id="regaCode"
              value={form.regaCode}
              onChange={(e) => setForm({ ...form, regaCode: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
