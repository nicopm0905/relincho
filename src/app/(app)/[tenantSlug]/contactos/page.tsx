import { createServerCaller } from "@/lib/trpc/server";
import { Users, Phone, EnvelopeSimple, Buildings } from "@phosphor-icons/react/dist/ssr";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Contactos — ${tenantSlug}` };
}

export default async function ContactosPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);
  
  // Obtenemos todos los contactos
  const contacts = await caller.contacts.list();

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground font-heading flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center border border-orange-200">
              <Users weight="duotone" className="h-6 w-6" />
            </div>
            Directorio de Contactos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestiona los veterinarios, herradores, clientes y propietarios vinculados a la yeguada.
          </p>
        </div>
        <Button className="rounded-full shadow-sm bg-orange-600 hover:bg-orange-700 text-white border-none">
          Añadir Contacto
        </Button>
      </div>

      <Card className="bg-white shadow-bento border-border/40 overflow-hidden">
        <div className="p-0">
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-24 text-muted-foreground p-6">
              <Users weight="duotone" className="h-16 w-16 text-muted/40 mb-4" />
              <p className="text-lg font-bold font-heading text-foreground">No hay contactos registrados</p>
              <p className="text-sm mt-2 max-w-sm">
                Empieza añadiendo tu equipo habitual (veterinarios, clientes de pupilaje).
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/20">
              {contacts.map((contact) => (
                <div key={contact.id} className="bg-white rounded-2xl p-5 border border-border/60 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-lg text-foreground">{contact.name}</h3>
                      <span className="text-xs font-mono text-muted-foreground mt-1 block">NIF: {contact.nif || "No especificado"}</span>
                    </div>
                    <Badge variant="outline" className={`
                      ${contact.kind === 'VET' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                      ${contact.kind === 'FARRIER' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                      ${contact.kind === 'CLIENT' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                      ${contact.kind === 'OWNER' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                    `}>
                      {contact.kind}
                    </Badge>
                  </div>
                  
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span className="font-medium text-foreground/80">{contact.phone || "Sin teléfono"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <EnvelopeSimple className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span className="truncate">{contact.email || "Sin email"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Buildings className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                      <span className="truncate">{contact.address || "Sin dirección física"}</span>
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-border/40 flex justify-end">
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-foreground">
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
