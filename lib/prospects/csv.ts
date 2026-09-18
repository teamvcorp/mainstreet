/**
 * CSV generation. Zero dependencies.
 *
 * SECURITY - CSV FORMULA INJECTION: a spreadsheet treats a cell beginning with =, +, -, @, TAB
 * or CR as a FORMULA, so a business legally named `=HYPERLINK("http://evil","Click")` becomes a
 * live link the moment the export is opened in Excel. The State of Iowa does not sanitize
 * business names for us, and we are exporting third-party names verbatim. Prefixing a single
 * quote neutralizes the formula while still displaying the original text. This is the standard
 * mitigation (OWASP calls it CSV Injection).
 *
 * Two other details that matter in practice:
 *   - CRLF line endings and doubled quotes, per RFC 4180.
 *   - A UTF-8 BOM, without which Excel on Windows reads the file as Windows-1252 and mangles
 *     every accented character.
 */

/** =, +, -, @, tab, carriage return. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Byte-order mark. Excel needs it to detect UTF-8. */
const BOM = "﻿";

/**
 * Strip control characters: they break naive parsers and can hide content from a reviewer.
 * Written as a code-point test rather than a regex so the intent stays readable.
 */
function stripControlChars(s: string): string {
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const isControl = c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d;
    if (!isControl && c !== 0x7f) out += ch;
  }
  return out;
}

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  s = stripControlChars(s);
  if (FORMULA_LEAD.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const body = [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
  return BOM + body + "\r\n";
}

/**
 * Build a safe `Content-Disposition` filename.
 *
 * Derived from a slug and an ISO date ONLY, never from raw admin text: an unescaped quote or
 * newline in this header is a response-header-injection vector.
 */
export function csvFilename(prefix: string, label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const date = new Date().toISOString().slice(0, 10);
  return `${prefix}-${slug || "all"}-${date}.csv`;
}
