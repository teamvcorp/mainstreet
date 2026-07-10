import { connectToDatabase } from "@/lib/db";
import { Business, type IBusiness } from "@/lib/models/Business";
import { Product, type IProduct } from "@/lib/models/Product";

type Lean<T> = T & { _id: { toString(): string } };

/** The business owned by a user (one shop per owner for v1). */
export async function getMyBusiness(ownerId: string): Promise<Lean<IBusiness> | null> {
  await connectToDatabase();
  return Business.findOne({ ownerId }).lean<Lean<IBusiness>>();
}

/** Active products for a business, newest first. */
export async function getMyProducts(businessId: string): Promise<Lean<IProduct>[]> {
  await connectToDatabase();
  return Product.find({ businessId, isActive: true })
    .sort({ createdAt: -1 })
    .lean<Lean<IProduct>[]>();
}

/** A single product owned by the given business (ownership scoping). */
export async function getMyProduct(
  productId: string,
  businessId: string,
): Promise<Lean<IProduct> | null> {
  await connectToDatabase();
  return Product.findOne({ _id: productId, businessId }).lean<Lean<IProduct>>();
}

/** Count of active products (for the item-limit check). */
export async function countActiveProducts(businessId: string): Promise<number> {
  await connectToDatabase();
  return Product.countDocuments({ businessId, isActive: true });
}
