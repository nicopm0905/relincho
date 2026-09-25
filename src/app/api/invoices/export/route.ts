import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createServerCaller } from "@/lib/trpc/server";
import { buildLedgerCsv } from "@/lib/invoice-ledger";

export const dynamic = "force-dynamic";

const query = z.object({
  tenant: z.string().min(1).max(80),
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
});

/**
 * Libro de facturas emitidas en CSV (trimestre o ano). `/api` queda fuera del
 * middleware de sesion: la autorizacion la hace `invoices.ledger`, que solo
 * deja pasar a la propiedad y la gerencia de la yeguada.
 */
export async function GET(req: NextRequest) {
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });
  }
  const { tenant, year, quarter } = parsed.data;

  try {
    const caller = await createServerCaller(tenant);
    const rows = await caller.invoices.ledger({ year, quarter });
    const csv = buildLedgerCsv(rows);
    const period = quarter ? `${year}-T${quarter}` : String(year);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="libro-facturas-${tenant}-${period}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof TRPCError && (error.code === "FORBIDDEN" || error.code === "UNAUTHORIZED")) {
      return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
    }
    console.error("Ledger export error:", error);
    return NextResponse.json({ error: "No se pudo generar el libro" }, { status: 500 });
  }
}
