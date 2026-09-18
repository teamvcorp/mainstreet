/**
 * Registered-agent classification.
 *
 * WHY THIS FILE EXISTS: Iowa's `registered_agent` is a service-of-process designee, NOT the
 * owner. For a one-person LLC it usually is the owner. It is just as often the company's
 * attorney, its accountant, its bank, the entity itself, or a commercial agent service.
 *
 * Mailing "Dear CT Corporation System" is embarrassing. Mailing "Dear Rob Villars" when Rob is
 * the family lawyer is worse. So we keep `agentName` as raw truth and derive `ownerName` ONLY
 * when the name looks like a natural person AND is not a known commercial service. The UI
 * labels the column "Contact (registered agent)", never "Owner".
 *
 * Pure module: no DB, no `next/*`.
 */

import { normalizeKey } from "@/lib/prospects/normalize";

/**
 * Known commercial registered-agent services, matched as normalized substrings.
 *
 * Provenance: the national RA services that appear across US state registries, plus the
 * LLC-formation companies that act as agent for their customers. Extend freely — a false
 * positive here only costs us an `ownerName` (the raw `agentName` is always preserved),
 * whereas a false negative puts a corporation's name on a "Dear {{ownerName}}" line.
 */
const COMMERCIAL_AGENT_PATTERNS: readonly string[] = [
  "ct corporation",
  "c t corporation",
  "corporation service company",
  "corporation service co",
  "csc lawyers",
  "registered agents inc",
  "registered agent solutions",
  "northwest registered agent",
  "incorp services",
  "national registered agents",
  "cogency global",
  "united states corporation agents",
  "usa corporate services",
  "legalzoom",
  "zenbusiness",
  "harbor business compliance",
  "harbor compliance",
  "vcorp services",
  "capitol services",
  "capitol corporate services",
  "paracorp",
  "parasec",
  "bizfilings",
  "agents and corporations",
  "first corporate solutions",
  "spiegel & utrera",
  "resident agent",
  "statutory agent",
  "registered agent",
  "business filings",
  "interstate agent services",
];

/** Tokens that mean "this is an organization, not a person". */
const ORG_TOKENS: readonly string[] = [
  "inc", "llc", "llp", "lp", "plc", "pllc", "pc", "ltd", "corp", "corporation", "company",
  "co", "services", "service", "solutions", "group", "associates", "partners", "holdings",
  "law", "office", "offices", "firm", "attorney", "attorneys", "legal", "bank", "trust",
  "agency", "agents", "agent", "cpa", "accounting", "consulting", "enterprises", "management",
];

/** Name suffixes that are fine on a natural person. */
const PERSON_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "md", "dds", "phd", "esq", "cpa"]);

export interface AgentClassification {
  /** A known commercial agent service, or otherwise clearly an organization. */
  isCommercial: boolean;
  /** Which pattern matched, for the admin UI tooltip and for tuning the list. */
  matched?: string;
  /** Shaped like a natural person's name. */
  looksLikePerson: boolean;
}

/**
 * Three signals, cheapest first.
 *   1. Curated commercial-service list.
 *   2. Organization shape (corporate token present, or agent name === business name,
 *      which means the entity is its own agent).
 *   3. Person shape: 2-4 tokens, no corporate token, no digits.
 */
export function classifyAgent(
  rawAgentName: string | null | undefined,
  businessName: string | null | undefined,
): AgentClassification {
  const key = normalizeKey(rawAgentName);
  if (!key) return { isCommercial: false, looksLikePerson: false };

  const matched = COMMERCIAL_AGENT_PATTERNS.find((p) => key.includes(p));
  if (matched) return { isCommercial: true, matched, looksLikePerson: false };

  // The entity serving as its own agent is never a person we can address by name.
  if (businessName && key === normalizeKey(businessName)) {
    return { isCommercial: true, matched: "entity is its own agent", looksLikePerson: false };
  }

  const tokens = key.split(" ").filter(Boolean);
  const hasOrgToken = tokens.some((t) => ORG_TOKENS.includes(t));
  if (hasOrgToken) {
    const hit = tokens.find((t) => ORG_TOKENS.includes(t));
    return { isCommercial: true, matched: `organization token "${hit}"`, looksLikePerson: false };
  }

  const meaningful = tokens.filter((t) => !PERSON_SUFFIXES.has(t));
  const looksLikePerson =
    meaningful.length >= 2 &&
    meaningful.length <= 4 &&
    !tokens.some((t) => /\d/.test(t));

  return { isCommercial: false, looksLikePerson };
}

/**
 * The only sanctioned way to produce an `ownerName` from source data.
 * Returns undefined unless the agent is a plausible natural person — which is what keeps the
 * `(email AND ownerName)` branch of the quality filter from ever firing on a corporate agent.
 */
export function deriveOwnerName(
  rawAgentName: string | null | undefined,
  businessName: string | null | undefined,
  displayCase: (s: string) => string,
): string | undefined {
  const c = classifyAgent(rawAgentName, businessName);
  if (!c.looksLikePerson || c.isCommercial) return undefined;
  return displayCase(rawAgentName ?? "") || undefined;
}
