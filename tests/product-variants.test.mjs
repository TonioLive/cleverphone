import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveColorVariant,
  listedColorMatches,
  getModelVariants,
  getStorageOptions,
  resolveProductVariant,
} from "../lib/product-variants.ts";
const catalog = JSON.parse(
  readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"),
);
const colors = [
  { key: "purple", label: "Lila", hex: "#b4a6ce", images: [] },
  { key: "blue", label: "Azul", hex: "#8aa7ca", images: [] },
];
const a57 = catalog
  .filter((p) => p.brand === "Samsung" && p.model === "A57 5G")
  .map((p) => ({ ...p, slug: "samsung-a57-5g", colors }));
const base256 = a57.find((p) => p.storage === "256 GB" && !p.color);
const purple256 = a57.find(
  (p) => p.storage === "256 GB" && p.color === "Violeta",
);
const base128 = a57.find((p) => p.storage === "128 GB");

test("choosing the special colour selects its own SKU and price", () => {
  const selected = resolveColorVariant(a57, base256, "purple");
  assert.equal(selected.id, purple256.id);
  assert.equal(selected.price, purple256.price);
});
test("leaving a special colour restores the regular SKU price", () => {
  const selected = resolveColorVariant(a57, purple256, "blue");
  assert.equal(selected.id, base256.id);
  assert.equal(selected.price, base256.price);
});
test("a capacity change keeps the selected colour price reference", () => {
  assert.equal(resolveColorVariant(a57, base128, "purple").id, base128.id);
  assert.equal(resolveColorVariant(a57, base256, "purple").id, purple256.id);
});
test("supplier combined colours and the official glacier label resolve consistently", () => {
  assert.equal(
    listedColorMatches("Azul / Negro · por confirmar", "Negro"),
    true,
  );
  assert.equal(
    listedColorMatches("Azul / Negro · por confirmar", "Glaciar"),
    true,
  );
  assert.equal(listedColorMatches("Burgandy · según lista", "Burdeos"), true);
});
test("changing colour never swaps a charging-base bundle", () => {
  const without = {
    ...base256,
    id: "phone-only",
    color: undefined,
    bundle: "Sin base de carga",
  };
  const withBase = {
    ...without,
    id: "with-base",
    bundle: "Con base de carga",
    price: 200,
  };
  const special = {
    ...withBase,
    id: "with-base-purple",
    color: "Violeta",
    price: 210,
  };
  assert.equal(
    resolveColorVariant([without, withBase, special], without, "purple").id,
    "phone-only",
  );
  assert.equal(
    resolveColorVariant([without, withBase, special], withBase, "purple").id,
    "with-base-purple",
  );
});

test("default visual colour and a direct URL without colour use the same SKU", () => {
  assert.equal(resolveColorVariant(a57, base256).id, purple256.id);
  assert.equal(resolveColorVariant(a57, purple256).id, purple256.id);
});

const publicCatalog = catalog
  .filter((p) => !p.hidden)
  .map((p) => ({
    ...p,
    slug: `${p.brand}|${p.model}`,
    colors: [],
    bundle:
      p.brand === "Qubo" && ["X340 4G", "XD340 4G"].includes(p.model)
        ? /CON BASE/i.test(p.sourceLabel)
          ? "Con base de carga"
          : "Sin base de carga"
        : undefined,
  }));

test("all catalogue capacity and RAM choices resolve to an existing exact-price SKU", () => {
  for (const base of publicCatalog) {
    const variants = getModelVariants(publicCatalog, base);
    const expected = new Set(
      variants
        .filter((v) => v.storage)
        .map((v) => JSON.stringify([v.storage, v.ram ?? null])),
    );
    const options = getStorageOptions(publicCatalog, base);
    assert.deepEqual(new Set(options.map((o) => o.key)), expected, base.model);
    for (const option of options) {
      const source = variants.find((p) => p.id === option.product.id);
      assert.ok(source, `${base.model}: ${option.key} is a listed SKU`);
      assert.equal(source.storage, option.storage);
      assert.equal(source.ram ?? null, option.ram);
      assert.equal(source.price, option.product.price);
      assert.equal(source.condition, base.condition);
      assert.equal(source.grade, base.grade);
    }
  }
});

