"use client";

import { useRef, useState, useCallback } from "react";
import { insforge } from "@/lib/insforge";

async function compressImage(
  file: File,
  maxPx = 1200,
  quality = 0.82,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Compression failed")),
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Load failed"));
    };
    img.src = url;
  });
}

type ImageUploadProps = {
  bucket?: string;
  folder?: string;
  value?: string | null;
  onChange: (url: string) => void;
  className?: string;
};

export function ImageUpload({
  bucket = "events",
  folder = "uploads",
  value,
  onChange,
  className = "",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setUploading(true);

    try {
      const compressed = await compressImage(file);
      const key = `${folder}/${Date.now()}-${file.name.replace(/\.[^.]+$/, "")}.webp`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadResult = await (insforge.storage.from(bucket) as any).upload(
        key,
        compressed,
        { upsert: true },
      );

      const uploadError = (uploadResult as { error?: { message?: string } })
        .error;
      if (uploadError) {
        setError(uploadError.message ?? "Upload failed.");
        return;
      }

      const publicUrlResult = insforge.storage.from(bucket).getPublicUrl(key);
      const publicUrl =
        typeof publicUrlResult === "string"
          ? publicUrlResult
          : (publicUrlResult as { data: { publicUrl: string } }).data.publicUrl;
      onChange(publicUrl);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!uploading) setDragging(true);
    },
    [uploading],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (uploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [uploading],
  );

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`border-sand-300 relative flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed transition-colors ${
          dragging
            ? "border-petroleum-500 bg-petroleum-50"
            : uploading
              ? "opacity-60"
              : "hover:border-petroleum-400 hover:bg-sand-50"
        }`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-4 py-6 text-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              className="text-petroleum-300"
            >
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="8.5"
                cy="8.5"
                r="1.5"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M21 15l-5-5L5 21"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-petroleum-400 text-xs">
              {uploading
                ? "Compressing & uploading…"
                : dragging
                  ? "Drop to upload"
                  : "Click or drag an image here"}
            </span>
            <span className="text-petroleum-300 text-xs">
              Compressed to WebP automatically
            </span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="border-petroleum-700 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        )}

        {value && !uploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="text-petroleum-500 absolute top-2 right-2 rounded-full bg-white/80 p-1 shadow transition-colors hover:bg-white hover:text-red-500"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
