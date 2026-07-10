import * as React from "react";
import { Heading, Text } from "@react-email/components";
import { EmailLayout, CtaButton, emailStyles } from "./EmailLayout";

export interface ShippedProps {
  orderId: string;
  businessName: string;
  carrier?: string;
  service?: string;
  trackingNumber?: string;
}

export function ShippedEmail(p: ShippedProps) {
  const orderUrl = `${emailStyles.APP_URL}/orders/${p.orderId}`;
  const carrierLine = [p.carrier, p.service].filter(Boolean).join(" ");
  return (
    <EmailLayout preview={`Your order from ${p.businessName} has shipped`}>
      <Heading as="h1" style={{ color: emailStyles.INK, fontSize: 22, margin: "0 0 8px" }}>
        It&apos;s on the way! 📦
      </Heading>
      <Text style={{ color: emailStyles.INK, margin: "0 0 16px" }}>
        Your order from <strong>{p.businessName}</strong> has shipped.
      </Text>
      {carrierLine && (
        <Text style={{ color: emailStyles.INK, fontSize: 14, margin: "0 0 4px" }}>
          Carrier: {carrierLine}
        </Text>
      )}
      {p.trackingNumber && (
        <Text style={{ color: emailStyles.INK, fontSize: 14, margin: "0 0 16px" }}>
          Tracking #: <strong>{p.trackingNumber}</strong>
        </Text>
      )}
      <CtaButton href={orderUrl}>Track your order</CtaButton>
    </EmailLayout>
  );
}

export function buildShipped(p: ShippedProps) {
  return {
    subject: `Your order from ${p.businessName} has shipped`,
    react: <ShippedEmail {...p} />,
  };
}
