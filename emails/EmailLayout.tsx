import * as React from "react";
import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

const NAVY = "#12233B";
const GOLD = "#D99A2B";
const CREAM = "#FBF7EF";
const INK = "#2B3440";
const MUTED = "#6E6656";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mainstreet-shops.com";

/** Branded wrapper for all MainStreet emails (inline styles — email-safe). */
export function EmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: CREAM, fontFamily: "Arial, Helvetica, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 12, maxWidth: 560, margin: "0 auto", overflow: "hidden", border: "1px solid #E4DBC9" }}>
          <Section style={{ backgroundColor: NAVY, padding: "18px 24px" }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
              Main<span style={{ color: GOLD }}>Street</span>
            </Text>
          </Section>
          <Section style={{ padding: "24px" }}>{children}</Section>
          <Hr style={{ borderColor: "#E4DBC9", margin: 0 }} />
          <Section style={{ padding: "16px 24px" }}>
            <Text style={{ color: MUTED, fontSize: 12, margin: 0 }}>
              MainStreet — America&apos;s hometown marketplace ·{" "}
              <Link href={APP_URL} style={{ color: MUTED }}>
                mainstreet-shops.com
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const emailStyles = { NAVY, GOLD, CREAM, INK, MUTED, APP_URL };

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        backgroundColor: NAVY,
        borderRadius: 8,
        color: "#fff",
        display: "inline-block",
        fontSize: 14,
        fontWeight: 600,
        padding: "10px 20px",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
