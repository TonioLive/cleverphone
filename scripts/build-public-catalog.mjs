// Genera data/catalog.json (público) a partir de private/catalog.private.json.
// El archivo privado contiene costes y márgenes del proveedor y NO se versiona.
// Uso: node scripts/build-public-catalog.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const SRC = new URL("../private/catalog.private.json", import.meta.url);
const OUT = new URL("../data/catalog.json", import.meta.url);
if (!existsSync(SRC)) {
  console.error("Falta private/catalog.private.json (no se versiona). Pídelo al responsable del catálogo.");
  process.exit(1);
}
const PUBLIC_FIELDS = [
  "id", "brand", "model", "storage", "ram", "condition", "region", "price",
  "category", "note", "grade", "color", "batteryRange", "verified",
  "availabilityStatus",
];
const rows = JSON.parse(readFileSync(SRC, "utf8"));
const out = rows
  .filter((p) => !p.hidden)
  .map((p) => {
    const row = {};
    for (const k of PUBLIC_FIELDS) if (k in p) row[k] = p[k];
    if (p.brand === "Qubo" && ["X340 4G", "XD340 4G"].includes(p.model))
      row.bundle = /CON BASE/i.test(p.sourceLabel || "") ? "Con base de carga" : "Sin base de carga";
    return row;
  });
writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`data/catalog.json: ${out.length} productos públicos (${rows.length - out.length} ocultos excluidos)`);
