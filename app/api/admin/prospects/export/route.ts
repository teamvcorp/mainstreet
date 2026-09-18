import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { errorResponse } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { lookupProspects } from "@/lib/prospects/queries";
import { toCsv, csvFilename } from "@/lib/prospects/csv";
import { IOWA_SOS_LICENSE } from "@/lib/prospects/source-iowa-sos";

const COLUMNS = [
  "business_name",
  "contact_name",
  "contact_is_agent_service",
  "registered_agent",
  "email",
  "street1",
  "street2",
  "city",
  "state",
  "zip",
  "entity_type",
  "address_source",
  "mailable",
  "emailable",
  "status",
];

/** Download the current lookup as CSV. Admin only. */
export async function GET(request: Request) {
  try {
    const user = await requireRole(["admin"]);

    const rl = await rateLimit({
      key: "prospect-export",
      limit: 20,
      windowSeconds: 300,
      identifier: user.id,
    });
    if (!rl.success) {
      return NextResponse.json({ error: "Too many exports. Try again shortly." }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") ?? "").slice(0, 120);
    const includeExcluded = searchParams.get("includeExcluded") === "true";

    // An export is the whole list, not the 300-row screen cap.
    const result = await lookupProspects({ query, includeExcluded, limit: 50_000 });
    if (!result.area) throw new Error("AREA_UNSUPPORTED");

    const csv = toCsv(
      COLUMNS,
      result.rows.map((r) => [
        r.businessName,
        // Only a plausible natural person goes in contact_name; an agent service would make
        // "Dear {contact_name}" read as a mail-merge failure.
        r.agentIsCommercial ? "" : (r.ownerName ?? ""),
        r.agentIsCommercial ? "yes" : "no",
        r.agentName ?? "",
        r.email ?? "",
        r.street1 ?? "",
        r.street2 ?? "",
        r.city ?? "",
        r.state ?? "",
        r.zip5 ?? "",
        r.entityType ?? "",
        r.addressIsAgent ? "registered_agent" : "principal_office",
        r.mailable ? "yes" : "no",
        r.emailable ? "yes" : "no",
        r.status,
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename("prospects", result.area.label)}"`,
        // A marketing list built from third-party data: never let a shared cache hold a copy.
        "Cache-Control": "no-store",
        // CC-BY 4.0 attribution travels with the data, as the licence requires.
        // Stripped to ASCII: header values are ByteStrings, and a stray em dash here
        // throws at response construction and 500s the whole export.
        "X-Data-License": IOWA_SOS_LICENSE.replace(/[^ -~]/g, ""),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
