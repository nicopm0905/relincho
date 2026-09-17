/* eslint-disable @typescript-eslint/no-require-imports -- script Node autónomo, no forma parte del bundle */
/**
 * Genera el flyer A5 de Relincho, listo para imprenta.
 *
 * Uso:   node public/flyer/generar-flyer.js
 * Salida: public/flyer/flyer-relincho-a5.pdf  (+ public/flyer/qr.png)
 *
 * Requiere pdfkit y qrcode (ya están en package.json del proyecto).
 * Antes de imprimir, edita EVENTO si quieres la pastilla con el nombre
 * del evento de mañana.
 */
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// ─── Configuración editable ────────────────────────────────────────────────
const URL_WEB = process.env.FLYER_URL || "https://relincho.vercel.app";
const URL_VISIBLE = "relincho.vercel.app";
const EVENTO = "VIERNES 18 · PARADA HÍPICA · 19:00"; // Vacío = sin pastilla.
const EMAIL = "hola@relincho.es";
// ───────────────────────────────────────────────────────────────────────────

// Paleta de marca (src/app/globals.css)
const C = {
  cream: "#f9f9f6",
  ink: "#111111",
  olive: "#a3b846",
  oliveInk: "#55651c",
  muted: "#5f5f5c",
  white: "#ffffff",
};

// A5 vertical en puntos (72 dpi lógicos). A 300 dpi reales = 1240 × 1748 px.
const W = 419.53;
const H = 595.28;

const OUT_DIR = __dirname;

function pickFont(candidates, fallback) {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignorar */
    }
  }
  return fallback;
}

