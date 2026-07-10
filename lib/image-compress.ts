"use client";

/**
 * Downscale + re-encode an image in the browser BEFORE upload, so large photos
 * (phone cameras easily exceed 5 MB) succeed gracefully instead of being
 * rejected. Non-images and GIFs (animation) pass through untouched.
 */
const MAX_DIM = 1600; // longest edge
const TARGET_BYTES = 4.5 * 1024 * 1024; // stay under the 5 MB server limit

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  try {
    const img = await loadImage(await readAsDataURL(file));
    let { width, height } = img;
    const longest = Math.max(width, height);
    const needsResize = longest > MAX_DIM;

    // Already small enough and reasonably sized — leave it alone.
    if (!needsResize && file.size <= TARGET_BYTES) return file;

    if (needsResize) {
      const scale = MAX_DIM / longest;
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.82;
    let blob = await toBlob(canvas, "image/webp", quality);
    while (blob && blob.size > TARGET_BYTES && quality > 0.4) {
      quality -= 0.12;
      blob = await toBlob(canvas, "image/webp", quality);
    }
    if (!blob) return file;

    const name = `${file.name.replace(/\.\w+$/, "")}.webp`;
    return new File([blob], name, { type: "image/webp" });
  } catch {
    // If anything goes wrong, fall back to the original (server still validates).
    return file;
  }
}
