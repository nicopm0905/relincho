import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID ?? "unset"}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.R2_BUCKET ?? "relincho-files";
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

/**
 * Sin bucket configurado no se puede firmar nada. Las server actions lo
 * consultan para dar un error claro en vez de dejar que falle la subida del
 * navegador con un 500 opaco.
 */
export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn });
}

/**
 * URL de descarga temporal. Los documentos de una yeguada son pasaportes,
 * radiografias y analiticas: nunca se sirven desde una URL publica que se pueda
 * reenviar y quede viva para siempre.
 */
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 300,
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn });
}

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function keyFromUrl(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, "");
}
