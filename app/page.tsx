import Storefront from "./storefront";
import { getPublicCatalog } from "@/lib/catalog";
export default function Home() {
  return <Storefront products={getPublicCatalog()} />;
}
