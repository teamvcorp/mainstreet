import { NextResponse } from "next/server";

/**
 * Map thrown error codes to HTTP responses so route handlers can just
 * `throw new Error("FORBIDDEN")` etc. Keeps auth/validation control-flow terse
 * and consistent. Unknown errors become 500 (and are logged, not leaked).
 */
export function errorResponse(err: unknown): NextResponse {
  const code = err instanceof Error ? err.message : "SERVER_ERROR";
  switch (code) {
    case "UNAUTHORIZED":
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    case "FORBIDDEN":
      return NextResponse.json({ error: "You don't have access to this." }, { status: 403 });
    case "NOT_FOUND":
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    case "CONFLICT":
      return NextResponse.json({ error: "That already exists." }, { status: 409 });
    case "ITEM_LIMIT":
      return NextResponse.json(
        { error: "You've reached your catalog limit. Add an item pack to list more." },
        { status: 403 },
      );
    case "OUT_OF_STOCK":
      return NextResponse.json(
        { error: "An item in your cart is out of stock. Please adjust quantities and try again." },
        { status: 409 },
      );
    case "EMPTY_CART":
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    // --- Shipping. We FAIL CLOSED: a label can only be produced from a real
    // stored quote, so when we cannot price shipping we refuse the order rather
    // than guess. These surface as actionable buyer-facing copy.
    case "SHIPPING_SELECTION_MISSING":
      return NextResponse.json(
        { error: "Please choose a shipping or pickup option for every shop in your cart." },
        { status: 400 },
      );
    case "SHIPPING_UNAVAILABLE":
      return NextResponse.json(
        {
          error:
            "We couldn’t get shipping rates just now. Please try again in a moment.",
        },
        { status: 503 },
      );
    case "SHIPPING_NOT_OFFERED":
      return NextResponse.json(
        { error: "This shop isn’t set up to ship online yet." },
        { status: 409 },
      );
    case "PICKUP_NOT_OFFERED":
      return NextResponse.json(
        { error: "This shop doesn’t offer local pickup." },
        { status: 409 },
      );
    case "SHIP_OPTION_UNAVAILABLE":
      return NextResponse.json(
        {
          error:
            "That shipping option is no longer available. Please choose a shipping method again.",
        },
        { status: 409 },
      );
    case "STRIPE_NOT_CONFIGURED":
      return NextResponse.json(
        { error: "Payments aren't configured yet. Please try again later." },
        { status: 501 },
      );
    case "BLOB_NOT_CONFIGURED":
      return NextResponse.json({ error: "This feature isn't configured yet." }, { status: 501 });
    case "BLOB_STORE_MISSING":
      return NextResponse.json(
        {
          error:
            "Image storage isn't set up yet. Create a Vercel Blob store and update BLOB_READ_WRITE_TOKEN.",
        },
        { status: 503 },
      );
    case "UNSUPPORTED_TYPE":
      return NextResponse.json({ error: "Only image files are allowed." }, { status: 415 });
    case "FILE_TOO_LARGE":
      return NextResponse.json({ error: "Image must be under 5 MB." }, { status: 413 });
    // --- Prospects / mailing list builder. -------------------------------
    case "INGEST_RUNNING":
      return NextResponse.json(
        { error: "A prospect ingest is already running. Try again in a few minutes." },
        { status: 409 },
      );
    case "AREA_UNSUPPORTED":
      return NextResponse.json(
        { error: "Only Iowa cities and ZIP codes are supported right now." },
        { status: 400 },
      );
    case "AREA_NOT_COVERED":
      return NextResponse.json(
        { error: "We haven't pulled that area from the state registry yet. It's been queued." },
        { status: 409 },
      );
    case "AREA_TOO_LARGE":
      return NextResponse.json(
        { error: "That area matched too many businesses to ingest in one pass. Narrow it down." },
        { status: 409 },
      );
    case "EMPTY_AUDIENCE":
      return NextResponse.json({ error: "No prospects matched that audience." }, { status: 400 });
    case "CAMPAIGN_LOCKED":
      return NextResponse.json({ error: "This campaign is already sending." }, { status: 409 });
    case "CAMPAIGN_WRONG_TYPE":
      return NextResponse.json(
        { error: "That action doesn't apply to this campaign type." },
        { status: 409 },
      );
    case "EMAIL_NOT_CONFIGURED":
      return NextResponse.json(
        { error: "Email isn't configured yet. Add RESEND_API_KEY." },
        { status: 501 },
      );
    // CAN-SPAM requires a physical postal address in every commercial email. We fail the send
    // closed rather than ship a non-compliant blast.
    case "POSTAL_ADDRESS_MISSING":
      return NextResponse.json(
        { error: "Set PROSPECTS_POSTAL_ADDRESS before sending outreach - CAN-SPAM requires a physical address." },
        { status: 501 },
      );
    case "INVALID_TOKEN":
      return NextResponse.json({ error: "That link is invalid or has expired." }, { status: 400 });
    case "PROSPECT_SOURCE_UNAVAILABLE":
      return NextResponse.json(
        { error: "The State of Iowa data service isn't responding. Try again later." },
        { status: 503 },
      );
    case "PROSPECT_SOURCE_FORMAT":
      return NextResponse.json(
        { error: "The state's data file changed format - ingest is paused. See docs/prospects.md." },
        { status: 502 },
      );
    default:
      console.error("Unhandled API error:", err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
