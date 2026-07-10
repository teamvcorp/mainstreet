import * as React from "react";
import { Heading, Hr, Row, Column, Text } from "@react-email/components";
import { EmailLayout, CtaButton, emailStyles } from "./EmailLayout";
import { formatCurrency } from "@/lib/utils";
import type { OrderEmailItem } from "@/lib/order-emails";

export interface OrderConfirmationProps {
  orderId: string;
  businessName: string;
  items: OrderEmailItem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  fulfillmentType: "ship" | "pickup";
}

export function OrderConfirmationEmail(p: OrderConfirmationProps) {
  const orderUrl = `${emailStyles.APP_URL}/orders/${p.orderId}`;
  return (
    <EmailLayout preview={`Your order from ${p.businessName} is confirmed`}>
      <Heading as="h1" style={{ color: emailStyles.INK, fontSize: 22, margin: "0 0 8px" }}>
        Thanks for shopping local! 🎉
      </Heading>
      <Text style={{ color: emailStyles.INK, margin: "0 0 16px" }}>
        Your order from <strong>{p.businessName}</strong> is confirmed.
      </Text>

      {p.items.map((it, i) => (
        <Row key={i} style={{ marginBottom: 6 }}>
          <Column style={{ color: emailStyles.INK, fontSize: 14 }}>
            {it.quantity} × {it.name}
          </Column>
          <Column align="right" style={{ color: emailStyles.INK, fontSize: 14 }}>
            {formatCurrency(it.unitPriceCents * it.quantity)}
          </Column>
        </Row>
      ))}

      <Hr style={{ borderColor: "#E4DBC9", margin: "12px 0" }} />
      <Row>
        <Column style={{ color: emailStyles.MUTED, fontSize: 14 }}>Subtotal</Column>
        <Column align="right" style={{ fontSize: 14 }}>{formatCurrency(p.subtotalCents)}</Column>
      </Row>
      <Row>
        <Column style={{ color: emailStyles.MUTED, fontSize: 14 }}>
          {p.shippingCents > 0 ? "Shipping" : "Local pickup"}
        </Column>
        <Column align="right" style={{ fontSize: 14 }}>
          {p.shippingCents > 0 ? formatCurrency(p.shippingCents) : "Free"}
        </Column>
      </Row>
      <Row>
        <Column style={{ fontSize: 16, fontWeight: 700 }}>Total</Column>
        <Column align="right" style={{ fontSize: 16, fontWeight: 700 }}>{formatCurrency(p.totalCents)}</Column>
      </Row>

      <Text style={{ color: emailStyles.MUTED, fontSize: 13, margin: "16px 0" }}>
        {p.fulfillmentType === "pickup"
          ? "You chose local pickup — the shop will be in touch."
          : "We'll email you tracking as soon as it ships."}
      </Text>

      <CtaButton href={orderUrl}>View your order</CtaButton>
    </EmailLayout>
  );
}

/** Convenience builder for sendEmail({ to, ...buildOrderConfirmation(props) }). */
export function buildOrderConfirmation(p: OrderConfirmationProps) {
  return {
    subject: `Your MainStreet order from ${p.businessName}`,
    react: <OrderConfirmationEmail {...p} />,
  };
}
