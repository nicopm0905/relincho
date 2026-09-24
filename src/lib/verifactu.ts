/**
 * Veri*Factu (RD 1007/2023 y Orden HAC/1177/2024): huella encadenada, QR y
 * XML de los registros de facturacion. Funciones puras, sin base de datos,
 * para poder probarlas contra los ejemplos oficiales de la AEAT (ver
 * tests/verifactu.test.ts).
 *
 * El envio a la AEAT no esta aqui: exige el certificado electronico de cada
 * obligado tributario. Los registros quedan generados y pendientes de envio.
 */
import { createHash } from "node:crypto";

const TZ = "Europe/Madrid";

/** Numero de factura tal y como se muestra y se declara: "2026-0007". */
export function invoiceNumSerie(series: string, number: number) {
  return `${series}-${String(number).padStart(4, "0")}`;
}

function madridParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Fecha en formato AEAT: dd-mm-aaaa, en hora de España. */
export function aeatDate(date: Date) {
  const p = madridParts(date);
  return `${p.day}-${p.month}-${p.year}`;
}

/**
 * Fecha, hora y huso de generacion del registro (ISO 8601 con desfase):
 * "2024-01-01T19:20:30+01:00". Se guarda tal cual: la huella se calcula sobre
 * este texto y tiene que poder recalcularse despues.
 */
