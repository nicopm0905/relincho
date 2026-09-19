/**
 * Vocabulario de documentos compartido por el servidor y la interfaz.
 *
 * Vive fuera de `server/services` a proposito: el gestor documental es un
 * componente de cliente y no puede importar nada que lleve `server-only`.
 *
 * Se guarda como texto en `Document.kind` porque el portal del propietario ya
 * leia `PHOTO`/`VIDEO`, pero a partir de aqui todo lo que entra esta en esta
 * lista cerrada.
 */
export const DOCUMENT_KINDS = [
  "PASSPORT",
  "PEDIGREE",
  "XRAY",
  "ANALYTICS",
  "VACCINATION",
  "CONTRACT",
  "SALE",
  "INSURANCE",
  "INVOICE",
  "PHOTO",
  "VIDEO",
  "OTHER",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const DEFAULT_DOCUMENT_KIND: DocumentKind = "OTHER";

/** Quien no elija tipo acaba en `OTHER` en vez de romper la validacion. */
export function normalizeDocumentKind(kind: string): DocumentKind {
  const upper = kind?.toUpperCase?.() ?? "";
  return (DOCUMENT_KINDS as readonly string[]).includes(upper)
    ? (upper as DocumentKind)
    : DEFAULT_DOCUMENT_KIND;
}

/** Los tipos que salen en el filtro del portal del propietario. */
export const MEDIA_DOCUMENT_KINDS = ["PHOTO", "VIDEO"];

/**
 * Una clave solo vale si vive dentro de la carpeta de documentos de esa
 * yeguada. Sin esto, alguien podria adjuntar a su ficha el fichero de otra.
 */
export function ownsDocumentKey(tenantId: string, key: string): boolean {
  return key.startsWith(`${tenantId}/documents/`) && !key.includes("..");
}
