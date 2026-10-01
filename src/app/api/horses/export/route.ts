import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { getTenantAccess } from "@/server/tenant-access";
import { withTenant } from "@/server/db/prisma";
import { buildHorsesCsv } from "@/lib/horses/export-horses";

export const dynamic = "force-dynamic";

/** GET /api/horses/export?tenant=<slug> — exporta la cuadra a CSV para Excel. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantSlug = request.nextUrl.searchParams.get("tenant");
  if (!tenantSlug || !/^[a-z0-9-]{1,80}$/i.test(tenantSlug)) {
    return NextResponse.json({ error: "Yeguada no válida" }, { status: 400 });
  }

  const { tenant, membership } = await getTenantAccess(
    tenantSlug,
    session.user.id,
  );
  if (!tenant || !membership) {
    return NextResponse.json({ error: "Sin acceso a esta yeguada" }, { status: 403 });
  }
  if (membership.role !== "OWNER" && membership.role !== "MANAGER") {
    return NextResponse.json({ error: "Sin permiso para exportar" }, { status: 403 });
  }

  const horses = await withTenant(tenant.id, (tx) =>
    tx.horse.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: "asc" },
      select: {
        name: true,
        sex: true,
        status: true,
        breed: true,
        coat: true,
        birthDate: true,
        uelnCode: true,
        lgNumber: true,
        microchip: true,
        hierro: true,
        boxLocation: true,
        sire: { select: { name: true } },
        dam: { select: { name: true } },
        owner: { select: { name: true } },
      },
    }),
  );

  return new NextResponse(buildHorsesCsv(horses), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="caballos-${tenantSlug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
