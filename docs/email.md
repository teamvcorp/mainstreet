# Email & Notifications (Phase 8)

## Stack
- **Resend** + **React Email** (`@react-email/components`). `lib/email.ts`
  `sendEmail()` accepts a `react` element (Resend renders it) or html/text; it's a
  no-op when `RESEND_API_KEY` is unset (dev-safe).
- **From address MUST be on the Resend-verified domain: `fyht4.com`** — default
  `MainStreet <hello@fyht4.com>` (override with `EMAIL_FROM`). Sending from an
  unverified domain (e.g. mainstreet-shops.com) will be rejected by Resend.

## Templates (`emails/`)
- `EmailLayout.tsx` — branded wrapper (navy header, gold accent) + `CtaButton`.
- `OrderConfirmation.tsx` → `buildOrderConfirmation()` (buyer receipt).
- `Shipped.tsx` → `buildShipped()` (tracking notice).
- `WeeklyDigest.tsx` → `buildWeeklyDigest()` (town roundup).
- Ops handoff to SL Pack & Ship stays plain-text in `lib/order-emails.ts`
  (subject starts with `!! important`).

Usage: `sendEmail({ to, ...buildOrderConfirmation({...}) })`.

## Weekly town digest
- `lib/digest.ts` `sendWeeklyDigests()` — for each active town with subscribers,
  compiles this week's events + local shops + new arrivals and emails each
  resident who **follows that town** and hasn't opted out
  (`notificationPrefs.townDigest`). Empty digests are skipped.
- Endpoint `GET /api/cron/weekly-digest` — authorized by `Authorization: Bearer
  <CRON_SECRET>` (Vercel Cron passes this automatically) OR an admin session.
- Schedule in `vercel.json`: `0 12 * * 1` (Mondays ~7am CT / 12:00 UTC).

## Env
`RESEND_API_KEY`, `EMAIL_FROM` (@fyht4.com), `CRON_SECRET`.

## Test
- Set `RESEND_API_KEY` + `EMAIL_FROM=MainStreet <hello@fyht4.com>`.
- Order emails fire on paid checkout; shipped email on admin "Mark shipped".
- Digest: follow a town (buyer account), then hit `/api/cron/weekly-digest` as an
  admin (or with the Bearer secret) → returns `{ towns, emails }`.
