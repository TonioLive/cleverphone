import { withBase } from "./base-path";

export function modelSlug(brand: string, model: string) {
  return `${brand === "Apple" ? "" : brand + " "}${model}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function productPath(product: { slug: string; id: string }) {
  return withBase(
    `/producto/${product.slug}/?variante=${encodeURIComponent(product.id)}`,
  );
}
