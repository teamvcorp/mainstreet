import { put } from "@vercel/blob";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Validate (server-side) then upload an image to Vercel Blob. Throws typed
 * error codes the route handler maps to HTTP statuses. MIME + size are checked
 * here — never trust the client's declared type alone, but this is the enforced
 * gate before anything is written to storage.
 */
export async function uploadImage(file: File, prefix: string): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error("UNSUPPORTED_TYPE");
  if (file.size === 0) throw new Error("EMPTY_FILE");
  if (file.size > MAX_BYTES) throw new Error("FILE_TOO_LARGE");

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_NOT_CONFIGURED");

  const ext = file.type.split("/")[1] ?? "bin";
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const blob = await put(key, file, {
    access: "public",
    token,
    contentType: file.type,
    addRandomSuffix: false,
  });
  return blob.url;
}
