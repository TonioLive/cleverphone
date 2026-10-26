import type { PublicProduct } from "./catalog";
import { colorFamily } from "./product-colors.ts";

export type VariantSelection = Partial<
  Pick<PublicProduct, "storage" | "ram" | "region" | "bundle">
>;

/** A product family never mixes hardware models, condition or used grades. */
export function getModelVariants(
  products: PublicProduct[],
  base: PublicProduct,
): PublicProduct[] {
  return products.filter(
    (p) =>
      !("hidden" in p && p.hidden) &&
      p.brand === base.brand &&
      p.model === base.model &&
      p.slug === base.slug &&
      p.condition === base.condition &&
      p.grade === base.grade,
  );
}

export function listedColorMatches(listed: string, label: string) {
  return listed
    .split(/\s*\/\s*|\s*,\s*/)
    .some((part) => colorFamily(part) === colorFamily(label));
}

export function resolveColorVariant(
  products: PublicProduct[],
  base: PublicProduct,
  colorKey?: string,
): PublicProduct {
  const color =
    base.colors.find((color) => color.key === colorKey) ||
    base.colors.find(
      (color) => base.color && listedColorMatches(base.color, color.label),
    ) ||
    base.colors[0];
  if (!color) return base;
  const candidates = getModelVariants(products, base).filter(
    (p) =>
      p.storage === base.storage &&
      p.ram === base.ram &&
      p.region === base.region &&
      p.bundle === base.bundle,
  );
  return (
    candidates.find(
      (p) => p.color && listedColorMatches(p.color, color.label),
    ) ||
    candidates.find((p) => !p.color) ||
    base
  );
}

/**
 * Requested dimensions are exact. Unrequested dimensions are preserved where
 * the catalogue allows it; the returned SKU exposes any necessary change.
 * No configuration or price is synthesized.
 */
export function resolveProductVariant(
  products: PublicProduct[],
  base: PublicProduct,
  selection: VariantSelection,
  colorKey?: string,
): PublicProduct | undefined {
  const candidates = getModelVariants(products, base).filter((p) =>
    Object.entries(selection).every(
      ([field, value]) =>
        (p[field as keyof VariantSelection] ?? null) === (value ?? null),
    ),
  );
  const weights = { storage: 64, bundle: 32, region: 16, ram: 8 };
  const preservationScore = (p: PublicProduct) =>
    Object.entries(weights).reduce(
      (score, [field, weight]) =>
        score +
        ((p[field as keyof VariantSelection] ?? null) ===
        (base[field as keyof VariantSelection] ?? null)
          ? weight
          : 0),
      0,
    );
  const candidate = candidates.sort(
    (a, b) =>
      preservationScore(b) - preservationScore(a) ||
      Number(b.id === base.id) - Number(a.id === base.id) ||
      a.price - b.price ||
      a.id.localeCompare(b.id),
  )[0];
  return candidate
    ? resolveColorVariant(candidates, candidate, colorKey)
    : undefined;
}

export type StorageOption = {
  key: string;
  storage: string;
  ram: string | null;
  product: PublicProduct;
};

function memorySize(value: string) {
  const number = parseFloat(value);
  return number * (/TB/i.test(value) ? 1024 : 1);
}

/** Keep RAM in the option identity so equal capacities never hide a RAM SKU. */
export function getStorageOptions(
  products: PublicProduct[],
  base: PublicProduct,
  colorKey?: string,
): StorageOption[] {
  const options = new Map<string, StorageOption>();
  for (const variant of getModelVariants(products, base)) {
    if (!variant.storage) continue;
    const ram = variant.ram ?? null;
    const key = JSON.stringify([variant.storage, ram]);
    if (options.has(key)) continue;
    const product = resolveProductVariant(
      products,
      base,
      { storage: variant.storage, ram },
      colorKey,
    );
    if (product)
      options.set(key, { key, storage: variant.storage, ram, product });
  }
  return [...options.values()].sort(
    (a, b) =>
      memorySize(a.storage) - memorySize(b.storage) ||
      memorySize(a.ram || "0") - memorySize(b.ram || "0") ||
      a.key.localeCompare(b.key),
  );
}
