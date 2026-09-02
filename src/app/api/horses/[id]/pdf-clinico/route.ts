import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { prisma } from "@/server/db/prisma";
import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const dynamic = "force-dynamic";

const healthTypeLabels: Record<string, string> = {
  VACCINE: "Vacuna",
  DEWORMING: "Desparasitación",
  DENTAL: "Cuidado Dental",
  FARRIER: "Herrador",
  VET_CHECKUP: "Revisión Veterinaria",
  TREATMENT: "Tratamiento",
  INJURY: "Lesión",
  OTHER: "Otro",
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

    // Verificar acceso al caballo y obtener datos
    const horse = await prisma.horse.findUnique({
      where: { id },
      include: {
        tenant: true,
        healthEvents: {
          orderBy: { date: "desc" }
        }
      }
    });

    if (!horse) {
      return NextResponse.json({ error: "Caballo no encontrado" }, { status: 404 });
    }

    // Verificar membresía
    const membership = await prisma.membership.findUnique({
      where: {
        userId_tenantId: { userId: session.user.id, tenantId: horse.tenantId },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "No tienes acceso a este caballo" }, { status: 403 });
    }

    // Generar PDF
    const stream = new ReadableStream({
      start(controller) {
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        
        doc.on('data', chunk => controller.enqueue(chunk));
        doc.on('end', () => controller.close());

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('Historial Clínico', { align: 'center' });
        doc.moveDown(0.5);
        
        // Información del caballo
        doc.fontSize(16).font('Helvetica-Bold').text(`Caballo: ${horse.name}`);
        doc.fontSize(12).font('Helvetica').text(`UELN: ${horse.uelnCode || 'N/A'}`);
        doc.text(`Microchip: ${horse.microchip || 'N/A'}`);
        doc.text(`Capa: ${horse.coat || 'N/A'}`);
        if (horse.birthDate) {
          doc.text(`Fecha de Nacimiento: ${format(new Date(horse.birthDate), 'dd/MM/yyyy')}`);
        }
        
        doc.moveDown(1);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown(1);

        // Lista de eventos
        doc.fontSize(18).font('Helvetica-Bold').text('Registros Sanitarios');
        doc.moveDown(1);

        if (horse.healthEvents.length === 0) {
          doc.fontSize(12).font('Helvetica-Oblique').text('No hay registros sanitarios para este caballo.');
        } else {
          horse.healthEvents.forEach((ev) => {
            // Box/fondo opcional para separar visualmente
            const startY = doc.y;
            
            doc.fontSize(14).font('Helvetica-Bold').text(format(new Date(ev.date), "d MMM yyyy", { locale: es }));
            doc.fontSize(12).font('Helvetica-Bold').text(`${healthTypeLabels[ev.type] || ev.type}: ${ev.name}`);
            
            if (ev.notes) {
              doc.fontSize(11).font('Helvetica').text(`Notas: ${ev.notes}`);
            }
            if (ev.cost) {
              doc.fontSize(11).font('Helvetica').text(`Coste: ${ev.cost}€`);
            }
            if (ev.nextDueDate) {
              doc.fontSize(11).font('Helvetica-Bold').fillColor('#d97706').text(`Próxima revisión: ${format(new Date(ev.nextDueDate), "d MMM yyyy", { locale: es })}`);
              doc.fillColor('black'); // Reset color
            }

            doc.moveDown(1);
            
            // Comprobar si hay que hacer salto de página
            if (doc.y > 750) {
              doc.addPage();
            }
          });
        }

        // Footer
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.fontSize(10).font('Helvetica').text(
            `Generado por Relincho (${horse.tenant.name}) - ${format(new Date(), 'dd/MM/yyyy')}`,
            50,
            doc.page.height - 50,
            { align: 'center', width: doc.page.width - 100 }
          );
        }

        doc.end();
      }
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="historial_clinico_${horse.name.replace(/\s+/g, "_")}.pdf"`,
      },
    });

  } catch (error) {
    console.error("CLINICO PDF ERROR:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
