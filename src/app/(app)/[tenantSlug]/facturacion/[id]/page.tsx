import { createServerCaller } from "@/lib/trpc/server";
import { invoiceLabel } from "@/lib/invoice-label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CaretLeft, FilePdf } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/formatters";
import { PaymentForm } from "@/components/facturacion/payment-form";
import { InvoiceActions } from "@/components/facturacion/invoice-actions";

interface PageProps {
  params: Promise<{ tenantSlug: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Factura — ${tenantSlug}` };
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  ISSUED: "Pendiente",
  PAID: "Cobrada",
  OVERDUE: "Vencida",
  CANCELLED: "Anulada",
};

const METHOD_LABEL: Record<string, string> = {
  TRANSFER: "Transferencia",
  CASH: "Efectivo",
  CARD: "Tarjeta",
  DIRECT_DEBIT: "Domiciliación",
  OTHER: "Otro",
};

export default async function FacturaDetallePage({ params }: PageProps) {
  const { tenantSlug, id } = await params;
  const caller = await createServerCaller(tenantSlug);

  let invoice;
  try {
    invoice = await caller.invoices.byId({ id });
  } catch {
    notFound();
  }

  const total = Number(invoice.total);
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
  const balance = Math.round((total - paid) * 100) / 100;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in-0 duration-500 w-full">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="rounded-full -ml-3">
          <Link href={`/${tenantSlug}/facturacion`}>
            <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
            Volver a facturación
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
            <FilePdf weight="duotone" className="mr-2 h-4 w-4" />
            Ver PDF
          </a>
        </Button>
      </div>

      <InvoiceActions
        tenantSlug={tenantSlug}
        invoice={{
          id: invoice.id,
          status: invoice.status,
          hasNumber: invoice.number != null,
          isRectification: Boolean(invoice.rectifiesId),
          hasPayments: invoice.payments.length > 0,
          lines: invoice.lines.map((l) => ({
            description: l.description,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            vatRate: Number(l.vatRate),
          })),
        }}
      />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold font-mono text-foreground">
                {invoiceLabel(invoice)}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{invoice.client.name}</p>
              {invoice.rectifies && (
                <p className="mt-1 text-sm">
                  Rectifica la{" "}
                  <Link className="font-medium underline" href={`/${tenantSlug}/facturacion/${invoice.rectifies.id}`}>
                    {invoiceLabel(invoice.rectifies)}
                  </Link>
                  {invoice.rectificationReason ? ` · ${invoice.rectificationReason}` : ""}
                </p>
              )}
              {invoice.rectifiedBy.length > 0 && (
                <p className="mt-1 text-sm text-amber-700">
                  Rectificada por{" "}
                  {invoice.rectifiedBy.map((r, i) => (
                    <span key={r.id}>
                      {i > 0 && ", "}
                      <Link className="font-medium underline" href={`/${tenantSlug}/facturacion/${r.id}`}>
                        {invoiceLabel(r)}
                      </Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
            <Badge variant="outline">{STATUS_LABEL[invoice.status] ?? invoice.status}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Emisión</p>
              <p className="font-medium">
                {invoice.status === "DRAFT" ? "Al emitir" : formatDate(invoice.issueDate)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Vencimiento</p>
              <p className="font-medium">
                {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="font-medium font-mono">{total.toFixed(2)} €</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Líneas
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left min-w-[32rem]">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="py-2">Descripción</th>
                  <th className="py-2 text-right">Cant.</th>
                  <th className="py-2 text-right">Precio U.</th>
                  <th className="py-2 text-right">IVA</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {invoice.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2">
                      {l.description}
                      {l.horse ? (
                        <span className="text-muted-foreground"> · {l.horse.name}</span>
                      ) : null}
                    </td>
                    <td className="py-2 text-right font-mono">{Number(l.quantity)}</td>
                    <td className="py-2 text-right font-mono">{Number(l.unitPrice).toFixed(2)} €</td>
                    <td className="py-2 text-right font-mono">{Number(l.vatRate)}%</td>
                    <td className="py-2 text-right font-mono">
                      {(Number(l.quantity) * Number(l.unitPrice)).toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-end gap-1 border-t border-border/40 pt-4 mt-4 text-sm">
            <div className="flex w-56 justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono">{Number(invoice.subtotal).toFixed(2)} €</span>
            </div>
            <div className="flex w-56 justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span className="font-mono">{Number(invoice.vatTotal).toFixed(2)} €</span>
            </div>
            <div className="flex w-56 justify-between text-base font-bold">
              <span>Total</span>
              <span className="font-mono">{total.toFixed(2)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.verifactuRecords.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Registro Veri*Factu
            </h2>
            <ul className="space-y-2 text-sm">
              {invoice.verifactuRecords.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span>
                    <span className="font-medium">{r.kind === "ALTA" ? "Alta" : "Anulación"}</span>
                    <span className="text-muted-foreground"> · {r.generatedAt}</span>
                  </span>
                  <span className="font-mono text-xs text-muted-foreground" title={r.hash}>
                    Huella {r.hash.slice(0, 12)}…
                  </span>
                  <Badge variant={r.status === "SENT" ? "success" : "warning"}>
                    {r.status === "SENT" ? "Enviado a la AEAT" : "Pendiente de envío"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Pagos
            </h2>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Saldo pendiente</p>
              <p
                className={`font-mono font-bold ${
                  balance <= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {balance.toFixed(2)} €
              </p>
            </div>
          </div>

          {invoice.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>
          ) : (
            <ul className="divide-y divide-border/40 text-sm">
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <span>
                    {formatDate(p.date)} · {METHOD_LABEL[p.method] ?? p.method}
                    {p.reference ? (
                      <span className="text-muted-foreground"> · {p.reference}</span>
                    ) : null}
                  </span>
                  <span className="font-mono font-semibold">
                    {Number(p.amount).toFixed(2)} €
                  </span>
                </li>
              ))}
            </ul>
          )}

          {invoice.status !== "CANCELLED" && invoice.status !== "DRAFT" && balance > 0 && (
            <div className="border-t border-border/40 pt-4">
              <PaymentForm invoiceId={invoice.id} balance={balance} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