export function aeatTimestamp(date: Date) {
  const p = madridParts(date);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMin = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${hh}:${mm}`;
}

/** Importes con punto decimal y dos decimales, igual en la huella y en el XML. */
export function aeatAmount(value: number) {
  return (Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2);
}

function sha256Upper(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex").toUpperCase();
}

export type InvoiceType = "F1" | "F2" | "R1" | "R2" | "R3" | "R4" | "R5";

export type AltaInput = {
  issuerNif: string;
  numSerie: string;
  issueDate: Date;
  invoiceType: InvoiceType;
  vatTotal: number;
  total: number;
  /** Huella del registro anterior de este emisor; vacia en el primero. */
  prevHash: string | null;
  /** Texto de `aeatTimestamp`, el mismo que se guarda. */
  generatedAt: string;
};

/** Huella de un registro de alta (especificacion tecnica de la AEAT). */
export function altaHash(r: AltaInput) {
  return sha256Upper(
    [
      `IDEmisorFactura=${r.issuerNif}`,
      `NumSerieFactura=${r.numSerie}`,
      `FechaExpedicionFactura=${aeatDate(r.issueDate)}`,
      `TipoFactura=${r.invoiceType}`,
      `CuotaTotal=${aeatAmount(r.vatTotal)}`,
      `ImporteTotal=${aeatAmount(r.total)}`,
      `Huella=${r.prevHash ?? ""}`,
      `FechaHoraHusoGenRegistro=${r.generatedAt}`,
    ].join("&"),
  );
}

export type AnulacionInput = {
  issuerNif: string;
  numSerie: string;
  issueDate: Date;
  prevHash: string | null;
  generatedAt: string;
};

/** Huella de un registro de anulacion. */
export function anulacionHash(r: AnulacionInput) {
  return sha256Upper(
    [
      `IDEmisorFacturaAnulada=${r.issuerNif}`,
      `NumSerieFacturaAnulada=${r.numSerie}`,
      `FechaExpedicionFacturaAnulada=${aeatDate(r.issueDate)}`,
      `Huella=${r.prevHash ?? ""}`,
      `FechaHoraHusoGenRegistro=${r.generatedAt}`,
    ].join("&"),
  );
}

const QR_BASE = {
  test: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
  prod: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
} as const;

/**
 * URL del codigo QR que la factura debe llevar impreso. Con `VERIFACTU_ENV`
 * distinto de "prod" apunta al entorno de pruebas de la AEAT.
 */
export function qrUrl(r: {
  issuerNif: string;
  numSerie: string;
  issueDate: Date;
  total: number;
  env?: "test" | "prod";
}) {
  const params = new URLSearchParams({
    nif: r.issuerNif,
    numserie: r.numSerie,
    fecha: aeatDate(r.issueDate),
    importe: aeatAmount(r.total),
  });
  return `${QR_BASE[r.env ?? "test"]}?${params.toString()}`;
}

function xml(value: string | number) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type PreviousRecord = {
  issuerNif: string;
  numSerie: string;
  issueDate: Date;
  hash: string;
} | null;

export type SoftwareInfo = {
  producerName: string;
  producerNif: string;
  systemName: string;
  systemId: string;
  version: string;
  installation: string;
};

function encadenamiento(prev: PreviousRecord) {
  if (!prev) return "<sum1:Encadenamiento><sum1:PrimerRegistro>S</sum1:PrimerRegistro></sum1:Encadenamiento>";
  return [
    "<sum1:Encadenamiento><sum1:RegistroAnterior>",
    `<sum1:IDEmisorFactura>${xml(prev.issuerNif)}</sum1:IDEmisorFactura>`,
    `<sum1:NumSerieFactura>${xml(prev.numSerie)}</sum1:NumSerieFactura>`,
    `<sum1:FechaExpedicionFactura>${aeatDate(prev.issueDate)}</sum1:FechaExpedicionFactura>`,
    `<sum1:Huella>${prev.hash}</sum1:Huella>`,
    "</sum1:RegistroAnterior></sum1:Encadenamiento>",
  ].join("");
}

function sistemaInformatico(s: SoftwareInfo) {
  return [
    "<sum1:SistemaInformatico>",
    `<sum1:NombreRazon>${xml(s.producerName)}</sum1:NombreRazon>`,
    `<sum1:NIF>${xml(s.producerNif)}</sum1:NIF>`,
    `<sum1:NombreSistemaInformatico>${xml(s.systemName)}</sum1:NombreSistemaInformatico>`,
    `<sum1:IdSistemaInformatico>${xml(s.systemId)}</sum1:IdSistemaInformatico>`,
    `<sum1:Version>${xml(s.version)}</sum1:Version>`,
    `<sum1:NumeroInstalacion>${xml(s.installation)}</sum1:NumeroInstalacion>`,
    "<sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>",
    "<sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT>",
    "<sum1:IndicadorMultiplesOT>S</sum1:IndicadorMultiplesOT>",
    "</sum1:SistemaInformatico>",
  ].join("");
}

export type AltaXmlInput = AltaInput & {
  issuerName: string;
  description: string;
  recipient: { name: string; nif: string } | null;
  /** Una linea por tipo impositivo. */
  breakdown: { vatRate: number; base: number; vat: number }[];
  hash: string;
  prev: PreviousRecord;
  software: SoftwareInfo;
  rectification?: {
    kind: "S" | "I";
    original: { numSerie: string; issueDate: Date };
    /** Solo en sustitucion: base y cuota de la factura que se sustituye. */
    replaced?: { base: number; vat: number };
  };
};

/**
 * `RegistroAlta` segun SuministroInformacion.xsd de la AEAT. Hay que validarlo
 * contra el XSD vigente antes de activar el envio.
 */
export function buildAltaXml(r: AltaXmlInput) {
  const rect = r.rectification;
  return [
    '<sum1:RegistroAlta xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">',
    "<sum1:IDVersion>1.0</sum1:IDVersion>",
    "<sum1:IDFactura>",
    `<sum1:IDEmisorFactura>${xml(r.issuerNif)}</sum1:IDEmisorFactura>`,
    `<sum1:NumSerieFactura>${xml(r.numSerie)}</sum1:NumSerieFactura>`,
    `<sum1:FechaExpedicionFactura>${aeatDate(r.issueDate)}</sum1:FechaExpedicionFactura>`,
    "</sum1:IDFactura>",
    `<sum1:NombreRazonEmisor>${xml(r.issuerName)}</sum1:NombreRazonEmisor>`,
    `<sum1:TipoFactura>${r.invoiceType}</sum1:TipoFactura>`,
    rect ? `<sum1:TipoRectificativa>${rect.kind}</sum1:TipoRectificativa>` : "",
    rect
      ? [
          "<sum1:FacturasRectificadas><sum1:IDFacturaRectificada>",
          `<sum1:IDEmisorFactura>${xml(r.issuerNif)}</sum1:IDEmisorFactura>`,
          `<sum1:NumSerieFactura>${xml(rect.original.numSerie)}</sum1:NumSerieFactura>`,
          `<sum1:FechaExpedicionFactura>${aeatDate(rect.original.issueDate)}</sum1:FechaExpedicionFactura>`,
          "</sum1:IDFacturaRectificada></sum1:FacturasRectificadas>",
        ].join("")
      : "",
    rect?.kind === "S" && rect.replaced
      ? [
          "<sum1:ImporteRectificacion>",
          `<sum1:BaseRectificada>${aeatAmount(rect.replaced.base)}</sum1:BaseRectificada>`,
          `<sum1:CuotaRectificada>${aeatAmount(rect.replaced.vat)}</sum1:CuotaRectificada>`,
          "</sum1:ImporteRectificacion>",
        ].join("")
      : "",
    `<sum1:DescripcionOperacion>${xml(r.description.slice(0, 500))}</sum1:DescripcionOperacion>`,
    r.recipient
      ? [
          "<sum1:Destinatarios><sum1:IDDestinatario>",
          `<sum1:NombreRazon>${xml(r.recipient.name)}</sum1:NombreRazon>`,
          `<sum1:NIF>${xml(r.recipient.nif)}</sum1:NIF>`,
          "</sum1:IDDestinatario></sum1:Destinatarios>",
        ].join("")
      : "",
    "<sum1:Desglose>",
    ...r.breakdown.map((b) =>
      [
        "<sum1:DetalleDesglose>",
        "<sum1:Impuesto>01</sum1:Impuesto>",
        "<sum1:ClaveRegimen>01</sum1:ClaveRegimen>",
        "<sum1:CalificacionOperacion>S1</sum1:CalificacionOperacion>",
        `<sum1:TipoImpositivo>${aeatAmount(b.vatRate)}</sum1:TipoImpositivo>`,
        `<sum1:BaseImponibleOimporteNoSujeto>${aeatAmount(b.base)}</sum1:BaseImponibleOimporteNoSujeto>`,
        `<sum1:CuotaRepercutida>${aeatAmount(b.vat)}</sum1:CuotaRepercutida>`,
        "</sum1:DetalleDesglose>",
      ].join(""),
    ),
    "</sum1:Desglose>",
    `<sum1:CuotaTotal>${aeatAmount(r.vatTotal)}</sum1:CuotaTotal>`,
    `<sum1:ImporteTotal>${aeatAmount(r.total)}</sum1:ImporteTotal>`,
    encadenamiento(r.prev),
    sistemaInformatico(r.software),
    `<sum1:FechaHoraHusoGenRegistro>${r.generatedAt}</sum1:FechaHoraHusoGenRegistro>`,
    "<sum1:TipoHuella>01</sum1:TipoHuella>",
    `<sum1:Huella>${r.hash}</sum1:Huella>`,
    "</sum1:RegistroAlta>",
  ].join("");
}

export type AnulacionXmlInput = AnulacionInput & {
  hash: string;
  prev: PreviousRecord;
  software: SoftwareInfo;
};

/** `RegistroAnulacion` segun el mismo XSD. */
export function buildAnulacionXml(r: AnulacionXmlInput) {
  return [
    '<sum1:RegistroAnulacion xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">',
    "<sum1:IDVersion>1.0</sum1:IDVersion>",
    "<sum1:IDFactura>",
    `<sum1:IDEmisorFacturaAnulada>${xml(r.issuerNif)}</sum1:IDEmisorFacturaAnulada>`,
    `<sum1:NumSerieFacturaAnulada>${xml(r.numSerie)}</sum1:NumSerieFacturaAnulada>`,
    `<sum1:FechaExpedicionFacturaAnulada>${aeatDate(r.issueDate)}</sum1:FechaExpedicionFacturaAnulada>`,
    "</sum1:IDFactura>",
    encadenamiento(r.prev),
    sistemaInformatico(r.software),
    `<sum1:FechaHoraHusoGenRegistro>${r.generatedAt}</sum1:FechaHoraHusoGenRegistro>`,
    "<sum1:TipoHuella>01</sum1:TipoHuella>",
    `<sum1:Huella>${r.hash}</sum1:Huella>`,
    "</sum1:RegistroAnulacion>",
  ].join("");
}
