import "server-only";

import {
  getPresignedDownloadUrl,
  getPresignedUploadUrl,
  isStorageConfigured,
} from "@/server/services/storage/r2";

/**
 * Fotos de incidencia (E5): privadas. Se suben con una URL firmada a la
 * carpeta del caballo y se leen con otra que caduca, nunca con una pública.
 * Sin bucket (desarrollo y tests) se usa el almacén local de `/api/upload`,
 * que en producción responde 404.
 */
export async function signIncidentPhotoUpload(key: string, contentType: string): Promise<string | null> {
  if (isStorageConfigured()) return getPresignedUploadUrl(key, contentType);
  if (process.env.NODE_ENV === "production") return null;
  return `/api/upload?key=${encodeURIComponent(key)}`;
}

export async function incidentPhotoReadUrl(key: string): Promise<string> {
  if (isStorageConfigured()) return getPresignedDownloadUrl(key, 600);
  return `/uploads/${key}`;
}
