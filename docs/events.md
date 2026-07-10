# Community Events

## Rules (enforced in `app/api/events/route.ts`)
- **Who can post:** only business owners on an **active paid plan** ($150/yr) —
  `isPaidActivePlan()` in `lib/membership.ts` (tier ∈ seller/featured/premium and
  not expired). Admins bypass. Free "listed" shops cannot post.
- **AI language check:** every submission runs through `moderateEventText()`
  (`lib/ai/moderation.ts`). Disallowed content → rejected (400). Borderline →
  `flagged` → routed to admin approval.
- **Approval triggers (`isApproved=false`):** AI-flagged, OR a **duplicate**
  (same shop + same title), OR **same-time** (another approved event in the same
  town within ±2h). Pending events are hidden from the public feed until approved.
- **Contact details:** pulled from the business record at display time — never
  entered on the event. The form only collects event-specific fields.
- **Editing:** only the **name (title)** and **details (description)** can change
  (`updateEventSchema`); edits are re-screened by AI.

## Surfaces
- Public feed: `/events` (category filter, date-grouped, RSVP, business contact).
  Also surfaced on `/town/[slug]` ("This week").
- Seller: `/seller/events` (list + status), `/seller/events/new`, `/seller/events/[id]` (edit).
- Admin: `/admin/events` (approve/reject) → `/api/admin/events`, `/api/admin/events/[id]`.
- RSVP: `POST /api/events/[id]/rsvp` (toggle; 401 → login).

## Test steps (needs MONGODB_URI)
1. Seed towns: `node --env-file=.env.local scripts/seed-towns.mjs`
2. Sign up, create a shop (`/onboard/start`).
3. Grant the paid plan: `node --env-file=.env.local scripts/grant-role.mjs you@example.com --plan`
4. Post an event at `/seller/events/new` → appears on `/events` and the town page.
5. Post a 2nd event with the SAME title (or same time in the same town) → goes to
   "Pending review".
6. Make yourself admin: `... grant-role.mjs you@example.com --admin`, refresh session,
   visit `/admin/events`, approve it → now visible publicly.
7. (Optional) Set `ANTHROPIC_API_KEY` to use Claude Haiku for language screening;
   without it, the local keyword screen runs.
