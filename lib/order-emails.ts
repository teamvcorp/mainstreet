import { formatCurrency } from "@/lib/utils";

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

/** Buyer order confirmation. */
export function buyerConfirmationEmail(input: {
  orderId: string;
  businessName: string;
  items: OrderEmailItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  fulfillmentType: "ship" | "pickup";
}) {
  const lines = input.items
    .map((i) => `  ${i.quantity} × ${i.name} — ${formatCurrency(i.unitPriceCents * i.quantity)}`)
    .join("\n");
  const text = [
    `Thanks for your order from ${input.businessName}!`,
    ``,
    lines,
    ``,
    `Subtotal: ${formatCurrency(input.subtotalCents)}`,
    input.shippingCents > 0 ? `Shipping: ${formatCurrency(input.shippingCents)}` : `Local pickup`,
    `Total:    ${formatCurrency(input.totalCents)}`,
    ``,
    input.fulfillmentType === "pickup"
      ? `You chose local pickup — the shop will be in touch.`
      : `We'll email you tracking as soon as it ships.`,
    ``,
    `Order ref: ${input.orderId}`,
  ].join("\n");
  return {
    subject: `Your MainStreet order from ${input.businessName}`,
    text,
    html: wrap(text),
  };
}

/**
 * SL Pack & Ship fulfillment handoff. Subject begins with "!! important" per the
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
  ].join("\n");
  return {
    subject: `!! important — MainStreet shipment ${input.orderId}`,
    text,
    html: wrap(text),
  };
}
