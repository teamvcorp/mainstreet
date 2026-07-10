# Next.js 16 — differences that bite (this project runs 16.2.10)

Source: `node_modules/next/dist/docs`. This is a real major-version jump from the
14/15 mental model. Honor these when writing code.

## Middleware is renamed to "Proxy"
- File is **`proxy.ts`** (root), export **`proxy`** (not `middleware`).
- Runs **Node runtime only** — edge is not supported in proxy.
- Config flag `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`.

## Async request APIs are Promise-only (no sync shim)
`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` must be `await`ed.
```tsx
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
}
// Route handler:
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/products/[id]'>) {
  const { id } = await ctx.params;
}
```
Client components read them with React's `use()`.

## Typed helpers (globally available, no import)
`PageProps<'/town/[slug]'>`, `LayoutProps<...>`, `RouteContext<'/api/x/[id]'>`.

## Caching / Cache Components
- `fetch` is NOT cached by default. Opt in with `'use cache'` + `cacheLife`/`cacheTag`
  from `next/cache` (both now stable — drop `unstable_` prefix).
- **`revalidateTag(tag, profile)` now REQUIRES a 2nd arg** (a cacheLife profile).
- New `updateTag(tag)` (Server Actions only, immediate) and `refresh()`.
- `cacheComponents: true` in next.config enables PPR globally. **We are NOT enabling it
  yet** — it forces every dynamic read into a Suspense/`use cache` boundary and would
  break a bare build. Revisit for town/store pages in Phase 3.

## Build/tooling
- **Turbopack is default** for dev AND build. Don't pass `--turbopack`. A custom
  `webpack` key makes `next build` fail unless you opt out with `--webpack`.
- **`next lint` removed** — run ESLint directly (`npx eslint`).
- `next dev` writes to `.next/dev` (separate from build output).

## Images
- Use `images.remotePatterns` (not `images.domains`).
- Defaults changed: `qualities` is `[75]` only; `minimumCacheTTL` now 4h; max 3 redirects.

## Misc
- Parallel routes REQUIRE an explicit `default.js` in every slot.
- `scroll-behavior: smooth` only honored if `<html data-scroll-behavior="smooth">` (we set it).
- During `next dev`, `process.argv` no longer contains `'dev'` — check `NODE_ENV`.
