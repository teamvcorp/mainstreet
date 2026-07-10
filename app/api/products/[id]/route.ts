import { NextResponse } from "next/server";
import { requireRole } from "@/lib/session";
import { connectToDatabase } from "@/lib/db";
import { Business } from "@/lib/models/Business";
import { Product } from "@/lib/models/Product";
import { updateProductSchema } from "@/schemas/product";
import { toProductDTO } from "@/lib/dto";
import { errorResponse } from "@/lib/api";

/** Confirm the signed-in user owns the business that owns this product. */
async function assertOwnsProduct(productId: string, userId: string, isAdmin: boolean) {
  await connectToDatabase();
  const product = await Product.findById(productId);
  if (!product) throw new Error("NOT_FOUND");
  const biz = await Business.findById(product.businessId).select("ownerId");
  if (!biz) throw new Error("NOT_FOUND");
  if (biz.ownerId.toString() !== userId && !isAdmin) throw new Error("FORBIDDEN");
  return product;
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const user = await requireRole(["seller", "admin"]);
    const { id } = await ctx.params;
    const body = await request.json().catch(() => null);
    const parsed = updateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const product = await assertOwnsProduct(id, user.id, user.role === "admin");
    Object.assign(product, parsed.data);
    await product.save();
    return NextResponse.json({ product: toProductDTO(product.toObject()) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Soft delete — keep the row so past orders' references stay intact. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const user = await requireRole(["seller", "admin"]);
    const { id } = await ctx.params;
    const product = await assertOwnsProduct(id, user.id, user.role === "admin");
    product.isActive = false;
    await product.save();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
