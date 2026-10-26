import catalog from "../data/catalog.json";
import mediaIndex from "../data/media-index.json";
import { modelSlug } from "./product-links";

export type ProductPhoto = {
  src: string;
  alt: string;
  view: string;
  sourceUrl?: string;
  colorLabel?: string;
};
export type ProductColor = {
  key: string;
  label: string;
  hex: string;
  images: ProductPhoto[];
};
export type ProductMedia = {
  sourceUrl: string;
  sourceName: string;
  status: string;
  note?: string;
  images?: ProductPhoto[];
  colors: ProductColor[];
};
export type PublicProduct = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  storage: string | null;
  ram?: string | null;
  condition: string;
  region: string;
  price: number;
  category: string;
  note: string;
  grade?: string;
  color?: string;
  bundle?: string;
  image: string;
  colors: ProductColor[];
  mediaSource?: string;
  mediaStatus: string;
};
export function getPublicCatalog(detailSlug?: string): PublicProduct[] {
  const media = mediaIndex as Record<string, ProductMedia>;
  return catalog
    .map((p) => {
      const photo = media[`${p.brand}|${p.model}`];
      const slug = modelSlug(p.brand, p.model);
      const bundle = "bundle" in p ? p.bundle : undefined;
      const colors = (photo?.colors || [])
        .filter((c) => c.images.length > 0)
        .map((c) => ({
          key: c.key,
          label: c.label,
          hex: c.hex,
          images: [...c.images, ...(photo?.images || [])]
            .filter(
              (image, i, all) =>
                all.findIndex((p) => p.src === image.src) === i,
            )
            .slice(0, detailSlug === slug ? 4 : 1)
            .map((image) => ({
              src: image.src,
              alt: image.alt,
              view: image.view,
              ...(image.colorLabel ? { colorLabel: image.colorLabel } : {}),
            })),
        }));
      return {
        id: p.id,
        slug,
        brand: p.brand,
        model: p.model,
        storage: p.storage,
        ram: "ram" in p ? p.ram : undefined,
        condition: p.condition,
        region: p.region,
        price: p.price,
        category: p.category,
        note: p.note,
        ...(bundle ? { bundle } : {}),
        grade: "grade" in p ? p.grade : undefined,
        color: "color" in p ? p.color : undefined,
        image: colors[0]?.images[0]?.src || "",
        colors,
        mediaSource: photo?.sourceName,
        mediaStatus: photo?.status || "pending",
      };
    });
}
