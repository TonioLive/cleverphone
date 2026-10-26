"use client";
import { withBase } from "@/lib/base-path";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Heart,
  Lock,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import type { ProductColor, PublicProduct } from "@/lib/catalog";
import ProductGallery from "./product-gallery";
import {
  getModelVariants,
  getStorageOptions,
  resolveProductVariant,
} from "@/lib/product-variants";

const euro = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n,
  );
const ramLabel = (ram: string) =>
  `${ram} ${ram.includes("+") ? "RAM combinada" : "RAM"}`;
type Props = {
  product: PublicProduct;
  products: PublicProduct[];
  color?: ProductColor;
  isFavorite: boolean;
  onColor: (key: string) => void;
  onVariant: (id: string) => void;
  onAdd: () => void;
  onFavorite: () => void;
  onInfo: (key: string) => void;
  renderCard: (p: PublicProduct) => React.ReactNode;
};
export default function ProductPage({
  product: p,
  products,
  color,
  isFavorite,
  onColor,
  onVariant,
  onAdd,
  onFavorite,
  onInfo,
  renderCard,
}: Props) {
  const [tab, setTab] = useState("details");
  const variants = getModelVariants(products, p);
  const capacities = getStorageOptions(products, p, color?.key);
  const showRamInOptions =
    new Set(capacities.map((option) => option.ram)).size > 1;
  const bundles = Array.from(
    new Set(variants.map((v) => v.bundle).filter(Boolean)),
  );
  const regions = Array.from(new Set(variants.map((v) => v.region))).filter(
    (r) => r !== "Sin confirmar",
  );
  const related = products
    .filter(
      (v) =>
        v.id !== p.id &&
        v.slug !== p.slug &&
        v.category === p.category &&
        v.condition === p.condition,
    )
    .sort((a, b) => Math.abs(a.price - p.price) - Math.abs(b.price - p.price))
    .filter((v, i, a) => a.findIndex((x) => x.slug === v.slug) === i)
    .slice(0, 4);
  return (
    <main className="product-page-main">
      <div className="product-page-breadcrumb section-wrap">
        <a href={withBase("/")}>Inicio</a>
        <span>/</span>
        <a
          href={
            p.condition === "new"
              ? withBase("/moviles/nuevos/")
              : withBase("/moviles/reacondicionados/")
          }
        >
          {p.condition === "new" ? "Móviles nuevos" : "Reacondicionados"}
        </a>
        <span>/</span>
        <span>{p.model}</span>
      </div>
      <section className="pdp-shell section-wrap">
        <div className="pdp-gallery-column">
          <ProductGallery
            color={color}
            model={`${p.brand === "Apple" ? "" : p.brand + " "}${p.model}`}
            condition={p.condition}
          />
        </div>
        <div className="pdp-copy">
          <div className="pdp-topline">
            <span
              className={
                "status-pill " + (p.condition === "new" ? "new" : "renewed")
              }
            >
              {p.condition === "new" ? "Nuevo" : "Segunda mano"}
            </span>
            <button
              className={"icon-button favorite " + (isFavorite ? "active" : "")}
              onClick={onFavorite}
              aria-label={
                isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"
              }
            >
              <Heart size={20} />
            </button>
          </div>
          <div className="product-brand">{p.brand}</div>
          <h1>{p.model}</h1>
          <p className="pdp-subtitle">
            {p.storage}
            {p.ram
              ? ` · ${p.ram} ${p.ram.includes("+") ? "RAM combinada" : "RAM"}`
              : ""}
            {p.region === "EU" ? " · Versión europea" : ""}
            {p.bundle ? ` · ${p.bundle}` : ""}
          </p>
          <button
            className="pdp-review-link"
            onClick={() => {
              setTab("reviews");
              document
                .getElementById("product-information")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <Star size={15} /> Aún sin opiniones <ArrowRight size={13} />
          </button>
          <div className="pdp-price">
            {euro(p.price)}
            <span>IVA incluido · PVP propuesto</span>
          </div>
          {capacities.length > 0 && (
            <fieldset className="pdp-options">
              <legend>
                Capacidad <span>{p.storage}</span>
              </legend>
              <div className="capacity-options">
                {capacities.map((option) => {
                  const selected =
                    p.storage === option.storage &&
                    (p.ram ?? null) === option.ram;
                  return (
                    <button
                      key={option.key}
                      className={selected ? "selected" : ""}
                      aria-pressed={selected}
                      aria-label={`${option.storage}${option.ram ? `, ${ramLabel(option.ram)}` : ""}, ${euro(option.product.price)}${option.product.region !== p.region ? `, versión ${option.product.region}` : ""}`}
                      onClick={() => onVariant(option.product.id)}
                    >
                      <span className="capacity-option-copy">
                        <b>{option.storage}</b>
                        {showRamInOptions && option.ram && (
                          <small>{ramLabel(option.ram)}</small>
                        )}
                        {option.product.region !== p.region && (
                          <small>Versión {option.product.region}</small>
                        )}
                        {option.product.bundle !== p.bundle && (
                          <small>{option.product.bundle}</small>
                        )}
                        <small>{euro(option.product.price)}</small>
                      </span>
                      {selected && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {p.colors.length > 0 && (
            <fieldset className="pdp-options">
              <legend>
                Color <span>{color?.label}</span>
              </legend>
              <div className="pdp-color-options">
                {p.colors.map((c) => (
                  <button
                    key={c.key}
                    className={color?.key === c.key ? "selected" : ""}
                    aria-label={`Seleccionar color ${c.label}`}
                    aria-pressed={color?.key === c.key}
                    onClick={() => onColor(c.key)}
                  >
                    <i style={{ backgroundColor: c.hex }} />
                    <span>{c.label}</span>
                    {color?.key === c.key && <Check size={13} />}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {regions.length > 1 && (
            <fieldset className="pdp-options">
              <legend>
                Versión <span>{p.region}</span>
              </legend>
              <div className="capacity-options">
                {regions.map((region) => {
                  const variant = resolveProductVariant(
                    variants,
                    p,
                    { region },
                    color?.key,
                  );
                  return (
                    <button
                      key={region}
                      aria-pressed={p.region === region}
                      className={p.region === region ? "selected" : ""}
                      disabled={!variant}
                      onClick={() => variant && onVariant(variant.id)}
                    >
                      <span className="capacity-option-copy">
                        <b>{region}</b>
                        {variant && variant.storage !== p.storage && (
                          <small>{variant.storage}</small>
                        )}
                        {variant?.ram && variant.ram !== p.ram && (
                          <small>{ramLabel(variant.ram)}</small>
                        )}
                        {variant && <small>{euro(variant.price)}</small>}
                      </span>
                      {p.region === region && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {bundles.length > 1 && (
            <fieldset className="pdp-options">
              <legend>
                Base de carga <span>{p.bundle}</span>
              </legend>
              <div className="capacity-options">
                {bundles.map((bundle) => {
                  const variant = resolveProductVariant(
                    variants,
                    p,
                    { bundle },
                    color?.key,
                  );
                  return (
                    <button
                      key={bundle}
                      className={p.bundle === bundle ? "selected" : ""}
                      aria-pressed={p.bundle === bundle}
                      disabled={!variant}
                      onClick={() => variant && onVariant(variant.id)}
                    >
                      <span className="capacity-option-copy">
                        <b>{bundle}</b>
                        {variant && <small>{euro(variant.price)}</small>}
                      </span>
                      {p.bundle === bundle && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          {p.grade && (
            <div className="pdp-condition">
              <ShieldCheck size={18} />
              <div>
                <b>Estado {p.grade}</b>
                <span>
                  Consulta el estado y la batería de la unidad antes de comprar.
                </span>
              </div>
            </div>
          )}
          <button className="button primary pdp-add" onClick={onAdd}>
            <ShoppingBag size={19} /> Añadir al carrito <Plus size={19} />
          </button>
          <div className="pdp-purchase-note">
            <Lock size={13} /> Tu selección se guarda con el color elegido.
          </div>
          <div className="pdp-assurances">
            <button onClick={() => onInfo("garantia")}>
              <ShieldCheck size={20} />
              <span>
                Garantía legal<small>Consulta las condiciones</small>
              </span>
            </button>
            <button onClick={() => onInfo("envio")}>
              <Truck size={20} />
              <span>
                Envío transparente<small>Total visible en el carrito</small>
              </span>
            </button>
            <button onClick={() => onInfo("garantia")}>
              <RotateCcw size={20} />
              <span>
                14 días para decidir<small>Desistimiento online</small>
              </span>
            </button>
          </div>
        </div>
      </section>
      <section
        className="pdp-information section-wrap"
        id="product-information"
      >
        <div className="detail-tabs">
          <button
            className={tab === "details" ? "selected" : ""}
            onClick={() => setTab("details")}
          >
            Detalles del producto
          </button>
          <button
            className={tab === "reviews" ? "selected" : ""}
            onClick={() => setTab("reviews")}
          >
            Opiniones (0)
          </button>
        </div>
        {tab === "details" ? (
          <div className="details-content">
            <div>
              <span className="eyebrow">CADA DETALLE CUENTA</span>
              <h2>Conoce tu próximo {p.model}.</h2>
              <p>
                {p.condition === "new"
                  ? `${p.brand} ${p.model}${p.storage ? `, con ${p.storage} de almacenamiento` : ""}. Elige la configuración y el color que más encajan contigo.`
                  : p.note}
              </p>
              {p.condition === "new" && p.region === "NO EU" && (
                <p>
                  Versión NO EU según el catálogo. Consulta la referencia
                  regional, conectividad y condiciones de garantía antes de
                  comprar.
                </p>
              )}
              <p>
                {p.condition === "refurbished"
                  ? "Las fotografías son imágenes de catálogo del modelo. No muestran el desgaste ni la batería de la unidad concreta."
                  : "Las fotografías son de catálogo del modelo. El pie de cada imagen identifica el acabado y los detalles ampliados. El contenido de la caja se confirmará en la ficha definitiva."}
              </p>
            </div>
            <dl>
              <div>
                <dt>Marca</dt>
                <dd>{p.brand}</dd>
              </div>
              <div>
                <dt>Modelo</dt>
                <dd>{p.model}</dd>
              </div>
              <div>
                <dt>Almacenamiento</dt>
                <dd>{p.storage || "No indicado"}</dd>
              </div>
              {p.ram && (
                <div>
                  <dt>
                    {p.ram.includes("+")
                      ? "RAM anunciada combinada"
                      : "Memoria RAM"}
                  </dt>
                  <dd>{p.ram}</dd>
                </div>
              )}
              <div>
                <dt>Color seleccionado</dt>
                <dd>{color?.label || p.color || "Sin preferencia"}</dd>
              </div>
              {p.bundle && (
                <div>
                  <dt>Base de carga</dt>
                  <dd>{p.bundle}</dd>
                </div>
              )}
              <div>
                <dt>Estado</dt>
                <dd>{p.condition === "new" ? "Nuevo" : "Segunda mano"}</dd>
              </div>
              <div>
                <dt>Versión</dt>
                <dd>{p.region}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="review-empty">
            <Star size={30} />
            <h2>Las primeras opiniones están por llegar.</h2>
            <p>
              Aún no hay reseñas de compradores de este producto en CleverPhone.
              Cada futura opinión indicará su origen y si corresponde a una
              compra verificada.
            </p>
            <button className="text-button" onClick={() => onInfo("reviews")}>
              Sobre nuestras opiniones <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
      {related.length > 0 && (
        <section className="pdp-related section-wrap">
          <div className="section-top">
            <div>
              <span className="eyebrow">OTRAS BUENAS ELECCIONES</span>
              <h2>También encajan contigo.</h2>
            </div>
            <a
              href={
                p.condition === "new"
                  ? withBase("/moviles/nuevos/")
                  : withBase("/moviles/reacondicionados/")
              }
              className="text-button"
            >
              Ver todos <ArrowRight size={16} />
            </a>
          </div>
          <div className="product-grid">{related.map(renderCard)}</div>
        </section>
      )}
      <div className="mobile-buy-bar">
        <div>
          <b>{euro(p.price)}</b>
          <small>{color?.label || p.storage} · IVA incluido</small>
        </div>
        <button
          className="button primary"
          aria-label="Añadir al carrito desde barra"
          onClick={onAdd}
        >
          <ShoppingBag size={17} /> Añadir
        </button>
      </div>
    </main>
  );
}
