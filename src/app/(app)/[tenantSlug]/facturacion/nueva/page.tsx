import { createServerCaller } from "@/lib/trpc/server";
import { Button } from "@/components/ui/button";
import { CaretLeft, Receipt } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
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
  params: Promise<{ tenantSlug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Nueva factura — ${tenantSlug}` };
}

export default async function NuevaFacturaPage({ params }: PageProps) {
  const { tenantSlug } = await params;
  const caller = await createServerCaller(tenantSlug);

  const [contacts, horses, series] = await Promise.all([
    caller.contacts.list({ kinds: ["CLIENT", "OWNER"] }),
    caller.horses.list(),
    caller.invoices.seriesList(),
  ]);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-0 duration-500 w-full">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-3">
          <Link href={`/${tenantSlug}/facturacion`}>
            <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
            Volver a facturación
          </Link>
        </Button>
      </div>

      <div className="bg-card rounded-2xl p-6 shadow-bento border border-border/80 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-blue-600" />
        <div className="flex items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
            <Receipt weight="duotone" className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Nueva factura</h1>
            <p className="text-muted-foreground text-sm">
              Editor manual de líneas con IVA por línea y totales en vivo
            </p>
          </div>
        </div>

        {series.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-amber-50 border border-amber-200 rounded-xl p-4">
            No hay ninguna serie de facturación. Genera primero las facturas del mes
            (crea la serie por defecto) o crea una serie desde el módulo de facturación.
          </p>
        ) : (
          <NewInvoiceEditor
            tenantSlug={tenantSlug}
            clients={contacts.map((c) => ({ id: c.id, name: c.name }))}
            horses={horses.map((h) => ({ id: h.id, name: h.name }))}
            series={series.map((s) => ({
              id: s.id,
              code: s.code,
              prefix: s.prefix,
              year: s.year,
              isDefault: s.isDefault,
            }))}
          />
        )}
      </div>
    </div>
  );
}
