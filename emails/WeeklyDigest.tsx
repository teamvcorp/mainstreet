import * as React from "react";
import { Heading, Hr, Text } from "@react-email/components";
import { EmailLayout, CtaButton, emailStyles } from "./EmailLayout";
import { formatCurrency } from "@/lib/utils";

export interface DigestEvent {
  title: string;
  whenLabel: string;
  locationName?: string;
}
export interface DigestBusiness {
  name: string;
  slug: string;
  category?: string;
}
export interface DigestProduct {
  name: string;
  storeSlug: string;
  slug: string;
  priceCents: number;
}
export interface WeeklyDigestProps {
  townName: string;
  townState: string;
  townSlug: string;
  events: DigestEvent[];
  businesses: DigestBusiness[];
  products: DigestProduct[];
}

export function WeeklyDigestEmail(p: WeeklyDigestProps) {
  const base = emailStyles.APP_URL;
  const townUrl = `${base}/town/${p.townSlug}`;
  return (
    <EmailLayout preview={`What's happening in ${p.townName} this week`}>
      <Heading as="h1" style={{ color: emailStyles.INK, fontSize: 22, margin: "0 0 4px" }}>
        {p.townName}, {p.townState} this week
      </Heading>
      <Text style={{ color: emailStyles.MUTED, margin: "0 0 16px" }}>
        Your hometown roundup — events, shops, and new arrivals.
      </Text>

      {p.events.length > 0 && (
        <>
          <Heading as="h2" style={{ color: emailStyles.NAVY, fontSize: 16, margin: "0 0 8px" }}>
            📅 Happening this week
          </Heading>
          {p.events.map((e, i) => (
            <Text key={i} style={{ color: emailStyles.INK, fontSize: 14, margin: "0 0 6px" }}>
              <strong>{e.title}</strong> — {e.whenLabel}
              {e.locationName ? ` · ${e.locationName}` : ""}
            </Text>
          ))}
          <Hr style={{ borderColor: "#E4DBC9", margin: "16px 0" }} />
        </>
      )}

      {p.businesses.length > 0 && (
        <>
          <Heading as="h2" style={{ color: emailStyles.NAVY, fontSize: 16, margin: "0 0 8px" }}>
            🏪 Local shops
          </Heading>
          {p.businesses.map((b, i) => (
            <Text key={i} style={{ color: emailStyles.INK, fontSize: 14, margin: "0 0 6px" }}>
              <a href={`${base}/store/${b.slug}`} style={{ color: emailStyles.NAVY }}>
                {b.name}
              </a>
              {b.category ? ` — ${b.category}` : ""}
            </Text>
          ))}
          <Hr style={{ borderColor: "#E4DBC9", margin: "16px 0" }} />
        </>
      )}

      {p.products.length > 0 && (
        <>
          <Heading as="h2" style={{ color: emailStyles.NAVY, fontSize: 16, margin: "0 0 8px" }}>
            ✨ New arrivals
          </Heading>
          {p.products.map((pr, i) => (
            <Text key={i} style={{ color: emailStyles.INK, fontSize: 14, margin: "0 0 6px" }}>
              <a href={`${base}/store/${pr.storeSlug}/${pr.slug}`} style={{ color: emailStyles.NAVY }}>
                {pr.name}
              </a>{" "}
              — {formatCurrency(pr.priceCents)}
            </Text>
          ))}
          <Hr style={{ borderColor: "#E4DBC9", margin: "16px 0" }} />
        </>
      )}

      <CtaButton href={townUrl}>Visit {p.townName}</CtaButton>
    </EmailLayout>
  );
}

export function buildWeeklyDigest(p: WeeklyDigestProps) {
  return {
    subject: `What's happening in ${p.townName} this week`,
    react: <WeeklyDigestEmail {...p} />,
  };
}
