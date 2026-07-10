import { put } from "@vercel/blob";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const LABEL_TYPES = ["application/pdf", ...IMAGE_TYPES];
const IMAGE_MAX = 5 * 1024 * 1024; // 5 MB
const LABEL_MAX = 10 * 1024 * 1024; // 10 MB (shipping labels / PDFs)

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function extFor(type: string): string {
  if (type === "application/pdf") return "pdf";
  return type.split("/")[1] ?? "bin";
}

/** Shared put with friendly mapping of the common "store missing" setup error. */
async function putFile(file: File, key: string): Promise<string> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_NOT_CONFIGURED");
  try {
    const blob = await put(key, file, {
      access: "public",
      token,
      contentType: file.type,
      addRandomSuffix: false,
    });
    return blob.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/store does not exist|not.*found|access denied|forbidden|unauthorized/i.test(msg)) {
      throw new Error("BLOB_STORE_MISSING");
    }
    throw err;
  }
}

/** Validate (server-side) then upload an image to Vercel Blob. */
export async function uploadImage(file: File, prefix: string): Promise<string> {
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("UNSUPPORTED_TYPE");
  if (file.size === 0) throw new Error("EMPTY_FILE");
  if (file.size > IMAGE_MAX) throw new Error("FILE_TOO_LARGE");
  return putFile(file, `${prefix}/${crypto.randomUUID()}.${extFor(file.type)}`);
}

/** Upload a shipping label (PDF or image), used by the fulfillment screen. */
export async function uploadLabel(file: File, prefix: string): Promise<string> {
  if (!LABEL_TYPES.includes(file.type)) throw new Error("UNSUPPORTED_TYPE");
  if (file.size === 0) throw new Error("EMPTY_FILE");
  if (file.size > LABEL_MAX) throw new Error("FILE_TOO_LARGE");
  return putFile(file, `${prefix}/${crypto.randomUUID()}.${extFor(file.type)}`);
}