const F = {
  display: pickFont(
    [
      "C:/Windows/Fonts/georgiab.ttf",
      "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
      "/usr/share/fonts/truetype/msttcorefonts/Georgia_Bold.ttf",
    ],
    "Helvetica-Bold",
  ),
  serifItalic: pickFont(
    [
      "C:/Windows/Fonts/georgiai.ttf",
      "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
    ],
    "Times-Italic",
  ),
  sans: pickFont(["C:/Windows/Fonts/segoeui.ttf"], "Helvetica"),
  sansBold: pickFont(
    [
      "C:/Windows/Fonts/segoeuib.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    "Helvetica-Bold",
  ),
};

/** Herradura (arco con extremos redondeados, abierta hacia arriba). */
function horseshoe(doc, cx, cy, r, lw, color, opacity) {
  doc.save();
  doc.opacity(opacity);
  doc.lineWidth(lw).lineCap("round").strokeColor(color);
  // En coordenadas PDF el eje Y crece hacia abajo: el arco de 0.07π a 0.93π
  // pasa por el punto inferior y deja los extremos abiertos hacia arriba.
  doc.arc(cx, cy, r, Math.PI * 0.07, Math.PI * 0.93, false).stroke();
  doc.restore();
}

async function main() {
  // 1) QR en PNG (más robusto para imprenta que SVG)
  const qrPng = await QRCode.toBuffer(URL_WEB, {
    width: 900,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#111111ff", light: "#ffffffff" },
  });
  fs.writeFileSync(path.join(OUT_DIR, "qr.png"), qrPng);

  // 2) PDF
  const doc = new PDFDocument({
    size: [W, H],
    margin: 0,
    info: {
      Title: "Flyer Relincho — Del corral a la nube",
      Author: "Relincho",
      Subject: "Promoción evento ecuestre Jerez",
    },
  });
  doc.pipe(fs.createWriteStream(path.join(OUT_DIR, "flyer-relincho-a5.pdf")));

  // Fondo crema
  doc.rect(0, 0, W, H).fill(C.cream);

  // Cabecera oliva
  const HEADER_H = 212;
  doc.rect(0, 0, W, HEADER_H).fill(C.olive);

  // Herraduras
  horseshoe(doc, 330, 356, 116, 24, C.olive, 0.08); // marca de agua zona crema
  horseshoe(doc, 354, 104, 42, 11, C.white, 0.9); // cabecera

  // Etiqueta superior
  doc
    .opacity(0.9)
    .font(F.sansBold)
    .fontSize(8.5)
    .fillColor(C.white)
    .text("JEREZ DE LA FRONTERA · GESTIÓN EQUINA", 36, 40, {
      characterSpacing: 2.6,
      lineGap: 0,
    });
  doc.opacity(1);

  // Eslogan bicolor
  doc
    .font(F.display)
    .fontSize(41)
    .fillColor(C.ink)
    .text("Del corral", 34, 76, { lineGap: 0 });
  doc
    .font(F.display)
    .fontSize(41)
    .fillColor(C.white)
    .text("a la nube.", 34, 122, { lineGap: 0 });

  // Subtítulo
  doc
    .opacity(0.95)
    .font(F.sans)
    .fontSize(10.5)
    .fillColor(C.white)
    .text(
      "Sanidad, reproducción, pupilaje y facturación. Toda tu yeguada en un solo lugar.",
      36,
      172,
      { width: 300, lineGap: 2 },
    );
  doc.opacity(1);

  // Pastilla de evento (opcional)
  let yy = 240;
  if (EVENTO) {
    const label = EVENTO.toUpperCase();
    doc.font(F.sansBold).fontSize(8.5);
    const pw = doc.widthOfString(label, { characterSpacing: 1.5 }) + 30;
    const px = (W - pw) / 2;
    doc.roundedRect(px, 224, pw, 22, 11).fill(C.white);
    doc.roundedRect(px, 224, pw, 22, 11).lineWidth(1).stroke(C.olive);
    doc
      .font(F.sansBold)
      .fontSize(8.5)
      .fillColor(C.ink)
      .text(label, px, 231, { width: pw, align: "center", characterSpacing: 1.5 });
    yy = 262;
  }

  // Sección de características
  const items = [
    ["Sanidad y alertas", "Vacunas, tratamientos y recordatorios"],
    ["Reproducción", "Celos, cubriciones y gestaciones"],
    ["Pupilaje y dietas", "Boxes, estancias y tarifas de clientes"],
    ["Factura Veri*Factu", "Facturas legales adaptadas a la AEAT"],
  ];

  doc
    .font(F.sansBold)
    .fontSize(8)
    .fillColor(C.oliveInk)
    .text("QUÉ HACE RELINCHO", 36, yy, { characterSpacing: 3, lineGap: 0 });
  yy += 26;

  items.forEach(([title, sub], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 36 + col * 188;
    const y = yy + row * 54;

    doc.circle(x + 9, y + 9, 9).fill(C.olive);
    doc.save();
    doc.lineWidth(2).lineCap("round").lineJoin("round").strokeColor(C.white);
    doc.moveTo(x + 4.8, y + 9.4).lineTo(x + 8, y + 12.6).lineTo(x + 13.4, y + 5.6).stroke();
    doc.restore();

    doc
      .font(F.sansBold)
      .fontSize(11.5)
      .fillColor(C.ink)
      .text(title, x + 26, y + 1, { lineGap: 0 });
    doc
      .font(F.sans)
      .fontSize(8.5)
      .fillColor(C.muted)
      .text(sub, x + 26, y + 17, { width: 152, lineGap: 0 });
  });

  // Separador
  const dividerY = yy + 54 + 62;
  doc.save();
  doc.opacity(0.35).lineWidth(1).strokeColor(C.olive);
  doc.moveTo(36, dividerY).lineTo(W - 36, dividerY).stroke();
  doc.restore();

  // Frase de cercanía
  doc
    .font(F.serifItalic)
    .fontSize(11)
    .fillColor(C.oliveInk)
    .text("Creada por dos jerezanos que crecieron entre caballos.", 36, dividerY + 16, {
      lineGap: 0,
    });

  // Tarjeta oscura con QR
  const CARD = { x: 28, y: 448, w: W - 56, h: 118 };
  doc.roundedRect(CARD.x, CARD.y, CARD.w, CARD.h, 16).fill(C.ink);

  const QR = { x: CARD.x + 18, y: CARD.y + 18, s: 82 };
  doc.roundedRect(QR.x - 5, QR.y - 5, QR.s + 10, QR.s + 10, 10).fill(C.white);
  doc.image(qrPng, QR.x, QR.y, { width: QR.s, height: QR.s });

  const tx = QR.x + QR.s + 24;
  doc
    .font(F.sansBold)
    .fontSize(8)
    .fillColor(C.olive)
    .text("ESCANEA Y PRUÉBALO GRATIS", tx, CARD.y + 24, {
      characterSpacing: 2,
      lineGap: 0,
    });
  doc
    .font(F.sansBold)
    .fontSize(17)
    .fillColor(C.white)
    .text(URL_VISIBLE, tx, CARD.y + 44, { lineGap: 0 });
  doc
    .opacity(0.75)
    .font(F.sans)
    .fontSize(9)
    .fillColor(C.white)
    .text("Sin tarjeta · Sin compromiso · En español", tx, CARD.y + 76, { lineGap: 0 });
  doc.opacity(1);

  // Pie
  doc
    .opacity(0.8)
    .font(F.sans)
    .fontSize(7.5)
    .fillColor(C.muted)
    .text(`Relincho · ${EMAIL} · Hecho en Jerez de la Frontera`, 0, H - 22, {
      width: W,
      align: "center",
      characterSpacing: 1,
    });
  doc.opacity(1);

  doc.end();

  console.log("✔ Flyer generado:");
  console.log("  - " + path.join("public", "flyer", "flyer-relincho-a5.pdf"));
  console.log("  - " + path.join("public", "flyer", "qr.png"));
  console.log("  QR → " + URL_WEB);
  if (!EVENTO) {
    console.log('  Tip: edita EVENTO en generar-flyer.js para añadir la pastilla del evento.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
