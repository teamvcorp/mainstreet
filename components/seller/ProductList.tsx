"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Package, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

export interface ProductRow {
  id: string;
  name: string;
  priceCents: number;
  inventoryQty: number;
  images: string[];
}

export function ProductList({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function onDelete(id: string) {
    if (!confirm("Remove this product from your shop?")) return;
    setDeletingId(id);
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    setDeletingId(null);
    if (res.ok) router.refresh();
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <Package className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-2 font-serif text-lg">No products yet</p>
        <p className="text-sm text-muted-foreground">Add your first item to start selling.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {products.map((p) => (
        <li key={p.id} className="flex items-center gap-4 p-4">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            {p.images[0] ? (
              <Image src={p.images[0]} alt="" fill className="object-cover" sizes="56px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <Package className="size-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{p.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(p.priceCents)} · {p.inventoryQty} in stock
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/seller/products/${p.id}`}>
                <Pencil className="size-4" /> Edit
              </Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(p.id)}
              disabled={deletingId === p.id}
              aria-label="Delete product"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
