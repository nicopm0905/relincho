import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID!}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET ?? "Relincho-files";
const PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

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

export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export function keyFromUrl(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, "");
}
