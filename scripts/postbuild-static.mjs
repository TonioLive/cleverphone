// Tras `next build` estático: sitemap.xml, robots.txt y .nojekyll en ./out
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = "out";
const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
if (!existsSync(OUT)) throw new Error("No existe ./out; ejecuta antes el build estático.");

const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!name.startsWith("_")) walk(p); }
    else if (name === "index.html") pages.push("/" + relative(OUT, dir).replaceAll("\\", "/"));
  }
})(OUT);

// Las URL por SKU son alias de la página del modelo: fuera del sitemap.
const canonical = pages
  .map((p) => (p === "/" ? "/" : p + "/"))
  .filter((p) => !/^\/producto\/.*-(new|refurbished)-/.test(p))
  .filter((p) => !/^\/(404|_not-found)\//.test(p))
  .sort();
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  canonical.map((p) => `  <url><loc>${site}${p}</loc><lastmod>${today}</lastmod></url>`).join("\n") +
  `\n</urlset>\n`);
writeFileSync(join(OUT, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
writeFileSync(join(OUT, ".nojekyll"), "");
console.log(`sitemap.xml: ${canonical.length} URL · robots.txt · .nojekyll`);
