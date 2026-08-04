import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { getAdminClient } from "@/lib/insforge-admin";
import { requireApiRole, toAuthErrorResponse } from "@/lib/auth-guard";

/**
 * POST /api/blog/upload  (multipart: file, folder?)
 *
 * Compresses an image to WebP and stores it in the public `blog` bucket.
 *
 * Staff only. This was open to the internet: anyone could push arbitrary files
 * into public storage and force `sharp` to decode them, which is both a storage
 * cost and a CPU exhaustion vector. Size and MIME type are now checked before
 * any decoding happens.
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const ALLOWED_FOLDERS = new Set(["covers", "content"]);

export async function POST(request: NextRequest) {
  try {
    await requireApiRole(request);
  } catch (err) {
    const response = toAuthErrorResponse(err);
    if (response) return response;
    throw err;
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const requestedFolder = (formData.get("folder") as string | null) ?? "covers";
  const folder = ALLOWED_FOLDERS.has(requestedFolder)
    ? requestedFolder
    : "covers";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is larger than 8 MB" },
      { status: 413 },
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type || "unknown"}` },
      { status: 415 },
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let webpBuffer: Buffer;
  try {
    webpBuffer = await sharp(inputBuffer)
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "The file could not be processed as an image" },
      { status: 400 },
    );
  }

  const baseName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .slice(0, 80);
  const key = `${folder}/${Date.now()}-${baseName}.webp`;
  const blob = new Blob([new Uint8Array(webpBuffer)], { type: "image/webp" });

  const storage = getAdminClient().storage.from("blog");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadResult = await (storage as any).upload(key, blob, {
    upsert: true,
    contentType: "image/webp",
  });

  const uploadError = (uploadResult as { error?: { message?: string } }).error;
  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message ?? "Upload failed" },
      { status: 500 },
    );
  }

  const publicUrlResult = storage.getPublicUrl(key);
  const publicUrl =
    typeof publicUrlResult === "string"
      ? publicUrlResult
      : (publicUrlResult as { data: { publicUrl: string } }).data.publicUrl;

  return NextResponse.json({ url: publicUrl });
}
