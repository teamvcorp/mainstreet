/**
 * Postal formatting for mailing labels and CSV export.
 *
 * Both the Avery label sheet and the CSV go through THIS function, so a printed label and an
 * exported row can never disagree about what the address is.
 *
 * USPS automation prefers uppercase, unpunctuated address lines. We follow that for the
 * address block; the recipient line keeps display case because "Dear ROB VILLARS" reads badly
 * and the recipient line is not what the barcode sorter reads.
 *
 * Pure module: no DB, no `next/*`.
 */

import { normalizeStreet, type NormalizedAddress } from "@/lib/prospects/normalize";

export interface PostalRecord {
  businessName: string;
  ownerName?: string | null;
  address: NormalizedAddress;
}

/**
 * The lines of a mailing label, in order, already trimmed of empties.
 *
 *   ROB VILLARS                 <- ownerName when we have one (the attention line)
 *   !MPACT LTD CO               <- businessName (omitted when it was already line 1)
 *   312 E CARTER ST
 *   STE 4                       <- street2, when present
 *   SHENANDOAH IA 51601         <- USPS last line: no comma before the state
 */
export function formatPostalLines(record: PostalRecord): string[] {
  const { businessName, ownerName, address } = record;
  const lines: string[] = [];

  const person = (ownerName ?? "").trim();
  if (person) lines.push(person);
  if (businessName && businessName.trim() !== person) lines.push(businessName.trim());

  const street1 = normalizeStreet(address.street1);
  const street2 = normalizeStreet(address.street2);
  if (street1) lines.push(street1);
  if (street2) lines.push(street2);

  // USPS last line: CITY ST ZIP, uppercase, no comma. ZIP+4 hyphenated when known.
  const city = (address.city ?? "").toUpperCase().trim();
  const state = (address.state ?? "").toUpperCase().trim();
  const zip = address.zip4 ? `${address.zip5}-${address.zip4}` : (address.zip5 ?? "");
  const last = [city, state, zip].filter(Boolean).join(" ");
  if (last) lines.push(last);

  return lines;
}

/**
 * Mirrors `evaluateProspectQuality().mailable`. Kept here as a guard for the label renderer so
 * a blank label can never be printed even if an audience was built by some other path.
 */
export function isDeliverableEnough(addr: NormalizedAddress | null | undefined): boolean {
  return !!(addr?.street1?.trim() && addr.city?.trim() && addr.state?.trim() && addr.zip5?.trim());
}
