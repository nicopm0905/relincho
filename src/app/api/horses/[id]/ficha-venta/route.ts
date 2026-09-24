import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
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

/** Edad en años cumplidos a partir de la fecha de nacimiento. */
function calcAge(birthDate: Date): number {
  const now = new Date();
  let years = now.getFullYear() - birthDate.getFullYear();
  const m = now.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) years--;
  return Math.max(0, years);
}

function horseLine(h: { name: string; uelnCode: string | null } | null): string {
  if (!h) return "—";
  return h.uelnCode ? `${h.name} (UELN ${h.uelnCode})` : h.name;
}

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

    const horse = await prisma.horse.findUnique({
      where: { id },
      include: {
        tenant: true,
        competitionTargets: { orderBy: { targetDate: "asc" } },
        sire: { include: { sire: true, dam: true } },
        dam: { include: { sire: true, dam: true } },
      },
    });

    if (!horse) {
      return NextResponse.json({ error: "Caballo no encontrado" }, { status: 404 });
    }

    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: { userId: session.user.id, tenantId: horse.tenantId },
      },
    });

    if (!membership) {
      // No revelamos la existencia del caballo a quien no es miembro.
      return NextResponse.json({ error: "Caballo no encontrado" }, { status: 404 });
    }
    // Ser miembro no basta: un externo solo accede a sus caballos.
    const visibleHorses = await allowedHorseIds({
      role: membership.role,
      membershipId: membership.id,
    });
    if (visibleHorses && !visibleHorses.includes(horse.id)) {
      return NextResponse.json({ error: "Caballo no encontrado" }, { status: 404 });
    }

    const publicUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/caballo/${horse.id}`;
    const qrDataUrl = await QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
    });

    // La foto se descarga antes de abrir el documento: pdfkit escribe de forma
    // síncrona y no puede esperar a una promesa a mitad de página.
    let photoBuffer: Buffer | null = null;
    if (horse.photoUrl) {
      try {
        const res = await fetch(horse.photoUrl);
        if (res.ok) {
          photoBuffer = Buffer.from(await res.arrayBuffer());
        }
      } catch {
        photoBuffer = null;
      }
    }

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Uint8Array[] = [];
    const pdfPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const left = doc.page.margins.left;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Cabecera
    doc.fontSize(28).font("Helvetica-Bold").fillColor("#111111").text(horse.name, {
      width: contentWidth,
    });
    doc.moveDown(0.2);
    doc.fontSize(11).font("Helvetica").fillColor("#555555");
    doc.text(horse.tenant.name, { width: contentWidth });
    const ganaderiaMeta = [
      horse.tenant.regaCode ? `Código REGA: ${horse.tenant.regaCode}` : null,
      horse.tenant.province ?? null,
    ]
      .filter(Boolean)
      .join("  ·  ");
    if (ganaderiaMeta) doc.text(ganaderiaMeta, { width: contentWidth });

    doc.moveDown(0.6);
    doc
      .moveTo(left, doc.y)
      .lineTo(left + contentWidth, doc.y)
      .strokeColor("#dddddd")
      .stroke();
    doc.moveDown(0.8);

    // Foto (columna derecha) + datos (columna izquierda)
    const dataTop = doc.y;
    const photoW = 170;
    const photoH = 170;
    const photoX = left + contentWidth - photoW;
    let photoDrawn = false;
    if (photoBuffer) {
      try {
        doc.image(photoBuffer, photoX, dataTop, {
          fit: [photoW, photoH],
          align: "right",
        });
        photoDrawn = true;
      } catch {
        photoDrawn = false;
      }
    }

    const dataWidth = photoDrawn ? contentWidth - photoW - 20 : contentWidth;
    doc.fillColor("#111111");

    const row = (label: string, value: string) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#777777");
      doc.text(label.toUpperCase(), left, doc.y, { width: dataWidth, characterSpacing: 0.5 });
      doc.font("Helvetica").fontSize(12).fillColor("#111111");
      doc.text(value || "—", left, doc.y, { width: dataWidth });
      doc.moveDown(0.5);
    };

    doc.y = dataTop;
    row("UELN", horse.uelnCode ?? "—");
    row("Libro Genealógico", horse.lgNumber ?? "—");
    row("Microchip", horse.microchip ?? "—");
    row("Sexo", sexLabels[horse.sex] ?? horse.sex);
    row("Capa", horse.coat ?? "—");
    row("Raza", horse.breed ?? "—");
    row(
      "Fecha de nacimiento",
      horse.birthDate
        ? `${format(new Date(horse.birthDate), "d 'de' MMMM 'de' yyyy", { locale: es })}` +
            ` (${calcAge(new Date(horse.birthDate))} años)`
        : "—"
    );
    row("Hierro del criador", horse.hierro ?? "—");

    // Nos aseguramos de bajar por debajo de la foto antes de continuar.
    if (photoDrawn && doc.y < dataTop + photoH) doc.y = dataTop + photoH;
    doc.moveDown(1);

    // Genealogía
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111");
    doc.text("Genealogía", left, doc.y, { width: contentWidth });
    doc.moveDown(0.4);
    doc.fontSize(11).font("Helvetica").fillColor("#111111");

    doc.font("Helvetica-Bold").text("Padre: ", { continued: true });
    doc.font("Helvetica").text(horseLine(horse.sire));
    if (horse.sire?.sire || horse.sire?.dam) {
      doc.fontSize(10).fillColor("#555555");
      doc.text(`      Abuelo paterno: ${horseLine(horse.sire?.sire ?? null)}`);
      doc.text(`      Abuela paterna: ${horseLine(horse.sire?.dam ?? null)}`);
      doc.fontSize(11).fillColor("#111111");
    }
    doc.moveDown(0.3);
    doc.font("Helvetica-Bold").text("Madre: ", { continued: true });
    doc.font("Helvetica").text(horseLine(horse.dam));
    if (horse.dam?.sire || horse.dam?.dam) {
      doc.fontSize(10).fillColor("#555555");
      doc.text(`      Abuelo materno: ${horseLine(horse.dam?.sire ?? null)}`);
      doc.text(`      Abuela materna: ${horseLine(horse.dam?.dam ?? null)}`);
      doc.fontSize(11).fillColor("#111111");
    }

    doc.moveDown(1);

    // Palmarés / objetivos deportivos
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#111111");
    doc.text("Palmarés y objetivos deportivos", left, doc.y, { width: contentWidth });
    doc.moveDown(0.4);
    doc.fontSize(11).font("Helvetica").fillColor("#111111");

    if (horse.competitionTargets.length === 0) {
      doc.font("Helvetica-Oblique").fillColor("#777777");
      doc.text("Sin objetivos de competición registrados.");
      doc.font("Helvetica").fillColor("#111111");
    } else {
      for (const target of horse.competitionTargets) {
        const fecha = format(new Date(target.targetDate), "d MMM yyyy", { locale: es });
        const prio = target.priority ? ` · Prioridad ${target.priority}` : "";
        doc.text(`•  ${target.name} — ${fecha}${prio}`, { width: contentWidth });
      }
    }

    doc.moveDown(1.2);

    // QR a la ficha pública
    const qrSize = 110;
    const qrY = Math.min(doc.y, doc.page.height - doc.page.margins.bottom - qrSize - 14);
    doc.image(qrDataUrl, left, qrY, { width: qrSize, height: qrSize });
    doc.fontSize(9).font("Helvetica").fillColor("#777777");
    doc.text("Ficha pública del caballo", left + qrSize + 12, qrY + qrSize / 2 - 6, {
      width: contentWidth - qrSize - 12,
    });

    doc.end();
    const pdfBuffer = await pdfPromise;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="ficha-venta-${horse.name.replace(/\s+/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("FICHA VENTA PDF ERROR:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
