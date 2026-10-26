import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const root = process.cwd();
const merged = {};
for (const name of [
  "media-apple-samsung.json",
  "media-xiaomi-google.json",
  "media-other.json",
  "media-denver.json",
  "media-qubo-extra.json",
]) {
  try {
    Object.assign(
      merged,
      JSON.parse(await readFile(path.join(root, "data", name), "utf8")),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
for (const [model, media] of Object.entries(merged)) {
  const colors = new Set();
  const byHash = new Map();
  async function canonicalize(photos) {
    const seen = new Set(),
      out = [];
    for (const photo of photos || []) {
      const hash = createHash("sha256")
        .update(await readFile(path.join(root, "public", photo.src)))
        .digest("hex");
      if (seen.has(hash)) continue;
      seen.add(hash);
      const src = byHash.get(hash) || photo.src;
      byHash.set(hash, src);
      out.push({ ...photo, src });
    }
    return out;
  }
  media.images = await canonicalize(media.images);
  for (const color of media.colors || [])
    color.images = await canonicalize(color.images);
  for (const color of media.colors || []) {
    if (colors.has(color.key))
      throw new Error(`Repeated color ${model} ${color.key}`);
    colors.add(color.key);
    for (const photo of color.images || []) {
      if (!photo.src.startsWith("/images/products/"))
        throw new Error(`Unsafe path ${photo.src}`);
      await access(path.join(root, "public", photo.src));
    }
  }
  for (const photo of media.images || [])
    await access(path.join(root, "public", photo.src));
}
await writeFile(
  path.join(root, "data/media-index.json"),
  JSON.stringify(merged, null, 2) + "\n",
);
const catalog = JSON.parse(
  await readFile(path.join(root, "data/catalog.json"), "utf8"),
);
const models = [
  ...new Set(
    catalog.filter((p) => !p.hidden).map((p) => `${p.brand}|${p.model}`),
  ),
];
const report = {
  models: models.length,
  hidden: catalog.filter((p) => p.hidden).map((p) => `${p.brand}|${p.model}`),
  withPhotos: 0,
  withFourPhotos: 0,
  missing: [],
  partial: [],
};
for (const key of models) {
  const media = merged[key];
  const photos = new Set(
    [
      ...(media?.images || []),
      ...(media?.colors || []).flatMap((c) => c.images),
    ].map((p) => p.src),
  );
  if (photos.size) report.withPhotos++;
  if (photos.size >= 4) report.withFourPhotos++;
  else
    (photos.size ? report.partial : report.missing).push({
      model: key,
      photos: photos.size,
      note: media?.note || "",
    });
}
await writeFile(
  path.join(root, "data/media-coverage.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
