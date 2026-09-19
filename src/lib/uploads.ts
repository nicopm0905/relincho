/**
 * Reglas de subida compartidas por las server actions y el modulo de
 * documentos. Todo lo que no este aqui no se firma.
 *
 * La extension se deduce del tipo MIME, nunca del nombre del fichero: el
 * nombre lo elige el navegador del cliente y no es de fiar.
 */

export type UploadKind = "image" | "document";

interface UploadRule {
  maxBytes: number;
  mimes: Record<string, string>;
}

export const UPLOAD_RULES: Record<UploadKind, UploadRule> = {
  image: {
    maxBytes: 8 * 1024 * 1024,
    mimes: {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
    },
  },
  document: {
    maxBytes: 25 * 1024 * 1024,
    mimes: {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      // Sin `text/html` ni `image/svg+xml`: son documentos que el navegador
      // ejecutaria si se sirvieran desde el mismo dominio.
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "text/plain": "txt",
      "text/csv": "csv",
    },
  },
};

/** Carpetas validas dentro del prefijo de cada yeguada. */
export const UPLOAD_FOLDERS = ["horses", "documents"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export type UploadCheck =
  | { ok: true; ext: string; maxBytes: number }
  | { ok: false; reason: "type" | "size"; maxBytes: number };

export function maxBytesFor(kind: UploadKind): number {
  return UPLOAD_RULES[kind].maxBytes;
}

export function extensionForMime(kind: UploadKind, mime: string): string | null {
  return UPLOAD_RULES[kind].mimes[mime.trim().toLowerCase()] ?? null;
}

export function isAllowedUpload(
  kind: UploadKind,
  mime: string,
  sizeBytes: number,
): UploadCheck {
  const maxBytes = maxBytesFor(kind);
  const ext = extensionForMime(kind, mime);
  if (!ext) return { ok: false, reason: "type", maxBytes };
  // El tamano lo declara el cliente, asi que es orientativo; el limite duro lo
  // pone el bucket. Aun asi evita que alguien intente subir un video de 2 GB.
  if (sizeBytes > maxBytes) return { ok: false, reason: "size", maxBytes };
  return { ok: true, ext, maxBytes };
}

/** Limpia un fragmento de clave: sin barras, sin puntos, sin sorpresas. */
export function safeKeySegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/\.{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 80);
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
