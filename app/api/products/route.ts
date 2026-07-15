import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { createProductSchema } from "@/schemas/product";
import { uniqueSlug } from "@/lib/slug";
import { toProductDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";

/** Create a product in the seller's shop, enforcing the catalog item limit. */
export async function POST(request: Request) {
  try {
    const user = await requireRole(["seller", "admin"]);
    const body = await request.json().catch(() => null);
    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    await connectToDatabase();
    const biz = await Business.findOne({ ownerId: user.id }).select("_id itemLimit");
    if (!biz) throw new Error("NOT_FOUND");

    // Enforce the plan's catalog cap (base 10 + purchased packs).
    const count = await Product.countDocuments({ businessId: biz._id, isActive: true });
    if (count >= (biz.itemLimit ?? 10)) throw new Error("ITEM_LIMIT");

    const slug = await uniqueSlug(
      parsed.data.name,
      async (s) => !!(await Product.exists({ businessId: biz._id, slug: s })),
    );

    const product = await Product.create({ ...parsed.data, businessId: biz._id, slug });

    // First product → turn on online shipping by default (shipping is core to the
    // platform). Only on the first item so a seller who later disables it isn't
    // overridden on every subsequent add.
    if (count === 0) {
      await Business.updateOne({ _id: biz._id }, { $set: { shipsOnline: true } });
    }

    return NextResponse.json({ product: toProductDTO(product.toObject()) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
