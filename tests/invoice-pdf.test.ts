import { test } from "node:test";
import assert from "node:assert/strict";
import { renderInvoicePdf, type InvoiceForPdf } from "../src/server/services/billing/invoice-pdf";

function fake(status: "DRAFT" | "ISSUED", lineCount: number): InvoiceForPdf {
  const d = (n: number) => n as unknown as InvoiceForPdf["total"];
  return {
    status,
    series: "2026",
    number: status === "DRAFT" ? null : 7,
    issueDate: new Date("2026-09-25T10:00:00Z"),
    dueDate: new Date("2026-10-25T10:00:00Z"),
    invoiceType: "F1",
    rectifiesId: null,
    rectifies: null,
    rectificationKind: null,
    rectificationReason: null,
    verifactuQrUrl: status === "DRAFT" ? null : "https://example.test/qr?nif=1",
    subtotal: d(lineCount * 10),
    vatTotal: d(lineCount * 2.1),
    total: d(lineCount * 12.1),
    tenant: { name: "Yeguada Test", fiscalName: null, nif: "B12345674", address: "Calle 1", postalCode: "11400", city: "Jerez", province: "Cádiz" },
    client: { name: "Cliente", nif: "12345678Z", address: "Calle 2" },
    lines: Array.from({ length: lineCount }, (_, i) => ({
      id: String(i),
      description: `Pupilaje caballo ${i}`,
      quantity: d(1),
      unitPrice: d(10),
      vatRate: d(21),
    })),
  } as unknown as InvoiceForPdf;
}

const pages = (buf: Buffer) => (buf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;

test("una factura corta cabe en una pagina y es un PDF", async () => {
  const { buffer, label } = await renderInvoicePdf(fake("ISSUED", 3));
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pages(buffer), 1);
  assert.equal(label, "2026-0007");
});

test("una factura de 60 lineas pagina en vez de salirse de la hoja", async () => {
  const { buffer } = await renderInvoicePdf(fake("ISSUED", 60));
  assert.ok(pages(buffer) >= 2);
});

test("un borrador se renderiza (con marca de agua) sin numero", async () => {
  const { buffer, label } = await renderInvoicePdf(fake("DRAFT", 2));
  assert.equal(label, "Borrador");
  assert.equal(pages(buffer), 1);
});
