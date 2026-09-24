import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import { allowedHorseIds } from "@/server/trpc/access";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sexLabels: Record<string, string> = {
  MALE: "Macho",
  FEMALE: "Hembra",
  GELDING: "Castrado",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    const foaling = await prisma.foaling.findUnique({
      where: { id },
      include: {
        covering: {
          include: {
            mare: true,
            stallion: true,
          },
        },
      },
    });

    if (!foaling) {
      return NextResponse.json({ error: "Parto no encontrado" }, { status: 404 });
    }

    const tenantId = foaling.covering.tenantId;
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: { userId: session.user.id, tenantId },
      },
    });

    if (!membership || !tenant) {
      return NextResponse.json({ error: "Parto no encontrado" }, { status: 404 });
    }
    // Ser miembro no basta: un externo solo accede a sus caballos.
    const visibleHorses = await allowedHorseIds({
      role: membership.role,
      membershipId: membership.id,
    });
    if (visibleHorses && !visibleHorses.includes(foaling.covering.mareId)) {
      return NextResponse.json({ error: "Parto no encontrado" }, { status: 404 });
    }

    const doc = new PDFDocument({ margin: 56, size: "A4" });
    const chunks: Uint8Array[] = [];
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const left = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.fontSize(10).font("Helvetica").fillColor("#555555");
    doc.text("ASOCIACIÓN NACIONAL DE CRIADORES DE CABALLOS DE PURA RAZA ESPAÑOLA", {
      width: contentWidth,
      align: "center",
    });
    doc.text("Libro Genealógico del Caballo de Pura Raza Española", {
      width: contentWidth,
      align: "center",
    });
    doc.moveDown(0.8);
    doc.fontSize(16).font("Helvetica-Bold").fillColor("#111111");
    doc.text("COMUNICACIÓN DE NACIMIENTO", { width: contentWidth, align: "center" });
    doc.moveDown(1);
    doc
      .moveTo(left, doc.y)
      .lineTo(left + contentWidth, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(1);

    const section = (title: string) => {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111");
      doc.text(title.toUpperCase(), left, doc.y, { width: contentWidth, characterSpacing: 0.5 });
      doc.moveDown(0.3);
    };

    const field = (label: string, value: string) => {
      doc.font("Helvetica").fontSize(11).fillColor("#111111");
      doc.text(`${label}: `, left, doc.y, { continued: true });
      doc.font("Helvetica-Bold").text(value && value.trim() ? value : "________________________");
      doc.font("Helvetica");
      doc.moveDown(0.35);
    };

    section("Datos de la ganadería");
    field("Nombre de la ganadería", tenant.name);
    field("Código de ganadería (REGA)", tenant.regaCode ?? "");
    field(
      "Dirección",
      [tenant.address, tenant.postalCode, tenant.city, tenant.province]
        .filter(Boolean)
        .join(", ")
    );

    section("Datos del parto");
    field(
      "Fecha de parto",
      format(new Date(foaling.date), "d 'de' MMMM 'de' yyyy", { locale: es })
    );
    field("Sexo del potro", foaling.sex ? sexLabels[foaling.sex] ?? foaling.sex : "");
    field("Nacido vivo", foaling.alive ? "Sí" : "No");

    const mareName = foaling.covering.mare.name ?? "";
    const mareUeln = foaling.covering.mare.uelnCode ?? "";
    const stallionName = foaling.covering.stallion?.name ?? "";
    const stallionUeln = foaling.covering.stallion?.uelnCode ?? "";

    section("Progenitores");
    field("Yegua (madre)", mareName);
    field("UELN de la yegua", mareUeln);
    field("Nº LG de la yegua", foaling.covering.mare.lgNumber ?? "");
    field("Semental (padre)", stallionName);
    field("UELN del semental", stallionUeln);
    field("Nº LG del semental", foaling.covering.stallion?.lgNumber ?? "");

    section("Reseña del potro (a rellenar a mano)");
    field("Capa", "");
    field("Reseña / particularidades", "");
    doc.moveDown(0.5);
    // Espacio en blanco para el dibujo de la reseña.
    doc
      .rect(left, doc.y, contentWidth, 90)
      .strokeColor("#cccccc")
      .stroke();
    doc.y += 100;

    // Firmas
    doc.moveDown(2);
    const colW = (contentWidth - 30) / 2;
    const sigY = doc.y;
    doc
      .moveTo(left, sigY)
      .lineTo(left + colW, sigY)
      .strokeColor("#111111")
      .stroke();
    doc
      .moveTo(left + colW + 30, sigY)
      .lineTo(left + contentWidth, sigY)
      .stroke();
    doc.font("Helvetica").fontSize(10).fillColor("#555555");
    doc.text("Firma del ganadero", left, sigY + 6, { width: colW, align: "center" });
    doc.text("Firma del veterinario", left + colW + 30, sigY + 6, {
      width: colW,
      align: "center",
    });

    doc.fontSize(8).fillColor("#999999");
    doc.text(
      `Documento generado por Equigest el ${format(new Date(), "dd/MM/yyyy", { locale: es })}. ` +
        "Formato orientativo: verifique los campos con el formulario oficial vigente de ANCCE antes de presentarlo.",
      left,
      doc.page.height - doc.page.margins.bottom - 24,
      { width: contentWidth, align: "center" }
    );

    doc.end();
    const pdfBuffer = await pdfPromise;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="comunicacion-nacimiento-${(mareName.replace(/\s+/g, "_") || "potro")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("COMUNICACION NACIMIENTO PDF ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
