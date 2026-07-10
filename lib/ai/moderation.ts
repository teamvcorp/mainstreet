/**
 * Language moderation for community event submissions.
 *
 * Primary: Anthropic Claude (Haiku — fast + cheap) classifies the text and
 * returns strict JSON. Fallback: a local keyword screen so the feature still
 * works without an API key (fails safe, not open — a hard match is rejected).
 *
 * Contract: `allowed=false` blocks the post outright; `flagged=true` (with
 * allowed still true) routes the post to admin approval rather than rejecting.
 */
export interface ModerationResult {
  allowed: boolean;
  flagged: boolean;
  reason?: string;
}

// Kept intentionally small — the LLM is the real classifier; this is a safety net.
const HARD_BLOCK = [
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "cunt",
  "nigger",
  "faggot",
  "retard",
];
const REVIEW_HINTS = ["free money", "wire transfer", "crypto giveaway", "guaranteed income", "xxx"];

function localScreen(text: string): ModerationResult {
  const lower = text.toLowerCase();
  if (HARD_BLOCK.some((w) => new RegExp(`\\b${w}`, "i").test(lower))) {
    return { allowed: false, flagged: true, reason: "Inappropriate language detected." };
  }
  if (REVIEW_HINTS.some((w) => lower.includes(w))) {
    return { allowed: true, flagged: true, reason: "Flagged for review (possible spam/scam)." };
  }
  return { allowed: true, flagged: false };
}

function safeParse(raw: string): { allowed?: boolean; flagged?: boolean; reason?: string } | null {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

export async function moderateEventText(input: {
  title: string;
  description?: string;
}): Promise<ModerationResult> {
  const text = `Title: ${input.title}\n\nDetails: ${input.description ?? ""}`.trim();
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return localScreen(text);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        system:
          'You moderate submissions to a family-friendly, small-town community events board. ' +
          'Classify the event text. Respond with ONLY strict JSON: ' +
          '{"allowed":boolean,"flagged":boolean,"reason":string}. ' +
          "Set allowed=false for hate speech, harassment, sexual content, graphic violence, " +
          "illegal activity, scams/fraud, or profanity. Set flagged=true (allowed may still be " +
          "true) when the post is borderline and a human should review it. Keep reason under 15 words.",
        messages: [{ role: "user", content: text }],
      }),
      // Moderation should be quick; don't let it hang a submission forever.
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return localScreen(text);
    const data = await res.json();
    const raw: string = data?.content?.[0]?.text ?? "";
    const parsed = safeParse(raw);
    if (!parsed || typeof parsed.allowed !== "boolean") return localScreen(text);

    return {
      allowed: parsed.allowed,
      flagged: parsed.flagged ?? false,
      reason: parsed.reason,
    };
  } catch {
    // Network/timeout/parse issue — fall back to the deterministic screen.
    return localScreen(text);
  }
}
