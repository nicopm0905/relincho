import { createServerCaller } from "@/lib/trpc/server";
import { invoiceLabel } from "@/lib/invoice-label";
import { CaretLeft, CaretRight, DownloadSimple, Receipt, FilePdf, ListNumbers, Plus } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { invoiceBalance } from "@/lib/invoice-balance";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getSession } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GenerateInvoicesButton } from "@/components/facturacion/generate-invoices-button";
import { InvoiceFilters } from "@/components/facturacion/invoice-filters";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { InvoiceStatus } from "@prisma/client";

interface PageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string; q?: string; year?: string; quarter?: string; page?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { tenantSlug } = await params;
  return { title: `Facturación — ${tenantSlug}` };
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  PAID: { label: "Cobrada", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ISSUED: { label: "Pendiente", className: "bg-amber-50 text-amber-700 border-amber-200" },
  DRAFT: { label: "Borrador", className: "bg-muted text-muted-foreground" },
  OVERDUE: { label: "Vencida", className: "bg-rose-50 text-rose-700 border-rose-200" },
  CANCELLED: { label: "Anulada", className: "bg-muted text-muted-foreground line-through" },
};

export default async function FacturacionPage({ params, searchParams }: PageProps) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const caller = await createServerCaller(tenantSlug);

  const statusFilter =
    sp.status && sp.status in InvoiceStatus ? (sp.status as InvoiceStatus) : undefined;
  const thisYear = new Date().getFullYear();
  const yearParam = Number(sp.year);
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : undefined;
  const quarterParam = Number(sp.quarter);
  const quarter = year && [1, 2, 3, 4].includes(quarterParam) ? quarterParam : undefined;
  const q = sp.q?.trim().slice(0, 80) || undefined;
  const pageParam = Number(sp.page);
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

  const result = await caller.invoices.list({ status: statusFilter, q, year, quarter, page });
  const { items: invoices, summary } = result;

  const session = await getSession();
  const { membership } = await getTenantAccess(tenantSlug, session?.user?.id);
  const canExport = membership?.role === "OWNER" || membership?.role === "MANAGER";
  const exportHref = `/api/invoices/export?tenant=${encodeURIComponent(tenantSlug)}&year=${year ?? thisYear}${
    quarter ? `&quarter=${quarter}` : ""
  }`;
  const periodLabel = year ? (quarter ? `T${quarter} ${year}` : String(year)) : "todo el histórico";

  // Enlaces del paginador: conservan el resto de filtros.
  const pageHref = (target: number) => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (q) params.set("q", q);
    if (year) params.set("year", String(year));
    if (quarter) params.set("quarter", String(quarter));
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return `/${tenantSlug}/facturacion${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in-0 duration-500">
      <PageHeader
        title="Facturación"
        description="Facturas emitidas a tus clientes, incluidos pupilaje y servicios"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button asChild variant="ghost">
              <Link href={`/${tenantSlug}/facturacion/series`}>
                <ListNumbers weight="bold" className="mr-2 h-4 w-4" />
                Series
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/${tenantSlug}/facturacion/nueva`}>
                <Plus weight="bold" className="mr-2 h-4 w-4" />
                Nueva factura
              </Link>
            </Button>
            {canExport && (
              <Button asChild variant="ghost">
                <a href={exportHref} download>
                  <DownloadSimple weight="bold" className="mr-2 h-4 w-4" />
                  Libro CSV
                </a>
              </Button>
            )}
            <GenerateInvoicesButton />
          </div>
        }
      />

      <InvoiceFilters
        years={[thisYear, thisYear - 1, thisYear - 2, thisYear - 3]}
        current={{ q, status: statusFilter, year, quarter }}
      />

      <section aria-label={`Resumen de ${periodLabel}`} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Facturado" value={formatCurrency(summary.billed)} hint={`Neto emitido · ${periodLabel}`} />
        <StatCard label="Cobrado" value={formatCurrency(summary.collected)} hint="Cobros registrados" />
        <StatCard
          label="Pendiente de cobro"
          value={formatCurrency(summary.pending)}
          hint={summary.overdue > 0 ? `${formatCurrency(summary.overdue)} ya vencido` : "Nada vencido"}
          emphasis={summary.overdue > 0}
        />
        <StatCard
          label="A devolver"
          value={formatCurrency(summary.toRefund)}
          hint="Cobrado de más tras rectificar"
        />
      </section>

      <Card className="overflow-hidden shadow-bento">
        <div className="p-0">
          {invoices.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={<Receipt />}
              title={q || statusFilter || year ? "Ninguna factura coincide" : "Sin facturas"}
              description={
                q || statusFilter || year
                  ? "Prueba con otro cliente, periodo o estado."
                  : "Genera las facturas de pupilaje del mes o crea una factura manual."
              }
            />
          ) : (
            <div className="no-scrollbar overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Número</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Fecha</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Vence</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider">Cliente</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Total</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Saldo</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-center">Estado</th>
                    <th scope="col" className="px-6 py-4 font-semibold tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invoices.map((inv) => {
                    const { pending: balance, voided } = invoiceBalance({
                      total: inv.total,
                      payments: inv.payments,
                      rectifiers: inv.rectifiedBy,
                    });
                    // La rectificativa ajusta la original: su importe no se cobra.
                    const isRectifier = Boolean(inv.rectifiesId);
                    const badge = voided
                      ? { label: "Anulada (rectif.)", className: "bg-muted text-muted-foreground" }
                      : isRectifier && inv.status !== "DRAFT" && inv.status !== "CANCELLED"
                        ? { label: "Rectificativa", className: "bg-sky-50 text-sky-700 border-sky-200" }
                        : STATUS_BADGE[inv.status] ?? {
                      label: inv.status,
                      className: "bg-muted text-muted-foreground",
                    };
                    return (
                      <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-4 font-medium font-mono text-foreground">
                          <Link
                            href={`/${tenantSlug}/facturacion/${inv.id}`}
                            className="hover:underline"
                          >
                            {invoiceLabel(inv)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {formatDate(inv.issueDate)}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                        </td>
                        <td className="px-6 py-4 font-bold text-foreground">
                          {inv.client.name}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold whitespace-nowrap text-foreground">
                          {Number(inv.total).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-mono whitespace-nowrap ${
                            isRectifier || inv.status === "DRAFT"
                              ? "text-muted-foreground"
                              : balance === 0
                                ? "text-emerald-600"
                                : balance < 0
                                  ? "text-amber-700"
                                  : "text-rose-600"
                          }`}
                        >
                          {isRectifier || inv.status === "DRAFT"
                            ? "—"
                            : `${balance.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="outline" className={badge.className}>
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <a
                            href={`/api/invoices/${inv.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-sm font-semibold text-primary-ink transition-colors hover:bg-primary/[0.08]"
                          >
                            <FilePdf className="mr-2 h-4 w-4" />
                            PDF
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {result.pageCount > 1 && (
        <nav aria-label="Paginación" className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {result.total} facturas · página {result.page} de {result.pageCount}
          </span>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className={result.page <= 1 ? "pointer-events-none opacity-50" : undefined}>
              <Link href={pageHref(result.page - 1)} aria-disabled={result.page <= 1} tabIndex={result.page <= 1 ? -1 : undefined}>
                <CaretLeft weight="bold" className="mr-1 h-4 w-4" />
                Anterior
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className={result.page >= result.pageCount ? "pointer-events-none opacity-50" : undefined}>
              <Link
                href={pageHref(result.page + 1)}
                aria-disabled={result.page >= result.pageCount}
                tabIndex={result.page >= result.pageCount ? -1 : undefined}
              >
                Siguiente
                <CaretRight weight="bold" className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
