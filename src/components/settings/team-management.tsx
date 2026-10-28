"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ProfessionalSpecialty, Role } from "@prisma/client";
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
import { PROFESSIONAL_SPECIALTIES } from "@/lib/permissions";

/**
 * Roles que se pueden asignar desde aquí. INSTRUCTOR y RIDER esperan al módulo
 * de clases (E1c). PROFESSIONAL se elige al invitar, porque necesita especialidad.
 */
const ROLE_OPTIONS = [
  "OWNER",
  "MANAGER",
  "GROOM",
  "VET_EXTERNAL",
  "OWNER_EXTERNAL",
  "PROFESSIONAL",
] as const satisfies readonly Role[];

/** Roles cuyo acceso se limita a caballos concretos via HorseAccess. */
const SCOPED_ROLES = new Set<Role>(["VET_EXTERNAL", "OWNER_EXTERNAL", "PROFESSIONAL"]);

export function TeamManagement() {
  const t = useTranslations("team");
  const utils = trpc.useUtils();
  const membersQuery = trpc.members.list.useQuery();
  const horsesQuery = trpc.horses.list.useQuery(undefined);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("GROOM");
  const [specialty, setSpecialty] = useState<ProfessionalSpecialty | "">("");
  const [specialtyNote, setSpecialtyNote] = useState("");

  const invalidate = () => utils.members.list.invalidate();

  const invite = trpc.members.invite.useMutation({
    onSuccess: () => {
      toast.success(t("invited"));
      setEmail("");
      setRole("GROOM");
      setSpecialty("");
      setSpecialtyNote("");
      invalidate();
    },
    onError: (err) => toast.error(err.message || t("inviteError")),
  });

  const updateRole = trpc.members.updateRole.useMutation({
    onSuccess: () => {
      toast.success(t("roleUpdated"));
      invalidate();
    },
    onError: (err) => toast.error(err.message || t("roleError")),
  });

  const remove = trpc.members.remove.useMutation({
    onSuccess: () => {
      toast.success(t("removed"));
      invalidate();
    },
    onError: (err) => toast.error(err.message || t("removeError")),
  });

  const grant = trpc.members.grantHorseAccess.useMutation({
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err.message || t("grantError")),
  });

  const revoke = trpc.members.revokeHorseAccess.useMutation({
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err.message || t("revokeError")),
  });

  const horses = horsesQuery.data ?? [];
  const isProfessional = role === "PROFESSIONAL";

  return (
    <div className="space-y-6">
      {/* Formulario de invitación */}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!email.trim()) {
            toast.error(t("emailRequired"));
            return;
          }
          if (isProfessional && !specialty) {
            toast.error(t("specialtyRequired"));
            return;
          }
          invite.mutate({
            email: email.trim(),
            role,
            ...(isProfessional && specialty ? { specialty, specialtyNote } : {}),
          });
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="invite-email">{t("email")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:w-48">
            <Label>{t("role")}</Label>
            <Select value={role} onValueChange={(v) => setRole((v as Role) || "GROOM")}>
              <SelectTrigger aria-label={t("role")}>
                <SelectValue>{t(`roles.${role}`)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isProfessional && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1.5 sm:w-56">
              <Label>{t("specialty")}</Label>
              <Select
                value={specialty}
                onValueChange={(v) => setSpecialty((v as ProfessionalSpecialty) || "")}
              >
                <SelectTrigger aria-label={t("specialty")}>
                  <SelectValue placeholder={t("specialtyPlaceholder")}>
                    {specialty ? t(`specialties.${specialty}`) : t("specialtyPlaceholder")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PROFESSIONAL_SPECIALTIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`specialties.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-specialty-note">{t("specialtyNote")}</Label>
              <Input
                id="invite-specialty-note"
                maxLength={100}
                placeholder={t("specialtyNotePlaceholder")}
                value={specialtyNote}
                onChange={(e) => setSpecialtyNote(e.target.value)}
              />
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={invite.isPending} className="w-full sm:w-auto">
            {invite.isPending ? (
              <CircleNotch weight="bold" className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PaperPlaneTilt weight="bold" className="mr-2 h-4 w-4" />
            )}
            {t("invite")}
          </Button>
        </div>
      </form>

      <Separator />

      {/* Lista de miembros */}
      {membersQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
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
                  {m.specialty && (
                    <p className="truncate text-xs text-muted-foreground">
                      {t(`specialties.${m.specialty}`)}
                      {m.specialtyNote ? ` · ${m.specialtyNote}` : ""}
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
                    <SelectTrigger className="h-8 w-44 text-xs" aria-label={t("role")}>
                      <SelectValue>{t(`roles.${m.role}`)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {/* Para pasar a PROFESSIONAL hace falta especialidad: se invita. */}
                      {ROLE_OPTIONS.filter(
                        (r) => r !== "PROFESSIONAL" || m.role === "PROFESSIONAL",
                      ).map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(`roles.${r}`)}
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
                    aria-label={t("remove")}
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
                    {t("horsesWithAccess")}
                  </p>
                  {horses.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {t("noHorses")}
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
                      {t("noHorsesAssigned")}
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
