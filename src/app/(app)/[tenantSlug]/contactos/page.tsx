import { createServerCaller } from "@/lib/trpc/server";
import {
  Users,
  Phone,
  EnvelopeSimple,
  MapPin,
  Plus,
} from "@phosphor-icons/react/dist/ssr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Contactos — ${tenantSlug}` };
}

/** Contacts arrive as enum codes; never show those to the user. */
const kindLabels: Record<string, string> = {
  VET: "Veterinario",
  FARRIER: "Herrador",
  CLIENT: "Cliente",
  OWNER: "Propietario",
  SUPPLIER: "Proveedor",
  OTHER: "Otro",
};

export default async function ContactosPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  const contacts = await caller.contacts.list();

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <PageHeader
        title="Contactos"
        description="Veterinarios, herradores, clientes y propietarios de la yeguada"
        actions={
          <Button>
            <Plus weight="bold" />
            Añadir contacto
          </Button>
        }
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users weight="duotone" />}
          title="Sin contactos registrados"
          description="Empieza añadiendo tu equipo habitual: veterinario, herrador y clientes de pupilaje."
          action={
            <Button>
              <Plus weight="bold" />
              Añadir contacto
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {contacts.map((contact) => (
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
                  {kindLabels[contact.kind] ?? contact.kind}
                </Badge>
              </div>

              <dl className="space-y-1.5 text-[12.5px]">
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Teléfono</dt>
                  <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <dd className="truncate text-foreground/85">
                    {contact.phone || (
                      <span className="text-muted-foreground">
                        Sin teléfono
                      </span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Email</dt>
                  <EnvelopeSimple className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <dd className="truncate text-foreground/85">
                    {contact.email || (
                      <span className="text-muted-foreground">Sin email</span>
                    )}
                  </dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt className="sr-only">Dirección</dt>
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                  <dd className="truncate text-foreground/85">
                    {contact.address || (
                      <span className="text-muted-foreground">
                        Sin dirección
                      </span>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="mt-auto flex justify-end border-t border-border pt-2.5">
                <Button variant="ghost" size="sm">
                  Editar
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