test("capacity prices follow the selected colour including its supplier surcharge", () => {
  const purpleOptions = getStorageOptions(a57, base128, "purple");
  const blueOptions = getStorageOptions(a57, base128, "blue");
  assert.equal(purpleOptions.find((o) => o.storage === "256 GB").product.price, 410.9);
  assert.equal(blueOptions.find((o) => o.storage === "256 GB").product.price, 404.9);
  assert.equal(purpleOptions.find((o) => o.storage === "128 GB").product.price, 362.9);
});

test("a capacity change preserves the region when listed and exposes the real RAM", () => {
  const base = publicCatalog.find(
    (p) => p.brand === "Samsung" && p.model === "A17" && p.storage === "256 GB",
  );
  const selected = resolveProductVariant(publicCatalog, base, { storage: "128 GB" });
  assert.equal(selected.region, "NO EU");
  assert.equal(selected.ram, "4 GB");
  assert.equal(selected.price, 174.9);
});

test("a region change uses the available exact SKU instead of inventing capacity or price", () => {
  const base = publicCatalog.find(
    (p) => p.brand === "Samsung" && p.model === "A17" && p.storage === "256 GB",
  );
  const selected = resolveProductVariant(publicCatalog, base, { region: "EU" });
  assert.equal(selected.storage, "128 GB");
  assert.equal(selected.ram, "4 GB");
  assert.equal(selected.price, 182.9);
  const unavailable = resolveProductVariant(publicCatalog, base, {
    storage: "256 GB",
    region: "EU",
  });
  assert.equal(unavailable, undefined);
});

test("the same capacity with different RAM remains two explicit configurations", () => {
  const low = { ...base128, id: "same-storage-4", ram: "4 GB" };
  const high = { ...base128, id: "same-storage-8", ram: "8 GB", price: 400 };
  const options = getStorageOptions([low, high], low, "blue");
  assert.equal(options.length, 2);
  assert.deepEqual(options.map((o) => o.ram), ["4 GB", "8 GB"]);
  assert.equal(resolveProductVariant([low, high], low, { ram: "8 GB" }, "blue").id, high.id);
});

test("variant families never mix model, condition, used grade or hidden listings", () => {
  const renewed = { ...base128, id: "renewed", condition: "refurbished", grade: "A" };
  const wrongGrade = { ...renewed, id: "renewed-b", grade: "B" };
  const wrongModel = { ...renewed, id: "other-model", model: "A57 Ultra" };
  const wrongBrand = { ...renewed, id: "other-brand", brand: "Another" };
  const hidden = { ...renewed, id: "hidden", hidden: true };
  const all = [base128, renewed, wrongGrade, wrongModel, wrongBrand, hidden];
  assert.deepEqual(getModelVariants(all, renewed).map((p) => p.id), [renewed.id]);
  assert.equal(resolveProductVariant(all, renewed, { storage: "1 TB" }), undefined);
});

test("capacity resolution preserves a charging bundle and its true colour price", () => {
  const phoneOnly = { ...base128, id: "128-no-base", bundle: "Sin base de carga" };
  const base128Bundle = { ...phoneOnly, id: "128-base", bundle: "Con base de carga" };
  const base256Bundle = { ...base256, id: "256-base", bundle: "Con base de carga" };
  const purple256Bundle = { ...purple256, id: "256-base-purple", bundle: "Con base de carga" };
  const all = [phoneOnly, base128Bundle, base256Bundle, purple256Bundle];
  const selected = resolveProductVariant(all, base128Bundle, { storage: "256 GB" }, "purple");
  assert.equal(selected.id, purple256Bundle.id);
  assert.equal(selected.bundle, "Con base de carga");
  assert.equal(selected.price, purple256.price);
});

test("capacity options put terabytes after gigabytes", () => {
  const options = ["1 TB", "128 GB", "512 GB", "256 GB"].map((storage) => ({
    ...base128,
    id: `capacity-${storage}`,
    storage,
  }));
  assert.deepEqual(getStorageOptions(options, options[0]).map((o) => o.storage), [
    "128 GB", "256 GB", "512 GB", "1 TB",
  ]);
});
