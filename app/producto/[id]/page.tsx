import Storefront from "../../storefront";
import { getPublicCatalog } from "@/lib/catalog";
import { notFound } from "next/navigation";

type RouteProps = { params: Promise<{ id: string }> };

export const dynamicParams = false;

// Una página por modelo y otra por SKU (las URL antiguas por SKU siguen resolviendo).
export function generateStaticParams() {
  const products = getPublicCatalog();
  const ids = new Set<string>();
  for (const p of products) {
    ids.add(p.slug);
    ids.add(p.id);
  }
  return Array.from(ids, (id) => ({ id }));
}

function resolveProduct(id: string) {
  const candidates = getPublicCatalog().filter(
    (p) => p.slug === id || p.id === id,
  );
  const base = candidates.find((p) => p.id === id) || candidates[0];
  if (!base) return { products: [], product: undefined };
  const products = getPublicCatalog(base.slug);
  return { products, product: products.find((p) => p.id === base.id) };
}

export async function generateMetadata({ params }: RouteProps) {
  const { id } = await params;
  const { product: p } = resolveProduct(id);
  if (!p) return { title: "Producto | CleverPhone" };
  const title = `${p.brand === "Apple" ? "" : p.brand + " "}${p.model}${p.storage ? " " + p.storage : ""} ${p.condition === "new" ? "nuevo" : "segunda mano"}`;
  const description = `${p.brand} ${p.model}: fotos del modelo, colores, capacidades y precio con IVA incluido en CleverPhone.`;
  return {
    title: `${title} | CleverPhone`,
    description,
    alternates: { canonical: `/producto/${p.slug}/` },
    openGraph: {
      title,
      description,
      images: p.image ? [{ url: p.image }] : undefined,
    },
  };
}

export default async function Product({ params }: RouteProps) {
  const { id } = await params;
  const { products, product } = resolveProduct(id);
  if (!product) notFound();
  return (
    <Storefront
      products={products}
      initialProductId={product.id}
      initialCondition={product.condition}
      view="product"
    />
  );
}
