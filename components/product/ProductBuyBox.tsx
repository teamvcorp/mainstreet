"use client";

import { useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart";
import { formatCurrency, cn } from "@/lib/utils";
import { useT } from "@/components/i18n/I18nProvider";

interface BuyBoxVariant {
  id: string;
  options: { name: string; value: string }[];
  priceCents: number;
  inventoryQty: number;
  trackInventory: boolean;
  weightOz?: number;
}

export interface BuyBoxProduct {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  compareAtPriceCents?: number;
  weightOz?: number;
  imageUrl?: string;
  trackInventory: boolean;
  inventoryQty: number;
  optionTypes: { name: string; values: string[] }[];
  variants: BuyBoxVariant[];
}

/**
 * Product price + (optional) option pickers + add-to-cart. When the product has
 * variants, the price/stock react to the selected combination and the button stays
 * disabled until a valid in-stock variant is chosen. No-variant products behave as
 * a simple single-price add-to-cart.
 */
export function ProductBuyBox({
  product,
  business,
}: {
  product: BuyBoxProduct;
  business: { id: string; name: string; slug: string };
}) {
  const t = useT();
  const add = useCart((s) => s.add);
  const [added, setAdded] = useState(false);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const hasVariants = product.variants.length > 0;
  const onSale =
    typeof product.compareAtPriceCents === "number" && product.compareAtPriceCents > product.priceCents;

  // Values that appear in at least one (active) variant — others are unbuyable.
  const availableValues = new Map<string, Set<string>>();
  for (const v of product.variants) {
    for (const o of v.options) {
      if (!availableValues.has(o.name)) availableValues.set(o.name, new Set());
      availableValues.get(o.name)!.add(o.value);
    }
  }

  const allChosen = product.optionTypes.every((tType) => selected[tType.name]);
  const selectedVariant =
    hasVariants && allChosen
      ? product.variants.find((v) => v.options.every((o) => selected[o.name] === o.value))
      : undefined;

  const variantOutOfStock =
    !!selectedVariant && selectedVariant.trackInventory && selectedVariant.inventoryQty <= 0;
  const baseOutOfStock = product.trackInventory && product.inventoryQty <= 0;

  const minVariantPrice = hasVariants
    ? Math.min(...product.variants.map((v) => v.priceCents))
    : product.priceCents;

  // What price to show right now.
  let priceNode: React.ReactNode;
  if (!hasVariants) {
    priceNode = (
      <div className="flex items-center gap-3">
        <span className="text-2xl font-semibold">{formatCurrency(product.priceCents)}</span>
        {onSale && (
          <span className="text-muted-foreground line-through">{formatCurrency(product.compareAtPriceCents!)}</span>
        )}
      </div>
    );
  } else if (selectedVariant) {
    priceNode = <span className="text-2xl font-semibold">{formatCurrency(selectedVariant.priceCents)}</span>;
  } else if (allChosen) {
    priceNode = <span className="text-lg font-medium text-muted-foreground">{t("product.unavailable")}</span>;
  } else {
    priceNode = (
      <span className="text-2xl font-semibold">
        {t("product.from")} {formatCurrency(minVariantPrice)}
      </span>
    );
  }

  const canAdd = hasVariants ? !!selectedVariant && !variantOutOfStock : !baseOutOfStock;

  function onAdd() {
    if (!canAdd) return;
    const variantLabel = hasVariants
      ? product.optionTypes.map((tType) => selected[tType.name]).join(" / ")
      : undefined;
    add({
      productId: product.id,
      variantId: selectedVariant?.id,
      variantLabel,
      options: hasVariants ? product.optionTypes.map((tType) => ({ name: tType.name, value: selected[tType.name] })) : undefined,
      businessId: business.id,
      businessName: business.name,
      businessSlug: business.slug,
      name: product.name,
      slug: product.slug,
      priceCents: selectedVariant ? selectedVariant.priceCents : product.priceCents,
      weightOz: selectedVariant ? (selectedVariant.weightOz ?? product.weightOz) : product.weightOz,
      imageUrl: product.imageUrl,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="space-y-5">
      <div className="mt-3">{priceNode}</div>

      {/* Option pickers */}
      {hasVariants &&
        product.optionTypes.map((tType) => (
          <div key={tType.name}>
            <p className="text-sm font-medium">{tType.name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tType.values.map((val) => {
                const buyable = availableValues.get(tType.name)?.has(val) ?? false;
                const active = selected[tType.name] === val;
                return (
                  <button
                    key={val}
                    type="button"
                    disabled={!buyable}
                    onClick={() => setSelected((s) => ({ ...s, [tType.name]: val }))}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-sm transition",
                      active ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/60",
                      !buyable && "cursor-not-allowed opacity-40",
                    )}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

      {/* Add to cart */}
      {(hasVariants ? false : baseOutOfStock) ? (
        <Button size="lg" variant="outline" disabled>
          {t("common.outOfStock")}
        </Button>
      ) : (
        <Button size="lg" disabled={!canAdd} onClick={onAdd}>
          {added ? <Check className="size-4" /> : <ShoppingCart className="size-4" />}
          {added
            ? t("common.added")
            : hasVariants && !selectedVariant
              ? t("product.chooseOptions")
              : variantOutOfStock
                ? t("common.outOfStock")
                : t("common.addToCart")}
        </Button>
      )}
    </div>
  );
}
