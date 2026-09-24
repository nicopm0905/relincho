import { createServerCaller } from "@/lib/trpc/server";
import { PageHeader } from "@/components/layout/page-header";
import { ContactsView } from "@/components/contactos/contacts-view";

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
  const contacts = await caller.contacts.list();

  return (
    <div className="animate-in fade-in-0 space-y-6 duration-300">
      <PageHeader
        title="Contactos"
        description="Veterinarios, herradores, clientes y propietarios de la yeguada"
      />
      <ContactsView
        contacts={contacts.map(({ id, kind, name, nif, email, phone, address }) => ({
          id,
          kind,
          name,
          nif,
          email,
          phone,
          address,
        }))}
      />
    </div>
  );
}
