/**
 * Reduce una foto del móvil antes de subirla (E5: "comprimirlas en el
 * cliente"). Una foto de 12 MP pasa a JPEG de 1600 px de lado como mucho,
 * unos 300 KB, que se sube bien con poca cobertura en la cuadra. Si el
 * navegador no puede decodificarla, se sube la original.
 */
export const MAX_PHOTO_SIDE = 1600;

/** Medidas finales que conservan la proporción sin pasar de `max` de lado. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export async function compressImage(file: File, quality = 0.8, maxSide = MAX_PHOTO_SIDE): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}
