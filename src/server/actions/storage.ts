"use server";

import { auth } from "@/server/auth";
import { getPresignedUploadUrl, getPublicUrl } from "@/server/services/storage/r2";
import { z } from "zod";
import { randomUUID } from "crypto";

const schema = z.object({
  tenantId: z.string().uuid(),
  filename: z.string(),
  contentType: z.string(),
  folder: z.string().default("uploads"),
});

export async function getUploadUrlAction(input: z.infer<typeof schema>) {
  const session = await auth();
  if (!session?.user) return { error: "No autorizado" };

  const { tenantId, filename, contentType, folder } = schema.parse(input);
  const ext = filename.split(".").pop() ?? "bin";
  const key = `${tenantId}/${folder}/${randomUUID()}.${ext}`;

  if (!process.env.R2_ACCOUNT_ID) {
    return {
      uploadUrl: `/api/upload?key=${key}`,
      publicUrl: `/uploads/${key}`,
      key
    };
  }

  const uploadUrl = await getPresignedUploadUrl(key, contentType);
  const publicUrl = getPublicUrl(key);

  return { uploadUrl, publicUrl, key };
}
