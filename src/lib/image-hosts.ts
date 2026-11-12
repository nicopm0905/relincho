/**
 * Dominios desde los que `next/image` puede cargar fotos (next.config.ts).
 * Las fotos de caballo se guardan como `R2_PUBLIC_URL/clave`, así que ese
 * dominio tiene que estar permitido o la foto subida no se ve. Motor puro.
 */
export interface ImageRemotePattern {
  protocol: "https";
  hostname: string;
}

const R2_ENDPOINT: ImageRemotePattern = { protocol: "https", hostname: "*.r2.cloudflarestorage.com" };

export function imageRemotePatterns(publicUrl: string | undefined): ImageRemotePattern[] {
  if (!publicUrl) return [R2_ENDPOINT];
  try {
    const url = new URL(publicUrl);
    if (url.protocol !== "https:") return [R2_ENDPOINT];
    return [R2_ENDPOINT, { protocol: "https", hostname: url.hostname }];
  } catch {
    return [R2_ENDPOINT];
  }
}
