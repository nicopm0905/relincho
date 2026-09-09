import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Carteles imprimibles con el QR de cada caballo.
 *
 * El QR lleva la direccion de la ficha deportiva, no un codigo interno, asi que
 * lo abre la camara de cualquier movil sin instalar nada y sin depender de que
 * el navegador soporte lectura de codigos.
 *
 * GET /api/horses/qr-pdf?tenant=<slug>            -> un cartel por caballo activo
 * GET /api/horses/qr-pdf?tenant=<slug>&horse=<id> -> solo ese caballo
 */

/** Origen real de la peticion, para que el QR funcione en local y en produccion. */
function resolveBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return request.nextUrl.origin;
}

const PAGE_MARGIN = 48;
const QR_SIZE = 300;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const tenantSlug = request.nextUrl.searchParams.get("tenant");
  const horseId = request.nextUrl.searchParams.get("horse");
  if (!tenantSlug) {
    return NextResponse.json({ error: "Falta el parámetro tenant" }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true, name: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Cuadra no encontrada" }, { status: 404 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_tenantId: { userId: session.user.id, tenantId: tenant.id } },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Sin acceso a esta cuadra" }, { status: 403 });
  }

  const horses = await prisma.horse.findMany({
    where: {
      tenantId: tenant.id,
      ...(horseId ? { id: horseId } : { status: { in: ["ACTIVE", "IN_TRAINING"] } }),
    },
    select: { id: true, name: true, boxLocation: true, microchip: true },
    orderBy: [{ boxLocation: "asc" }, { name: "asc" }],
  });
  if (horses.length === 0) {
    return NextResponse.json(
      { error: "No hay caballos que imprimir" },
      { status: 404 },
    );
  }

  const baseUrl = resolveBaseUrl(request);

  // Los QR se generan antes de abrir el documento: pdfkit escribe de forma
  // sincrona y no puede esperar a una promesa a mitad de pagina.
  const cards = await Promise.all(
    horses.map(async (horse) => {
      const url = `${baseUrl}/${tenantSlug}/rendimiento/${horse.id}`;
      return {
        horse,
        qr: await QRCode.toBuffer(url, {
          errorCorrectionLevel: "M",
          margin: 1,
          width: 600,
        }),
      };
    }),
  );

  const stream = new ReadableStream({
    start(controller) {
      const doc = new PDFDocument({ margin: PAGE_MARGIN, size: "A4" });
      doc.on("data", (chunk) => controller.enqueue(chunk));
      doc.on("end", () => controller.close());

      cards.forEach((card, index) => {
        if (index > 0) doc.addPage();

        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - PAGE_MARGIN * 2;

        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#666666")
          .text(tenant.name.toUpperCase(), PAGE_MARGIN, PAGE_MARGIN, {
            width: contentWidth,
            align: "center",
            characterSpacing: 1,
          });

        doc.moveDown(1.2);
        doc
          .fontSize(38)
          .font("Helvetica-Bold")
          .fillColor("#111111")
          .text(card.horse.name, { width: contentWidth, align: "center" });

        if (card.horse.boxLocation) {
          doc.moveDown(0.2);
          doc
            .fontSize(16)
            .font("Helvetica")
            .fillColor("#666666")
            .text(card.horse.boxLocation, { width: contentWidth, align: "center" });
        }

        // El QR, centrado y grande: se lee de lejos y con el móvil en una mano.
        const qrX = (pageWidth - QR_SIZE) / 2;
        const qrY = doc.y + 24;
        doc.image(card.qr, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });

        let cursorY = qrY + QR_SIZE + 28;
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .fillColor("#111111")
          .text("Apunta con la cámara del móvil", PAGE_MARGIN, cursorY, {
            width: contentWidth,
            align: "center",
          });

        cursorY = doc.y + 4;
        doc
          .fontSize(11)
          .font("Helvetica")
          .fillColor("#666666")
          .text(
            "Se abre el plan de entrenamiento y la ración de hoy.",
            PAGE_MARGIN,
            cursorY,
            { width: contentWidth, align: "center" },
          );

        if (card.horse.microchip) {
          doc
            .fontSize(10)
            .font("Courier")
            .fillColor("#999999")
            .text(
              `Microchip ${card.horse.microchip}`,
              PAGE_MARGIN,
              doc.page.height - PAGE_MARGIN - 14,
              { width: contentWidth, align: "center" },
            );
        }
      });

      doc.end();
    },
  });

  const filename = horseId
    ? `qr_${horses[0].name.replace(/\s+/g, "_")}.pdf`
    : `qr_caballos_${tenantSlug}.pdf`;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
