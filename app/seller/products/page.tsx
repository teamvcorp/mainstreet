import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import { getMyBusiness, getMyProducts } from "@/lib/seller";
import { Button } from "@/components/ui/button";
import { ProductList } from "@/components/seller/ProductList";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  const user = await getSessionUser();
  const biz = user ? await getMyBusiness(user.id) : null;
  if (!biz) redirect("/onboard/start");

  const products = await getMyProducts(biz._id.toString());
  const atLimit = products.length >= biz.itemLimit;

  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-semibold">Products</h1>
          <p className="text-muted-foreground">
            {products.length} of {biz.itemLimit} used
          </p>
        </div>
        <Button asChild disabled={atLimit}>
          <Link href="/seller/products/new">
            <Plus className="size-4" /> Add product
          </Link>
        </Button>
      </div>

      {atLimit && (
        <p className="mt-4 rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm text-accent-foreground">
          You&apos;ve reached your catalog limit. Add an item pack from your{" "}
          <Link href="/seller/membership" className="font-medium underline">
            membership
          </Link>{" "}
          to list more.
        </p>
      )}

      <div className="mt-6">
        <ProductList
          products={products.map((p) => ({
            id: p._id.toString(),
            name: p.name,
            priceCents: p.priceCents,
            inventoryQty: p.inventoryQty,
            images: p.images ?? [],
          }))}
        />
      </div>
    </div>
  );
}
