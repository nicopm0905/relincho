"use client";

import { useMemo, useState } from "react";
import { EnvelopeSimple, MapPin, Phone, Plus, Users } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { ContactDialog, contactKindLabels, type EditableContact } from "./contact-dialog";

function Field({ icon, value, empty }: { icon: React.ReactNode; value: string | null; empty: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-muted-foreground/70 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
      <span className="truncate text-foreground/85">
        {value || <span className="text-muted-foreground">{empty}</span>}
      </span>
    </div>
  );
}

export function ContactsView({ contacts }: { contacts: EditableContact[] }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditableContact | null>(null);
  const [kind, setKind] = useState("ALL");

  const kinds = useMemo(() => {
    const seen = new Set(contacts.map((c) => c.kind));
    return Object.keys(contactKindLabels).filter((key) => seen.has(key));
  }, [contacts]);
  const visible = kind === "ALL" ? contacts : contacts.filter((c) => c.kind === kind);

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus weight="bold" />
      Añadir contacto
    </Button>
  );

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="Sin contactos registrados"
          description="Empieza añadiendo tu equipo habitual: veterinario, herrador y clientes de pupilaje."
          action={addButton}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {kinds.length > 1 ? (
              <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap gap-2">
                {["ALL", ...kinds].map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={kind === value}
                    onClick={() => setKind(value)}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                      kind === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/80 bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {value === "ALL"
                      ? "Todos"
                      : contactKindLabels[value as keyof typeof contactKindLabels]}
                  </button>
                ))}
              </div>
            ) : (
              <span />
            )}
            {addButton}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((contact) => (
              <article
                key={contact.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[14.5px] font-semibold text-foreground">
                      {contact.name}
                    </h3>
                    <p className="mt-0.5 truncate font-mono text-[11.5px] text-muted-foreground">
                      {contact.nif || "Sin NIF"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {contactKindLabels[contact.kind as keyof typeof contactKindLabels] ?? contact.kind}
                  </Badge>
                </div>

                <div className="space-y-1.5 text-[12.5px]">
                  <Field icon={<Phone />} value={contact.phone} empty="Sin teléfono" />
                  <Field icon={<EnvelopeSimple />} value={contact.email} empty="Sin email" />
                  <Field icon={<MapPin />} value={contact.address} empty="Sin dirección" />
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5">
                  <div className="flex gap-1">
                    {contact.phone && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>Llamar</a>
                      </Button>
                    )}
                    {contact.email && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={`mailto:${contact.email}`}>Escribir</a>
                      </Button>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setEditing(contact)}>
                    Editar
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {creating && <ContactDialog open onOpenChange={setCreating} />}
      {editing && (
        <ContactDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          contact={editing}
        />
      )}
    </div>
  );
}
