# AI moderation (Claude)

- File: `lib/ai/moderation.ts` → `moderateEventText({ title, description })`.
- Model: **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) via the Anthropic
  Messages API (`https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`),
  called with a plain `fetch` (no SDK dep). 8s timeout via `AbortSignal.timeout`.
- Returns `{ allowed, flagged, reason }`:
  - `allowed=false` → block the post (400).
  - `flagged=true` (allowed may be true) → route to admin approval.
- **Fallback:** if `ANTHROPIC_API_KEY` is unset OR the call fails/times out, a
  local keyword screen runs (`localScreen`) — hard matches are blocked, spam
  hints are flagged. Fails safe, not open.
- Env: `ANTHROPIC_API_KEY` (server-only).

## Why this model
Haiku is fast + inexpensive — ideal for short, high-volume classification like
event text. Swap the model id in one place if needed.
