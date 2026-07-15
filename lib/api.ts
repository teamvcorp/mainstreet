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
    default:
      console.error("Unhandled API error:", err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
