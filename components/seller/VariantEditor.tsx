"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const MAX_TYPES = 3;

/** Editing shapes (strings for inputs) — converted to cents/ints on submit by the parent. */
export interface OptionTypeDraft {
  name: string;
  valuesText: string; // comma-separated values while editing
}
export interface VariantDraft {
  id?: string; // existing subdoc _id (edit) — sent back so the server merge keeps it
  options: { name: string; value: string }[];
  price: string; // dollars
  stock: string;
  weight: string;
  sku: string;
  isActive: boolean;
}
export interface VariantEditorValue {
  optionTypes: OptionTypeDraft[];
  variants: VariantDraft[];
}

/** Order-independent signature identifying one combination. */
export function comboSig(options: { name: string; value: string }[]): string {
  return [...options]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => `${o.name}=${o.value}`)
    .join("|");
}

/** Cartesian product of the option types' values → one option list per combination. */
function cartesian(types: { name: string; values: string[] }[]): { name: string; value: string }[][] {
  return types.reduce<{ name: string; value: string }[][]>(
    (acc, t) => acc.flatMap((combo) => t.values.map((v) => [...combo, { name: t.name, value: v }])),
    [[]],
  );
}

/**
 * Optional per-product options + generated variant grid. Fully controlled: reports every
 * change up via `onChange`. Leaving it empty keeps the product a simple single-price item.
 */
export function VariantEditor({
  value,
  onChange,
  basePrice,
}: {
  value: VariantEditorValue;
  onChange: (v: VariantEditorValue) => void;
  basePrice: string;
}) {
  const { optionTypes, variants } = value;

  const setTypes = (next: OptionTypeDraft[]) => onChange({ optionTypes: next, variants });
  const addType = () => optionTypes.length < MAX_TYPES && setTypes([...optionTypes, { name: "", valuesText: "" }]);
  const updateType = (i: number, patch: Partial<OptionTypeDraft>) =>
    setTypes(optionTypes.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const removeType = (i: number) => setTypes(optionTypes.filter((_, idx) => idx !== i));

  /** Build the combination grid, preserving any already-entered price/stock/id by signature. */
  function generate() {
    const clean = optionTypes
      .map((t) => ({ name: t.name.trim(), values: dedupe(t.valuesText) }))
      .filter((t) => t.name && t.values.length);
    if (!clean.length) {
      onChange({ optionTypes, variants: [] });
      return;
    }
    const bySig = new Map(variants.map((v) => [comboSig(v.options), v]));
    const next: VariantDraft[] = cartesian(clean).map((options) => {
      const existing = bySig.get(comboSig(options));
      return existing
        ? { ...existing, options }
        : { options, price: basePrice, stock: "0", weight: "", sku: "", isActive: true };
    });
    onChange({ optionTypes, variants: next });
  }

  const updateVariant = (i: number, patch: Partial<VariantDraft>) =>
    onChange({ optionTypes, variants: variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)) });
  const removeVariant = (i: number) =>
    onChange({ optionTypes, variants: variants.filter((_, idx) => idx !== i) });

  const rowLabel = (options: { name: string; value: string }[]) => options.map((o) => o.value).join(" / ");

  return (
    <fieldset className="space-y-4 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-medium">Options &amp; variants (optional)</legend>
      <p className="text-xs text-muted-foreground">
        Add options like <em>Size</em> or <em>Flavor</em>, then generate a row per combination — each with its own
        price and stock. Leave this empty for a simple single-price product.
      </p>

      {/* Option types */}
      <div className="space-y-3">
        {optionTypes.map((t, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <div>
              <Label>Option name</Label>
              <Input placeholder="Size" value={t.name} onChange={(e) => updateType(i, { name: e.target.value })} />
            </div>
            <div>
              <Label>Values (comma-separated)</Label>
              <Input placeholder="S, M, L" value={t.valuesText} onChange={(e) => updateType(i, { valuesText: e.target.value })} />
            </div>
            <Button type="button" variant="ghost" onClick={() => removeType(i)} aria-label="Remove option">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          {optionTypes.length < MAX_TYPES && (
            <Button type="button" variant="outline" size="sm" onClick={addType}>
              <Plus className="size-4" /> Add option
            </Button>
          )}
          {optionTypes.length > 0 && (
            <Button type="button" size="sm" onClick={generate}>
              Generate variants
            </Button>
          )}
        </div>
      </div>

      {/* Variant grid */}
      {variants.length > 0 && (
        <div className="space-y-2">
          <div className="hidden gap-2 px-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_1fr_auto]">
            <span>Variant</span>
            <span>Price (USD)</span>
            <span>Stock</span>
            <span>Wt (oz)</span>
            <span>SKU</span>
            <span className="text-right">On</span>
          </div>
          {variants.map((v, i) => (
            <div
              key={comboSig(v.options)}
              className={`grid gap-2 rounded-lg border p-2 sm:grid-cols-[1.4fr_0.9fr_0.7fr_0.7fr_1fr_auto] sm:items-center ${
                v.isActive ? "border-border" : "border-dashed opacity-60"
              }`}
            >
              <span className="text-sm font-medium">{rowLabel(v.options)}</span>
              <Input inputMode="decimal" aria-label="Price" value={v.price} onChange={(e) => updateVariant(i, { price: e.target.value })} />
              <Input inputMode="numeric" aria-label="Stock" value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })} />
              <Input inputMode="decimal" aria-label="Weight (oz)" value={v.weight} onChange={(e) => updateVariant(i, { weight: e.target.value })} />
              <Input aria-label="SKU" value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} />
              <div className="flex items-center justify-end gap-1">
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={v.isActive}
                  aria-label="Available for sale"
                  title="Available for sale"
                  onChange={(e) => updateVariant(i, { isActive: e.target.checked })}
                />
                <Button type="button" variant="ghost" size="sm" onClick={() => removeVariant(i)} aria-label="Remove variant">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/** Split a comma-separated value string into trimmed, de-duplicated values. */
function dedupe(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(",")) {
    const v = raw.trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}
