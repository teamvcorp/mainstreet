# Vercel Blob — image storage

- Client: `lib/blob.ts` → `uploadImage(file, prefix)`. Validates MIME
  (jpeg/png/webp/gif/avif) + size (≤5 MB) **server-side** before writing. Keys:
  `u/<userId>/<uuid>.<ext>`, `access: "public"`.
- Route: `POST /api/upload` (auth required, rate-limited) — multipart `file` field,
  returns `{ url }`. Errors map to 415 (type), 413 (size), 501 (not configured).
- UI: `components/seller/ImageUpload.tsx` (single image w/ preview + remove);
  `ProductForm` composes it into a multi-photo gallery (≤8).
- `next.config.ts` `images.remotePatterns` allows `*.public.blob.vercel-storage.com`.

## Env
`BLOB_READ_WRITE_TOKEN` (server-only). Get it from the Vercel dashboard → Storage →
Blob. Without it, uploads return 501.
