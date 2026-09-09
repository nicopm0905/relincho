"use client";

import { useState } from "react";
import type { Role } from "@prisma/client";
import { trpc } from "@/lib/trpc/react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CircleNotch, PaperPlaneTilt, Trash, Horse } from "@phosphor-icons/react";

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Propietario" },
  { value: "MANAGER", label: "Responsable" },
  { value: "GROOM", label: "Mozo de cuadra" },
  { value: "VET_EXTERNAL", label: "Veterinario externo" },
  { value: "OWNER_EXTERNAL", label: "Propietario externo" },
] as const;

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLE_OPTIONS.map((r) => [r.value, r.label]),
);

/** Roles cuyo acceso se limita a caballos concretos via HorseAccess. */
const SCOPED_ROLES = new Set(["VET_EXTERNAL", "OWNER_EXTERNAL"]);

export function TeamManagement() {
  const utils = trpc.useUtils();
  const membersQuery = trpc.members.list.useQuery();
  const horsesQuery = trpc.horses.list.useQuery(undefined);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("GROOM");

  const invalidate = () => utils.members.list.invalidate();

  const invite = trpc.members.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitación enviada");
      setEmail("");
      setRole("GROOM");
      invalidate();
    },
    onError: (err) => toast.error(err.message || "No se pudo invitar"),
  });

  const updateRole = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      toast.success("Rol actualizado");
      invalidate();
    },
    onError: (err) => toast.error(err.message || "No se pudo cambiar el rol"),
  });

  const remove = trpc.members.remove.useMutation({
    onSuccess: () => {
      toast.success("Miembro eliminado");
      invalidate();
    },
    onError: (err) => toast.error(err.message || "No se pudo eliminar"),
  });

  const grant = trpc.members.grantHorseAccess.useMutation({
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err.message || "No se pudo dar acceso"),
  });

  const revoke = trpc.members.revokeHorseAccess.useMutation({
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err.message || "No se pudo revocar el acceso"),
  });

  const horses = horsesQuery.data ?? [];

  return (
    <div className="space-y-6">
      {/* Formulario de invitación */}
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) {
            toast.error("Escribe un email");
            return;
          }
          invite.mutate({ email: email.trim(), role: role as Role });
        }}
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="persona@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:w-48">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v || "GROOM")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? (
            <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PaperPlaneTilt weight="bold" className="mr-2 h-4 w-4" />
          )}
          Invitar
        </Button>
      </form>

      <Separator />

      {/* Lista de miembros */}
      {membersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando equipo…</p>
      ) : (
        <ul className="space-y-4">
          {(membersQuery.data ?? []).map((m) => (
            <li key={m.membershipId} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {m.name || m.email}
                  </p>
                  {m.name && (
                    <p className="truncate text-xs text-muted-foreground">
                      {m.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={m.role}
                    onValueChange={(v) =>
                      v &&
                      v !== m.role &&
                      updateRole.mutate({
                        membershipId: m.membershipId,
                        role: v as Role,
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-44 text-xs">
                      <SelectValue>{ROLE_LABELS[m.role] ?? m.role}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() =>
                      remove.mutate({ membershipId: m.membershipId })
                    }
                    disabled={remove.isPending}
                    aria-label="Eliminar miembro"
                  >
                    <Trash weight="bold" className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Selector de caballos con acceso para roles externos */}
              {SCOPED_ROLES.has(m.role) && (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Horse weight="bold" className="h-3.5 w-3.5" />
                    Caballos con acceso
                  </p>
                  {horses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay caballos.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {horses.map((h) => {
                        const granted = m.horseIds.includes(h.id);
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() =>
                              granted
                                ? revoke.mutate({
                                    membershipId: m.membershipId,
                                    horseId: h.id,
                                  })
                                : grant.mutate({
                                    membershipId: m.membershipId,
                                    horseId: h.id,
                                  })
                            }
                          >
                            <Badge
                              variant={granted ? "success" : "secondary"}
                              className="cursor-pointer"
                            >
                              {h.name}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {m.horseIds.length === 0 && horses.length > 0 && (
                    <p className="mt-2 text-xs text-amber-600">
                      Sin caballos asignados: esta persona no verá ninguno.
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
