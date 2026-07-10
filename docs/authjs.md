# Auth.js (NextAuth v5) — our setup

## Key decision: JWT sessions + Mongoose upsert (NO adapter)
We do **not** use `@auth/mongodb-adapter`. The adapter owns a `users` collection
with its own shape, which collides with our rich `User` model (role, townId,
favorites, saved addresses). Instead:
- **Session strategy: JWT** (required anyway for the Credentials provider).
- On sign-in we **upsert the user into our Mongoose `users` collection** (Google
  users created in the `jwt` callback; credentials users already exist).
- `token.id` + `token.role` are set at sign-in and read on every request without
  hitting the DB.

## Files
- `auth.config.ts` — light, DB-free config used by `proxy.ts`. Holds `authorized`
  (route gating) + `session` callbacks and `pages.signIn`.
- `auth.ts` — full config (Node): Google + Credentials providers, `jwt` upsert.
- `app/api/auth/[...nextauth]/route.ts` — mounts Auth.js endpoints.
- `proxy.ts` — `export const { auth: proxy } = NextAuth(authConfig)` (Next 16
  renamed middleware→proxy). Matcher gates `/seller /admin /account /checkout`.
- `types/next-auth.d.ts` — augments Session/JWT with `id` + `role`.
- `lib/session.ts` — `getSessionUser()`, `requireUser()`, `requireRole()`.

## Role gating
- `/admin/*` → role `admin`
- `/seller/*` → role `seller` or `admin`
- `/account`, `/checkout` → any signed-in user
- Cart is guest-friendly (not gated).

## Password reset (self-service + admin trigger)
- `POST /api/auth/request-reset` — always 200 (no account-existence leak); stores
  a **SHA-256 hash** of a random token in `PasswordResetToken` (TTL-indexed, 1h),
  emails a link via `lib/resend` (logs to console in dev).
- `POST /api/auth/reset` — verifies hash, sets new bcrypt hash (cost 12), marks
  token used, invalidates other outstanding tokens.
- Pages: `/forgot-password`, `/reset-password?token=…`.

## Env required
`AUTH_SECRET` (generate: `npx auth secret`). Optional Google:
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. A dev secret is in `.env.local`.

## Gotchas
- Credentials provider requires `session.strategy = "jwt"`.
- `passwordHash` is `select:false`; the `authorize` fn selects it explicitly.
- Public pages stay static because auth state is read client-side via
  `useSession` in `AccountMenu` (a client island), not via `auth()` in the layout.
