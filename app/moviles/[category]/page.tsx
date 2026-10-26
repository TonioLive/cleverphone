import Storefront from "@/app/storefront";
import { getPublicCatalog } from "@/lib/catalog";
import { notFound } from "next/navigation";
const categories: Record<string, { condition: string; title: string }> = {
  nuevos: { condition: "new", title: "Móviles nuevos" },
  reacondicionados: {
    condition: "refurbished",
    title: "Móviles reacondicionados y segunda mano",
  },
  todos: { condition: "all", title: "Todos los móviles" },
};
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(categories).map((category) => ({ category }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  return {
    title: `${categories[category]?.title || "Catálogo"} | CleverPhone`,
    alternates: { canonical: `/moviles/${category}/` },
  };
}
export default async function Category({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const selected = Object.hasOwn(categories, category)
    ? categories[category]
    : undefined;
  if (!selected) notFound();
  return (
    <Storefront
      products={getPublicCatalog()}
      initialCondition={selected.condition}
      view="catalog"
    />
  );
}
