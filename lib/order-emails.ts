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
}

/**
 * SL Pack & Ship fulfillment handoff — kept as a plain, unstyled ops email
 * (React templates are for customers). Subject begins with "!! important" per the
 * operations requirement, and the body carries the receiver + full package info.
 */
export function packAndShipHandoffEmail(input: {
  orderId: string;
  businessName: string;
  shippingAddress: { name?: string; street?: string; city?: string; state?: string; zip?: string; phone?: string };
  items: OrderEmailItem[];
  carrier?: string;
  service?: string;
}) {
  const a = input.shippingAddress;
  const totalWeight = input.items.reduce((n, i) => n + (i.weightOz ?? 0) * i.quantity, 0);
  const text = [
    `!! important — new shipment to process`,
    ``,
    `Order ref: ${input.orderId}`,
    `Ship from business: ${input.businessName}`,
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
      (i) => `  ${i.quantity} × ${i.name}${i.weightOz ? ` (${i.weightOz} oz ea)` : ""}`,
    ),
    ``,
    `Estimated total weight: ${totalWeight || "n/a"} oz`,
  ]
    .filter((l) => l !== "")
    .join("\n");
  return {
    subject: `!! important — MainStreet shipment ${input.orderId}`,
    text,
    html: wrap(text),
  };
}
