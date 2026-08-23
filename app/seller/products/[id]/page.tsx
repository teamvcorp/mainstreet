import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness, getMyProduct } from "@/lib/seller";
import { ProductForm } from "@/components/seller/ProductForm";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  const product = await getMyProduct(id, biz._id.toString());
  if (!product) notFound();

  return (
    <div>
      <h1 className="mb-6 font-serif text-3xl font-semibold">Edit product</h1>
      <ProductForm
        initial={{
          id: product._id.toString(),
          name: product.name,
          description: product.description,
          priceCents: product.priceCents,
          compareAtPriceCents: product.compareAtPriceCents,
          sku: product.sku,
          inventoryQty: product.inventoryQty,
          trackInventory: product.trackInventory,
          weightOz: product.weightOz,
          dimensions: product.dimensions,
          images: product.images,
          category: product.category,
          tags: product.tags,
          optionTypes: (product.optionTypes ?? []).map((t) => ({ name: t.name, values: t.values })),
          variants: (product.variants ?? []).map((v) => ({
            id: v._id.toString(),
            options: v.options.map((o) => ({ name: o.name, value: o.value })),
            priceCents: v.priceCents,
            inventoryQty: v.inventoryQty,
            trackInventory: v.trackInventory,
            weightOz: v.weightOz,
            sku: v.sku,
            isActive: v.isActive,
          })),
        }}
      />
    </div>
  );
}
