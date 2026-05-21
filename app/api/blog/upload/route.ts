import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@insforge/sdk";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string | null) ?? "covers";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  // Compress and convert to WebP server-side
  const webpBuffer = await sharp(inputBuffer)
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const adminClient = createClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
    anonKey: process.env.INSFORGE_SERVICE_KEY!,
  });

  const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]/gi, "-");
  const key = `${folder}/${Date.now()}-${baseName}.webp`;
  const blob = new Blob([new Uint8Array(webpBuffer)], { type: "image/webp" });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadResult = await (adminClient.storage.from("blog") as any).upload(
    key,
    blob,
    { upsert: true, contentType: "image/webp" },
  );

  const uploadError = (uploadResult as { error?: { message?: string } }).error;
  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message ?? "Upload failed" },
      { status: 500 },
    );
  }

  const publicUrlResult = adminClient.storage.from("blog").getPublicUrl(key);
  const publicUrl =
    typeof publicUrlResult === "string"
      ? publicUrlResult
      : (publicUrlResult as { data: { publicUrl: string } }).data.publicUrl;

  return NextResponse.json({ url: publicUrl });
}
