function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function wrap(text: string): string {
  return `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;white-space:pre-wrap">${esc(text)}</pre>`;
}

export interface OrderEmailItem {
  name: string;
  quantity: number;
  unitPriceCents: number;
  weightOz?: number;
  dimensions?: { lengthIn?: number; widthIn?: number; heightIn?: number };
}

const OZ_PER_LB = 16;
/** oz → "X.XX lb (N oz)" for the SL Pack & Ship team (they enter pounds). */
function weightLine(oz?: number): string {
  if (!oz) return "no weight on file";
  return `${(oz / OZ_PER_LB).toFixed(2)} lb (${oz} oz)`;
}
function dimsLine(d?: { lengthIn?: number; widthIn?: number; heightIn?: number }): string {
  if (!d || (!d.lengthIn && !d.widthIn && !d.heightIn)) return "no dimensions on file";
  const n = (v?: number) => (typeof v === "number" ? v : "?");
  return `${n(d.lengthIn)} × ${n(d.widthIn)} × ${n(d.heightIn)} in`;
}

/**
 * SL Pack & Ship fulfillment handoff — kept as a plain, unstyled ops email
 * (React templates are for customers). Subject begins with "!! important" per the
 * operations requirement, and the body carries the receiver + full package info.
 */
export function packAndShipHandoffEmail(input: {
  orderId: string;
  businessName: string;
  shipFrom?: { street?: string; city?: string; state?: string; zip?: string; phone?: string };
  shippingAddress: { name?: string; street?: string; city?: string; state?: string; zip?: string; phone?: string };
  items: OrderEmailItem[];
  carrier?: string;
  service?: string;
}) {
  const a = input.shippingAddress;
  const f = input.shipFrom;
  const totalOz = input.items.reduce((n, i) => n + (i.weightOz ?? 0) * i.quantity, 0);
  const text = [
    `!! important — new shipment to process`,
    ``,
    `Order ref: ${input.orderId}`,
    ``,
    `SHIP FROM`,
    `  ${input.businessName}`,
    ...(f
      ? [
          `  ${f.street ?? ""}`,
          `  ${f.city ?? ""}, ${f.state ?? ""} ${f.zip ?? ""}`,
          `  Phone: ${f.phone ?? ""}`,
        ]
      : [`  (no address on file for this business)`]),
    ``,
    `RECEIVER`,
    `  ${a.name ?? ""}`,
    `  ${a.street ?? ""}`,
    `  ${a.city ?? ""}, ${a.state ?? ""} ${a.zip ?? ""}`,
    `  Phone: ${a.phone ?? ""}`,
    ``,
    `REQUESTED SERVICE: ${[input.carrier, input.service].filter(Boolean).join(" ") || "best available"}`,
    ``,
    `PACKAGE CONTENTS`,
    ...input.items.map(
      (i) =>
        `  ${i.quantity} × ${i.name}\n      weight: ${weightLine(i.weightOz)} ea\n      dimensions: ${dimsLine(i.dimensions)}`,
    ),
    ``,
    `Estimated total weight: ${totalOz ? `${(totalOz / OZ_PER_LB).toFixed(2)} lb (${totalOz} oz)` : "n/a"}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
  return {
    subject: `!! important — MainStreet shipment ${input.orderId}`,
    text,
    html: wrap(text),
  };
}
