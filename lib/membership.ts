import type { IBusiness, MembershipTier } from "@/lib/models/Business";

/** Tiers that include the paid annual plan ($150/yr and up). */
export const PAID_TIERS: MembershipTier[] = ["seller", "featured", "premium"];

/**
 * True when a business is on an active paid plan — the requirement for posting
 * community events. "listed" (free) shops cannot post. An expired paid plan is
 * treated as inactive.
 */
export function isPaidActivePlan(
  biz: Pick<IBusiness, "membershipTier" | "membershipExpiresAt">,
): boolean {
  if (!PAID_TIERS.includes(biz.membershipTier)) return false;
  if (biz.membershipExpiresAt && new Date(biz.membershipExpiresAt) < new Date()) return false;
  return true;
}
