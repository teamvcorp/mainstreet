"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { compressImage } from "@/lib/image-compress";

/**
 * Single-image uploader → POST /api/upload (Vercel Blob). Shows a preview and a
 * remove control. The server validates MIME/size; we only hint the picker.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  aspect = "aspect-[16/9]",
}: {
  value?: string;
  onChange: (url: string | undefined) => void;
  label?: string;
  aspect?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      // Shrink large photos in-browser so uploads don't hit the size limit.
      const optimized = await compressImage(file);
      const form = new FormData();
      form.append("file", optimized);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {label && <p className="mb-1.5 text-sm font-medium">{label}</p>}
      <div
        className={`relative ${aspect} w-full overflow-hidden rounded-lg border border-dashed border-border bg-muted/40`}
      >
        {value ? (
          <>
            <Image src={value} alt="" fill className="object-cover" sizes="400px" />
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-1 shadow hover:bg-background"
              aria-label="Remove image"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-6 animate-spin" />
            ) : (
              <>
                <ImagePlus className="size-6" />
                <span className="text-sm">Upload image</span>
              </>
            )}
          </button>
        )}
      </div>
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
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
