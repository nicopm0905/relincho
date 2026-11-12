import { compressImage } from "@/lib/compress-image";
import { INLINE_PHOTO_ATTEMPTS, isInlinePhoto } from "@/lib/inline-photo";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Reduce la foto en el navegador hasta que cabe como foto en línea
 * (`src/lib/inline-photo.ts`). Devuelve `null` si no se puede: formato que el
 * navegador no decodifica (p. ej. HEIC) o una imagen que no se deja comprimir.
 */
export async function compressToInline(file: File): Promise<string | null> {
  for (const { maxSide, quality } of INLINE_PHOTO_ATTEMPTS) {
    const url = await blobToDataUrl(await compressImage(file, quality, maxSide));
    if (isInlinePhoto(url)) return url;
  }
  return null;
}
