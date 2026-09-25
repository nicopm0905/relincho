import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import dynamic from "next/dynamic";

const NewInvoiceEditor = dynamic(
  () =>
    import("@/components/facturacion/new-invoice-editor").then(
      (module) => module.NewInvoiceEditor,
    ),
  {
    loading: () => (
      <div className="h-96 animate-pulse rounded-xl bg-muted/40" aria-busy="true" />
    ),
  },
);

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Editar borrador — ${tenantSlug}` };
}

const isoDay = (d: Date) => d.toISOString().split("T")[0];

export default async function EditarBorradorPage({ params }: PageProps) {
  const { tenantSlug, id } = await params;
  const caller = await createServerCaller(tenantSlug);

  let invoice;
  try {
    invoice = await caller.invoices.byId({ id });
  } catch {
    notFound();
  }
  // Solo los borradores se editan; lo emitido se rectifica.
  if (invoice.status !== "DRAFT") redirect(`/${tenantSlug}/facturacion/${id}`);

  const [contacts, horses] = await Promise.all([
    caller.contacts.list({ kinds: ["CLIENT", "OWNER"] }),
    caller.horses.list(),
  ]);
  // El cliente actual tiene que poder elegirse aunque ya no sea CLIENT/OWNER.
  const clients = contacts.map((c) => ({ id: c.id, name: c.name }));
  if (!clients.some((c) => c.id === invoice.clientId)) {
    clients.unshift({ id: invoice.clientId, name: invoice.client.name });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-0 duration-500 w-full">
      <Button variant="ghost" size="sm" asChild className="-ml-3">
        <Link href={`/${tenantSlug}/facturacion/${id}`}>
          <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
          Volver a la factura
        </Link>
      </Button>

      <div className="bg-card rounded-2xl p-6 shadow-bento border border-border/80 sm:p-8">
        <h1 className="mb-1 text-2xl font-bold font-heading text-foreground">Editar borrador</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          {invoice.rectifiesId
            ? "Rectificativa en borrador: revisa las líneas antes de emitirla."
            : "Un borrador se puede cambiar libremente; una vez emitido, solo se rectifica."}
        </p>
        <NewInvoiceEditor
          tenantSlug={tenantSlug}
          clients={clients}
          horses={horses.map((h) => ({ id: h.id, name: h.name }))}
          series={[]}
          initial={{
            id: invoice.id,
            clientId: invoice.clientId,
            lockClient: Boolean(invoice.rectifiesId),
            seriesLabel: invoice.series,
            issueDate: isoDay(invoice.issueDate),
            dueDate: isoDay(invoice.dueDate ?? invoice.issueDate),
            lines: invoice.lines.map((l) => ({
              description: l.description,
              quantity: String(Number(l.quantity)),
              unitPrice: String(Number(l.unitPrice)),
              vatRate: String(Number(l.vatRate)),
              horseId: l.horseId ?? "",
            })),
          }}
        />
      </div>
    </div>
  );
}
