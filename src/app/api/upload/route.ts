import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function PUT(req: NextRequest) {
  try {
    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "Missing key" }, { status: 400 });

    const buffer = await req.arrayBuffer();
    
    // key comes as tenantId/folder/uuid.ext
    // Clean key to prevent path traversal
    const safeKey = key.replace(/\.\./g, "");
    
    const destPath = path.join(process.cwd(), "public", "uploads", safeKey);
    
    // Ensure dir exists
    const dir = path.dirname(destPath);
    await mkdir(dir, { recursive: true });
    
    await writeFile(destPath, Buffer.from(buffer));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Local upload error:", error);
    return NextResponse.json({ error: "Failed to save file locally" }, { status: 500 });
  }
}
