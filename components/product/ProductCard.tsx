import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface ProductCardData {
  slug: string;
  storeSlug: string;
  name: string;
  priceCents: number;
  compareAtPriceCents?: number;
  images: string[];
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const onSale =
    typeof product.compareAtPriceCents === "number" &&
    product.compareAtPriceCents > product.priceCents;

  return (
    <Link
      href={`/store/${product.storeSlug}/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Package className="size-8 opacity-70" aria-hidden />
          </div>
        )}
        {onSale && (
          <span className="absolute left-2 top-2 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-destructive-foreground">
            Sale
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-semibold">{formatCurrency(product.priceCents)}</span>
          {onSale && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.compareAtPriceCents!)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
