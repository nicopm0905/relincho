"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash } from "@phosphor-icons/react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isValidNif } from "@/lib/nif";

export const contactKindLabels = {
  VET: "Veterinario",
  FARRIER: "Herrador",
  CLIENT: "Cliente",
  OWNER: "Propietario",
  SUPPLIER: "Proveedor",
  OTHER: "Otro",
} as const;

type ContactKind = keyof typeof contactKindLabels;

export type EditableContact = {
  id: string;
  kind: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export function ContactDialog({
  open,
  onOpenChange,
  contact,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: EditableContact;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<ContactKind>(
    (contact?.kind as ContactKind) in contactKindLabels ? (contact!.kind as ContactKind) : "CLIENT",
  );
  const [name, setName] = useState(contact?.name ?? "");
  const [nif, setNif] = useState(contact?.nif ?? "");
  const [email, setEmail] = useState(contact?.email ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Aviso en vivo, antes de enviar: el servidor lo valida igual.
  const nifInvalid = nif.trim() !== "" && !isValidNif(nif);

  const onDone = (message: string) => {
    toast.success(message);
    onOpenChange(false);
    router.refresh();
  };
  const onError = (err: { message: string; data?: { code?: string } | null }) =>
    toast.error(
      err.data?.code === "FORBIDDEN"
        ? "Solo el propietario o el encargado pueden cambiar contactos"
        : err.message || "No se ha podido guardar",
    );

  const create = trpc.contacts.create.useMutation({
    onSuccess: () => onDone("Contacto añadido"),
    onError,
  });
  const update = trpc.contacts.update.useMutation({
    onSuccess: () => onDone("Contacto actualizado"),
    onError,
  });
  const remove = trpc.contacts.delete.useMutation({
    onSuccess: () => onDone("Contacto eliminado"),
    onError: (err) => {
      setConfirmDelete(false);
      onError(err);
    },
  });
  const busy = create.isPending || update.isPending || remove.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nifInvalid) return;
    const data = { kind, name, nif, email, phone, address };
    if (contact) update.mutate({ id: contact.id, ...data });
    else create.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{contact ? "Editar contacto" : "Nuevo contacto"}</DialogTitle>
          <DialogDescription>
            Los clientes y propietarios con NIF y dirección se pueden facturar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_1.4fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-kind">Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as ContactKind)}>
                <SelectTrigger id="contact-kind">
                  <SelectValue>
                    {(v: string) => contactKindLabels[v as ContactKind] ?? v}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(contactKindLabels) as ContactKind[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {contactKindLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-name">Nombre o razón social</Label>
              <Input
                id="contact-name"
                required
                autoFocus
                maxLength={200}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact-nif">NIF / CIF</Label>
              <Input
                id="contact-nif"
                value={nif}
                onChange={(e) => setNif(e.target.value)}
                aria-invalid={nifInvalid}
                aria-describedby={nifInvalid ? "contact-nif-error" : undefined}
                placeholder="12345678Z"
                className="uppercase"
              />
              {nifInvalid && (
                <p id="contact-nif-error" className="text-xs text-destructive">
                  Revisa la letra o el dígito de control
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contact-phone">Teléfono</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {(kind === "CLIENT" || kind === "OWNER") && (
              <p className="text-xs text-muted-foreground">
                Con el mismo email con el que entre al portal, verá sus facturas.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact-address">Dirección</Label>
            <Input
              id="contact-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            {contact ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => remove.mutate({ id: contact.id })}
                  >
                    Sí, eliminar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash weight="bold" />
                  Eliminar
                </Button>
              )
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy || nifInvalid}>
                {busy ? "Guardando…" : contact ? "Guardar cambios" : "Añadir contacto"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
