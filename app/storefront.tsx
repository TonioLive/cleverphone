"use client";
import { withBase } from "@/lib/base-path";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  Heart,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Truck,
  RotateCcw,
  X,
  Lock,
  Leaf,
  CheckCircle2,
  Star,
  ExternalLink,
} from "lucide-react";
import type { ProductColor, PublicProduct } from "@/lib/catalog";
import ProductPage from "@/components/product-page";
import { ProductPlaceholder } from "@/components/product-gallery";
import { productPath } from "@/lib/product-links";
import {
  listedColorMatches,
  resolveColorVariant,
  getStorageOptions,
} from "@/lib/product-variants";
type CartLine = {
  id: string;
  quantity: number;
  colorKey?: string;
  color?: string;
};
type Cart = CartLine[];
const lineKey = (c: Pick<CartLine, "id" | "colorKey">) =>
  `${c.id}::${c.colorKey || ""}`;
const euro = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    n,
  );
// En el sitio estático (GitHub Pages) no hay backend de pagos.
const CHECKOUT_ENABLED = process.env.NEXT_PUBLIC_CHECKOUT_ENABLED !== "0";
const conditions = [
  ["all", "Todos"],
  ["new", "Nuevos"],
  ["refurbished", "Reacondicionados"],
];
function Logo() {
  return (
    <span className="brand-mark">
      <span>c</span>
      <i />
    </span>
  );
}
export default function Storefront({
  products,
  initialProductId,
  initialCondition = "all",
  initialColorKey,
  view = "home",
}: {
  products: PublicProduct[];
  initialProductId?: string;
  initialCondition?: string;
  initialColorKey?: string;
  view?: "home" | "catalog" | "product";
}) {
  const [condition, setCondition] = useState(initialCondition),
    [brand, setBrand] = useState("Todas"),
    [search, setSearch] = useState(""),
    [budget, setBudget] = useState(2200),
    [sort, setSort] = useState("featured"),
    [category, setCategory] = useState("smartphone"),
    [region, setRegion] = useState("all"),
    [storage, setStorage] = useState("all"),
    [limit, setLimit] = useState(12),
    [filterOpen, setFilterOpen] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false);
  const [cart, setCart] = useState<Cart>([]),
    [hydrated, setHydrated] = useState(false),
    [cartOpen, setCartOpen] = useState(false),
    [activeProductId, setActiveProductId] = useState(() => {
      const p = products.find((p) => p.id === initialProductId);
      return p ? resolveColorVariant(products, p, initialColorKey).id : "";
    }),
    [info, setInfo] = useState(""),
    [toast, setToast] = useState(""),
    [favorites, setFavorites] = useState<string[]>([]),
    [onlyFavorites, setOnlyFavorites] = useState(false),
    [payState, setPayState] = useState(""),
    [payLoading, setPayLoading] = useState(false);
  const [colorSelections, setColorSelections] = useState<
    Record<string, string>
  >(() => {
    const p = products.find((p) => p.id === initialProductId);
    return p && initialColorKey ? { [p.slug]: initialColorKey } : {};
  });
  const checkoutAttempt = useRef<{ cart: string; key: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    product = products.find((p) => p.id === activeProductId);
  const allBrands = Array.from(new Set(products.map((p) => p.brand))),
    cartCount = cart.reduce((a, c) => a + c.quantity, 0),
    total = cart.reduce(
      (a, c) =>
        a + (products.find((p) => p.id === c.id)?.price || 0) * c.quantity,
      0,
    );
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("cleverphone-cart") || "[]",
      );
      if (Array.isArray(saved)) {
        const clean: Cart = [];
        let count = 0;
        for (const row of saved) {
          if (
            typeof row !== "object" ||
            row === null ||
            typeof row.id !== "string" ||
            !products.some((p) => p.id === row.id) ||
            !Number.isInteger(row.quantity) ||
            row.quantity < 1 ||
            count >= 20
          )
            continue;
          const p = products.find((p) => p.id === row.id)!;
          const color =
            p.colors.find((c) => c.key === row.colorKey) ||
            p.colors.find(
              (c) => p.color && listedColorMatches(p.color, c.label),
            ) ||
            p.colors[0];
          const canonical = resolveColorVariant(products, p, color?.key);
          const item = {
            id: canonical.id,
            ...(color ? { colorKey: color.key, color: color.label } : {}),
          };
          const old = clean.find((c) => lineKey(c) === lineKey(item));
          if (old) continue;
          const existing = clean
            .filter((c) => c.id === item.id)
            .reduce((n, c) => n + c.quantity, 0);
          const quantity = Math.min(5 - existing, row.quantity, 20 - count);
          if (quantity < 1) continue;
          clean.push({ ...item, quantity });
          count += quantity;
        }
        setCart(clean);
      }
      const f: unknown = JSON.parse(
        localStorage.getItem("cleverphone-favorites") || "[]",
      );
      if (Array.isArray(f))
        setFavorites(
          Array.from(
            new Set(
              f.filter(
                (id) =>
                  typeof id === "string" && products.some((p) => p.id === id),
              ),
            ),
          ),
        );
    } catch {}
    setHydrated(true);
    const q = new URLSearchParams(location.search);
    if (q.get("favoritos") === "1") {
      setOnlyFavorites(true);
      setCategory("all");
    }
    if (q.get("tipo") === "basic") setCategory("basic");
    if (q.get("checkout") === "cancelled") {
      setPayState("Has cancelado el pago. Tu selección sigue en el carrito.");
      setCartOpen(true);
      history.replaceState({}, "", location.pathname);
    }
    if (CHECKOUT_ENABLED && q.get("session_id")) {
      setCartOpen(true);
      setPayState("Comprobando el estado de tu pago…");
      const sessionId = q.get("session_id")!;
      let attempt = 0;
      const checkPayment = async () => {
        try {
          const r = await fetch(
            withBase("/api/checkout/status?session_id=") + encodeURIComponent(sessionId),
          );
          const d = (await r.json()) as { paid?: boolean; pending?: boolean };
          if (d.paid === true) {
            setPayState(
              "Pago confirmado por Stripe. Conserva el justificante de tu compra.",
            );
            try {
              const purchased: Cart = JSON.parse(
                sessionStorage.getItem("cleverphone-checkout-cart") || "[]",
              );
              if (Array.isArray(purchased))
                setCart((current) =>
                  current
                    .map((c) => ({
                      ...c,
                      quantity: Math.max(
                        0,
                        c.quantity -
                          (purchased.find((p) => lineKey(p) === lineKey(c))
                            ?.quantity || 0),
                      ),
                    }))
                    .filter((c) => c.quantity > 0),
                );
              sessionStorage.removeItem("cleverphone-checkout-cart");
              sessionStorage.removeItem("cleverphone-checkout-attempt");
            } catch {}
            history.replaceState({}, "", location.pathname);
          } else if (r.ok && attempt++ < 4) {
            setPayState(
              "El pago sigue en confirmación. Estamos consultando el estado…",
            );
            setTimeout(checkPayment, 2000);
          } else
            setPayState(
              "No hay un pago confirmado todavía. Consulta tu justificante antes de volver a pagar; puedes recargar para comprobarlo.",
            );
        } catch {
          setPayState(
            "No hemos podido verificar el pago. Consulta tu justificante antes de volver a pagar.",
          );
        }
      };
      void checkPayment();
    }
  }, [products]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem("cleverphone-cart", JSON.stringify(cart));
      } catch {}
  }, [cart, hydrated]);
  useEffect(() => {
    if (hydrated)
      try {
        localStorage.setItem(
          "cleverphone-favorites",
          JSON.stringify(favorites),
        );
      } catch {}
  }, [favorites, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    setCondition(initialCondition);
  }, [initialCondition]);
  useEffect(() => {
    setLimit(12);
  }, [
    condition,
    brand,
    search,
    budget,
    sort,
    category,
    region,
    storage,
    onlyFavorites,
  ]);
  useEffect(() => {
    // En el sitio estático la variante y el color llegan por la URL (?variante=…&color=…).
    const q = new URLSearchParams(window.location.search);
    const initial = products.find((p) => p.id === initialProductId);
    const variant = q.get("variante");
    const current =
      (variant &&
        products.find((p) => p.id === variant && p.slug === initial?.slug)) ||
      initial;
    const colorKey = q.get("color") || initialColorKey;
    setActiveProductId(
      current ? resolveColorVariant(products, current, colorKey).id : "",
    );
    if (current && colorKey && current.colors.some((c) => c.key === colorKey))
      setColorSelections((v) => ({ ...v, [current.slug]: colorKey }));
  }, [initialProductId, initialColorKey, products]);
  useEffect(() => {
    if (
      view !== "home" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const targets = document.querySelectorAll(
      ".section-top,.second-life,.trust-heading,.trust-grid>button,.closing-banner",
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    targets.forEach((el) => {
      el.classList.add("reveal-ready");
      observer.observe(el);
    });
    const hero = document.querySelector<HTMLElement>(".hero"),
      header = document.querySelector(".site-header");
    let ticking = false;
    const update = () => {
      const progress = Math.min(1, Math.max(0, window.scrollY / 650));
      hero?.style.setProperty("--hero-progress", String(progress));
      header?.classList.toggle("is-scrolled", window.scrollY > 30);
      if (header instanceof HTMLElement)
        header.style.setProperty(
          "--page-progress",
          String(
            window.scrollY /
              Math.max(
                1,
                document.documentElement.scrollHeight - window.innerHeight,
              ),
          ),
        );
      ticking = false;
    };
    const scroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      observer.disconnect();
      targets.forEach((el) => el.classList.remove("reveal-ready", "reveal-in"));
      window.removeEventListener("scroll", scroll);
    };
  }, [view]);
  const modalOpen = !!(cartOpen || info);
  useEffect(() => {
    const d = dialog.current;
    if (modalOpen && !d?.open) d?.showModal();
    if (!modalOpen && d?.open) d.close();
    document.body.style.overflow = modalOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalOpen]);
  function closeModal() {
    setCartOpen(false);
    setInfo("");
  }
  function chooseCondition(c: string) {
    window.location.assign(
      withBase(c === "all"
        ? "/moviles/todos/"
        : c === "new"
          ? "/moviles/nuevos/"
          : "/moviles/reacondicionados/"),
    );
  }
  function selectedColor(p: PublicProduct): ProductColor | undefined {
    return (
      p.colors.find((c) => c.key === colorSelections[p.slug]) ||
      p.colors.find((c) => p.color && listedColorMatches(p.color, c.label)) ||
      p.colors[0]
    );
  }
  function productForColor(p: PublicProduct, color?: ProductColor) {
    return resolveColorVariant(products, p, color?.key);
  }
  function selectColor(p: PublicProduct, key: string) {
    setColorSelections((v) => ({ ...v, [p.slug]: key }));
    if (view === "product") {
      const color = p.colors.find((c) => c.key === key),
        next = productForColor(p, color);
      setActiveProductId(next.id);
      history.replaceState(
        {},
        "",
        productPath(next) + "&color=" + encodeURIComponent(key),
      );
    }
  }
  function selectVariant(id: string) {
    const base = products.find((p) => p.id === id);
    if (!base) return;
    const c =
        product?.slug === base.slug
          ? selectedColor(product)
          : selectedColor(base),
      next = resolveColorVariant(products, base, c?.key);
    setActiveProductId(next.id);
    history.replaceState(
      {},
      "",
      productPath(next) + (c ? "&color=" + encodeURIComponent(c.key) : ""),
    );
  }
  function add(base: PublicProduct) {
    const color = selectedColor(base),
      p = resolveColorVariant(products, base, color?.key);
    if (cartCount >= 20) {
      setToast("Máximo 20 unidades en el carrito.");
      return;
    }
    const key = lineKey({ id: p.id, colorKey: color?.key });
    if (
      cart.filter((c) => c.id === p.id).reduce((n, c) => n + c.quantity, 0) >= 5
    ) {
      setToast("Máximo 5 unidades por modelo.");
      return;
    }
    setCart((c) =>
      c.some((x) => lineKey(x) === key)
        ? c.map((x) =>
            lineKey(x) === key ? { ...x, quantity: x.quantity + 1 } : x,
          )
        : [
            ...c,
            {
              id: p.id,
              quantity: 1,
              ...(color ? { colorKey: color.key, color: color.label } : {}),
            },
          ],
    );
    setToast(
      `${p.model}${color ? " · " + color.label : ""} añadido al carrito`,
    );
  }
  function favorite(id: string) {
    const base = products.find((p) => p.id === id);
    if (!base) return;
    const sameModel = (candidateId: string) => {
      const candidate = products.find((p) => p.id === candidateId);
      return candidate?.slug === base.slug && candidate.condition === base.condition && candidate.grade === base.grade;
    };
    setFavorites((f) => f.some(sameModel) ? f.filter((x) => !sameModel(x)) : [...f, id]);
  }
  function isFavoriteProduct(p: PublicProduct) {
    return favorites.some((id) => {
      const saved = products.find((candidate) => candidate.id === id);
      return saved?.slug === p.slug && saved.condition === p.condition && saved.grade === p.grade;
    });
  }
  const filtered = useMemo(() => {
    const rank = (p: PublicProduct) => {
      if (p.model === "iPhone 17") return 0;
      if (p.model === "iPhone 15 Pro Max") return 1;
      if (
        p.brand === "Samsung" &&
        p.model.includes("A57") &&
        p.storage === "128 GB"
      )
        return 2;
      if (p.model.includes("Note 15 Pro") && !p.model.includes("Plus"))
        return 3;
      if (p.model === "iPhone 13") return 4;
      return 99;
    };
    return products
      .map((p) => productForColor(p, selectedColor(p)))
      .filter(
        (p) =>
          (condition === "all" || p.condition === condition) &&
          (brand === "Todas" || p.brand === brand) &&
          p.price <= budget &&
          (category === "all" || p.category === category) &&
          (region === "all" || p.region === region) &&
          (storage === "all" || p.storage === storage) &&
          (!onlyFavorites || isFavoriteProduct(p)) &&
          `${p.brand} ${p.model} ${p.storage || ""} ${p.ram || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      )
      .sort((a, b) => a.price - b.price)
      .filter(
        (p, i, all) =>
          all.findIndex(
            (x) =>
              x.slug === p.slug &&
              x.condition === p.condition &&
              x.grade === p.grade,
          ) === i,
      )
      .sort((a, b) =>
        sort === "low"
          ? a.price - b.price
          : sort === "high"
            ? b.price - a.price
            : sort === "name"
              ? a.model.localeCompare(b.model)
              : rank(a) - rank(b),
      );
  }, [
    products,
    condition,
    brand,
    search,
    budget,
    sort,
    category,
    region,
    storage,
    onlyFavorites,
    favorites,
    colorSelections,
  ]);
  function reset() {
    setCondition(view === "catalog" ? initialCondition : "all");
    setBrand("Todas");
    setSearch("");
    setBudget(2200);
    setStorage("all");
    setRegion("all");
    setCategory("smartphone");
    setOnlyFavorites(false);
  }
  async function checkout() {
    if (!CHECKOUT_ENABLED) {
      setPayState(
        "La compra online abrirá próximamente. Tu carrito queda guardado en este dispositivo.",
      );
      return;
    }
    setPayLoading(true);
    setPayState("");
    try {
      const snapshot = JSON.stringify(cart);
      if (
        !checkoutAttempt.current ||
        checkoutAttempt.current.cart !== snapshot
      ) {
        let saved: null | { cart: string; key: string } = null;
        try {
          saved = JSON.parse(
            sessionStorage.getItem("cleverphone-checkout-attempt") || "null",
          );
        } catch {}
        checkoutAttempt.current =
          saved?.cart === snapshot && typeof saved.key === "string"
            ? saved
            : { cart: snapshot, key: crypto.randomUUID() };
        try {
          sessionStorage.setItem(
            "cleverphone-checkout-attempt",
            JSON.stringify(checkoutAttempt.current),
          );
        } catch {}
      }
      const r = await fetch(withBase("/api/checkout"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutAttempt.current.key,
        },
        body: JSON.stringify({
          items: cart.map(({ id, quantity, color }) => ({
            id,
            quantity,
            ...(color ? { color } : {}),
          })),
        }),
      });
      const d = (await r.json()) as {
        url?: string;
        error?: string;
        message?: string;
      };
      if (
        r.ok &&
        typeof d.url === "string" &&
        d.url.startsWith("https://checkout.stripe.com/")
      ) {
        try {
          sessionStorage.setItem(
            "cleverphone-checkout-cart",
            JSON.stringify(cart),
          );
        } catch {}
        location.assign(d.url);
      } else
        setPayState(
          typeof d.error === "string"
            ? d.error
            : d.message ||
                "Los pagos todavía no están activados. Tu carrito está guardado en este dispositivo.",
        );
    } catch {
      setPayState(
        "No se pudo conectar con la pasarela. Tu carrito está guardado.",
      );
    } finally {
      setPayLoading(false);
    }
  }
  function card(base: PublicProduct) {
    const color = selectedColor(base),
      p = productForColor(base, color),
      photo = color?.images[0];
    const capacities = getStorageOptions(products, p, color?.key);
    return (
      <article className="product-card" key={base.id}>
        <div className="card-top">
          <span
            className={
              "status-pill " + (p.condition === "new" ? "new" : "renewed")
            }
          >
            {p.condition === "new" ? "Nuevo" : "Segunda mano"}
          </span>
          <button
            className={
              "icon-button favorite " +
              (isFavoriteProduct(p) ? " active" : "")
            }
            aria-label={`${isFavoriteProduct(p) ? "Quitar" : "Guardar"} ${p.model} en favoritos`}
            onClick={() => favorite(p.id)}
          >
            <Heart size={18} />
          </button>
        </div>
        <a
          className="product-picture"
          href={
            productPath(p) +
            (color ? "&color=" + encodeURIComponent(color.key) : "")
          }
          aria-label={`Ver ${p.model} ${p.storage || ""}`}
        >
          {photo ? (
            <img
              key={photo.src}
              src={withBase(photo.src)}
              alt={photo.alt}
              loading="lazy"
              width="800"
              height="800"
            />
          ) : (
            <ProductPlaceholder model={p.model} />
          )}
        </a>
        <div className="card-copy">
          <div className="product-brand">
            {p.brand}{" "}
            <span>
              {p.region === "EU"
                ? "· Versión EU"
                : p.region === "NO EU"
                  ? "· Versión NO EU"
                  : ""}
            </span>
          </div>
          <a
            className="product-title"
            href={
              productPath(p) +
              (color ? "&color=" + encodeURIComponent(color.key) : "")
            }
          >
            {p.model.replace(/^Samsung /, "")}
          </a>
          <div className="product-spec">
            {p.storage || "Capacidad por confirmar"}
            {p.ram
              ? ` · ${p.ram} ${p.ram.includes("+") ? "RAM combinada" : "RAM"}`
              : ""}
            {p.bundle ? ` · ${p.bundle}` : ""}
          </div>
          {capacities.length > 1 && (
            <a className="card-capacities" href={productPath(p) + (color ? "&color=" + encodeURIComponent(color.key) : "")}>
              {capacities.map((option) => option.storage).filter((s, i, all) => all.indexOf(s) === i).join(" / ")} <ArrowUpRight size={11} />
            </a>
          )}
          <div className="swatches">
            {p.colors.slice(0, 4).map((c) => (
              <button
                key={c.key}
                className={color?.key === c.key ? "selected" : ""}
                style={{ "--swatch": c.hex } as React.CSSProperties}
                aria-label={`${p.model}: color ${c.label}`}
                aria-pressed={color?.key === c.key}
                onClick={() => selectColor(base, c.key)}
              >
                <i />
              </button>
            ))}
            <span>{color?.label || p.color || ""}</span>
            {p.colors.length > 4 && (
              <a className="more-colors" href={productPath(p)}>
                +{p.colors.length - 4}
              </a>
            )}
          </div>
          <div className="card-bottom">
            <div>
              <strong>{euro(p.price)}</strong>
              <small>IVA incluido · PVP propuesto</small>
            </div>
            <button
              className="add-button"
              onClick={() => add(p)}
              aria-label={`Añadir ${p.model} al carrito`}
            >
              <Plus size={21} />
            </button>
          </div>
        </div>
      </article>
    );
  }
  const texts: Record<string, { title: string; body: React.ReactNode }> = {
    garantia: {
      title: "Compra con las cosas claras.",
      body: (
        <>
          <p>
            En España, los productos nuevos tienen 3 años de garantía legal.
            Para bienes de segunda mano se puede acordar un plazo menor, nunca
            inferior a un año. El plazo y las condiciones aplicables a cada
            unidad deben constar antes de comprar.
          </p>
          <p>
            En compras a distancia dispones, con carácter general, de 14 días
            naturales para desistir desde la recepción. Los costes y el
            procedimiento de devolución se detallarán en las condiciones de
            venta.
          </p>
          <p>
            Este catálogo está en preparación. El estado, la batería y la
            garantía concreta de los teléfonos usados se confirmarán antes de
            habilitar su venta.
          </p>
          <a
            href="https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555"
            target="_blank"
            rel="noreferrer"
          >
            Consultar normativa de consumo <ExternalLink size={14} />
          </a>
        </>
      ),
    },
    envio: {
      title: "De nuestro catálogo a tus manos.",
      body: (
        <>
          <p>
            La propuesta inicial es un envío de 4,90 € para España peninsular.
            Verás el importe completo antes de pagar.
          </p>
          <p>
            Plazos, transportista, cobertura territorial y recogida están
            pendientes de cerrar. No se promete una entrega en 24 horas sin
            confirmar disponibilidad.
          </p>
        </>
      ),
    },
    reviews: {
      title: "La confianza se gana.",
      body: (
        <>
          <p>
            Estamos reuniendo las primeras opiniones de nuestros clientes.
            Publicaremos las valoraciones con su origen y verificación claros,
            incluidas las críticas.
          </p>
          <p>
            Estamos preparando un perfil de Trustpilot. Cuando esté disponible,
            podrás consultar allí las opiniones de la tienda desde este
            apartado.
          </p>
          <a href="https://es.trustpilot.com/" target="_blank" rel="noreferrer">
            Conocer Trustpilot <ArrowUpRight size={15} />
          </a>
        </>
      ),
    },
    about: {
      title: "Hola, somos CleverPhone.",
      body: (
        <>
          <p>
            Elegir un móvil debería ser fácil: saber qué compras, cuánto pagas y
            en qué estado lo recibes. Esa es la idea de CleverPhone.
          </p>
          <p>
            Estamos preparando una selección de móviles nuevos y de segunda
            mano, con precios que incluyen IVA y fichas que distinguen
            capacidad, procedencia y estado.
          </p>
          <p>
            Antes del lanzamiento publicaremos los datos fiscales, el contacto
            de atención y las acreditaciones comerciales que correspondan.
          </p>
        </>
      ),
    },
    legal: {
      title: "Información antes del lanzamiento.",
      body: (
        <>
          <p>
            CleverPhone es un proyecto de tienda en preparación. Los precios son
            propuestas y la pasarela todavía no admite cobros.
          </p>
          <p>
            Antes de abrir al público completaremos razón social, NIF,
            domicilio, correo de atención, condiciones de contratación,
            garantías y procedimiento de desistimiento.
          </p>
          <p>
            Las marcas pertenecen a sus titulares. Las fotografías de catálogo
            muestran el modelo y color indicados; en productos usados no
            representan el estado de la unidad. La imagen editorial de la
            portada se ha generado con IA. No se declara una acreditación de
            distribuidor autorizado sin documentarla.
          </p>
        </>
      ),
    },
    privacy: {
      title: "Tu privacidad, sencilla.",
      body: (
        <>
          <p>
            El carrito y los favoritos se guardan en el almacenamiento local de
            este navegador. No usamos cookies de publicidad ni herramientas de
            seguimiento en esta versión.
          </p>
          <p>
            Al activar Stripe, los datos de pago se introducirán en su pasarela
            segura. Antes del lanzamiento se completará esta política con el
            responsable del tratamiento, bases legales, plazos y ejercicio de
            derechos.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setCart([]);
              setFavorites([]);
              setToast("Carrito y favoritos eliminados");
            }}
          >
            Borrar mi carrito y favoritos
          </button>
        </>
      ),
    },
  };
  return (
    <>
      <div className="announcement">
        <span>Una forma más clever de cambiar de móvil.</span>
        <a href={view === "home" ? "#catalogo" : withBase("/moviles/todos/")}>
          Encuentra el tuyo <ArrowRight size={13} />
        </a>
      </div>
      <header className="site-header">
        <div className="nav-inner">
          <a className="brand" href={withBase("/")} aria-label="CleverPhone inicio">
            <Logo />
            <span className="brand-word">
              Clever<span>Phone</span>
            </span>
          </a>
          <nav className="desktop-nav">
            <a
              className={condition === "new" ? "nav-active" : ""}
              href={withBase("/moviles/nuevos/")}
            >
              Nuevos
            </a>
            <a
              className={condition === "refurbished" ? "nav-active" : ""}
              href={withBase("/moviles/reacondicionados/")}
            >
              Reacondicionados <Leaf size={13} />
            </a>
            <a href={withBase("/#por-que")}>Por qué CleverPhone</a>
          </nav>
          <div className="nav-actions">
            <button
              className="icon-button search-nav"
              aria-label="Buscar móviles"
              onClick={() => {
                if (view === "product") {
                  window.location.assign(withBase("/moviles/todos/#search"));
                  return;
                }
                document
                  .getElementById("catalogo")
                  ?.scrollIntoView({ behavior: "smooth" });
                document.getElementById("search")?.focus();
              }}
            >
              <Search size={21} />
            </button>
            <button
              className="icon-button"
              aria-label={`Ver favoritos (${favorites.length})`}
              onClick={() => {
                if (view === "product") {
                  window.location.assign(withBase("/moviles/todos/?favoritos=1"));
                  return;
                }
                if (!onlyFavorites) {
                  reset();
                  setCondition("all");
                  setCategory("all");
                }
                setOnlyFavorites(!onlyFavorites);
                document
                  .getElementById("catalogo")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <Heart size={21} fill={onlyFavorites ? "currentColor" : "none"} />
            </button>
            <button
              className="cart-trigger"
              aria-label={`Abrir carrito, ${cartCount} productos`}
              onClick={() => {
                setCartOpen(true);
                setPayState("");
              }}
            >
              <ShoppingBag size={20} />
              <span className="cart-label">Mi carrito</span>
              <b>{cartCount}</b>
            </button>
            <button
              className="icon-button mobile-menu-button"
              aria-label="Abrir menú"
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <nav className="mobile-menu">
            <button onClick={() => chooseCondition("new")}>
              Móviles nuevos <ArrowUpRight size={18} />
            </button>
            <button onClick={() => chooseCondition("refurbished")}>
              Reacondicionados <Leaf size={18} />
            </button>
            <a href={withBase("/#por-que")} onClick={() => setMobileMenu(false)}>
              Por qué CleverPhone
            </a>
          </nav>
        )}
      </header>
      {view === "product" && product ? (
        <ProductPage
          product={product}
          products={products}
          color={selectedColor(product)}
          isFavorite={isFavoriteProduct(product)}
          onColor={(key) => selectColor(product, key)}
          onVariant={selectVariant}
          onAdd={() => add(product)}
          onFavorite={() => favorite(product.id)}
          onInfo={setInfo}
          renderCard={card}
        />
      ) : (
        <main>
          {view === "home" && (
            <>
              <section className="hero">
                <div className="hero-bg" />
                <div className="hero-art">
                  <img
                    src={withBase("/images/hero.webp")}
                    alt="Composición editorial IA de dos smartphones sobre cristal azul"
                    width="1600"
                    height="900"
                    fetchPriority="high"
                  />
                </div>
                <div className="hero-inner">
                  <div className="eyebrow">
                    <span className="live-dot" /> TECNOLOGÍA QUE ENCAJA CONTIGO
                  </div>
                  <h1>
                    Tu próximo móvil.
                    <br />
                    Una decisión
                    <br />
                    <span>brillante.</span>
                  </h1>
                  <p>
                    Nuevo o con otra historia. Encuentra ese móvil
                    <br className="desktop-only" /> que tiene todo lo que
                    buscas, al precio que encaja.
                  </p>
                  <div className="hero-buttons">
                    <button
                      className="button primary"
                      onClick={() => chooseCondition("all")}
                    >
                      Encuentra tu móvil <ArrowUpRight size={18} />
                    </button>
                    <button
                      className="hero-link"
                      onClick={() => chooseCondition("refurbished")}
                    >
                      Dale otra vida <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="hero-proof">
                    <span>
                      <CheckCircle2 size={16} /> Precios con IVA incluido
                    </span>
                    <i />
                    <span>
                      <ShieldCheck size={16} /> Información clara
                    </span>
                  </div>
                </div>
                <div className="floating-label glass">
                  <span className="label-icon">
                    <Sparkles size={20} />
                  </span>
                  <div>
                    <b>Más móvil. Más tú.</b>
                    <small>Elige bien. Disfruta más.</small>
                  </div>
                </div>
                <div className="hero-caption">
                  Imágenes de concepto generadas con IA
                </div>
                <div className="hero-index">
                  <span>01</span>
                  <i /> UNA ELECCIÓN INTELIGENTE
                </div>
              </section>
              <section
                className="service-strip"
                aria-label="Ventajas de compra"
              >
                <button onClick={() => setInfo("garantia")}>
                  <ShieldCheck />
                  <span>
                    <b>Garantía legal</b>
                    <small>Consulta las condiciones</small>
                  </span>
                </button>
                <button onClick={() => setInfo("envio")}>
                  <Truck />
                  <span>
                    <b>Todo a la vista</b>
                    <small>Envío calculado antes de pagar</small>
                  </span>
                </button>
                <button onClick={() => setInfo("garantia")}>
                  <RotateCcw />
                  <span>
                    <b>14 días para decidir</b>
                    <small>Desistimiento en compras online</small>
                  </span>
                </button>
                <button onClick={() => setInfo("reviews")}>
                  <Heart />
                  <span>
                    <b>Confianza de verdad</b>
                    <small>Opiniones con origen claro</small>
                  </span>
                </button>
              </section>
            </>
          )}
          <section className="catalog-section section-wrap" id="catalogo">
            <div className="section-top">
              <div>
                <span className="eyebrow">
                  {view === "catalog" && initialCondition === "new"
                    ? "MÓVILES NUEVOS"
                    : view === "catalog" && initialCondition === "refurbished"
                      ? "REACONDICIONADOS Y SEGUNDA MANO"
                      : "EL SIGUIENTE PUEDE SER EL TUYO"}
                </span>
                {view === "catalog" ? (
                  <h1 className="catalog-page-title">
                    {initialCondition === "new"
                      ? "Estrena algo brillante."
                      : initialCondition === "refurbished"
                        ? "Una segunda vida. Tu primera elección."
                        : "Tu próximo móvil está aquí."}
                  </h1>
                ) : (
                  <h2>
                    Encuentra tu <span>match.</span>
                  </h2>
                )}
                <p>Elige lo que te importa. Nosotros te lo ponemos fácil.</p>
              </div>
              <span className="catalog-stamp">
                <Smartphone size={16} /> NUEVOS & SEGUNDA MANO
              </span>
            </div>
            <div className="catalog-toolbar">
              <div className="segmented">
                {conditions.map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => {
                      if (view === "catalog") {
                        chooseCondition(v);
                        return;
                      }
                      setCondition(v);
                      setOnlyFavorites(false);
                    }}
                    className={condition === v ? "selected" : ""}
                  >
                    {v === "refurbished" && <Leaf size={14} />} {label}
                  </button>
                ))}
              </div>
              <div className="catalog-search">
                <Search size={18} />
                <input
                  id="search"
                  type="search"
                  placeholder="Busca tu marca o modelo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Buscar marca o modelo"
                />
                <kbd>⌕</kbd>
              </div>
            </div>
            <div className="brand-row">
              {[
                "Todas",
                "Apple",
                "Samsung",
                "Xiaomi",
                "Google",
                "Motorola",
                "OPPO",
              ].map((b) => (
                <button
                  className={brand === b ? "active" : ""}
                  key={b}
                  onClick={() => setBrand(b)}
                >
                  {b === "Todas" ? "Todas las marcas" : b}
                </button>
              ))}
              <select
                aria-label="Más marcas"
                value={
                  [
                    "Todas",
                    "Apple",
                    "Samsung",
                    "Xiaomi",
                    "Google",
                    "Motorola",
                    "OPPO",
                  ].includes(brand)
                    ? ""
                    : brand
                }
                onChange={(e) => e.target.value && setBrand(e.target.value)}
              >
                <option value="">Más marcas</option>
                {allBrands
                  .filter(
                    (b) =>
                      ![
                        "Apple",
                        "Samsung",
                        "Xiaomi",
                        "Google",
                        "Motorola",
                        "OPPO",
                      ].includes(b),
                  )
                  .map((b) => (
                    <option key={b}>{b}</option>
                  ))}
              </select>
            </div>
            <div className="results-toolbar">
              <p>
                <b>{filtered.length}</b>{" "}
                {onlyFavorites
                  ? "favoritos"
                  : filtered.length === 1
                    ? "móvil para ti"
                    : "móviles para ti"}
                {condition === "refurbished" && (
                  <span className="used-note">
                    {" "}
                    · Segunda mano; revisión por confirmar
                  </span>
                )}
              </p>
              <div>
                <button
                  className={"filter-trigger " + (filterOpen ? "active" : "")}
                  onClick={() => setFilterOpen(!filterOpen)}
                  aria-expanded={filterOpen}
                >
                  <SlidersHorizontal size={16} /> Filtros{" "}
                  {(budget < 2200 ||
                    region !== "all" ||
                    storage !== "all" ||
                    category !== "smartphone") && <i />}
                </button>
                <label className="sort-label">
                  <span>Ordenar:</span>
                  <select
                    aria-label="Ordenar productos"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="featured">Selección Clever</option>
                    <option value="low">Menor precio</option>
                    <option value="high">Mayor precio</option>
                    <option value="name">Nombre A–Z</option>
                  </select>
                </label>
              </div>
            </div>
            {filterOpen && (
              <div className="filter-panel glass">
                <label>
                  Presupuesto máximo <b>{euro(budget)}</b>
                  <input
                    type="range"
                    min="30"
                    max="2200"
                    step="10"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                  />
                </label>
                <label>
                  Capacidad
                  <select
                    value={storage}
                    onChange={(e) => setStorage(e.target.value)}
                  >
                    <option value="all">Todas las capacidades</option>
                    {Array.from(
                      new Set(products.map((p) => p.storage).filter(Boolean)),
                    )
                      .sort()
                      .map((s) => (
                        <option key={s!} value={s!}>
                          {s}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Versión
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                  >
                    <option value="all">Todas las versiones</option>
                    <option>EU</option>
                    <option>NO EU</option>
                    <option>Sin confirmar</option>
                  </select>
                </label>
                <label>
                  Tipo
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">Todos los teléfonos</option>
                    <option value="smartphone">Smartphones</option>
                    <option value="basic">Teléfonos básicos</option>
                  </select>
                </label>
                <button className="text-button" onClick={reset}>
                  Restablecer filtros
                </button>
              </div>
            )}
            {onlyFavorites && (
              <div className="favorites-banner">
                Tu selección guardada{" "}
                <button onClick={() => window.location.assign(withBase("/moviles/todos/"))}>
                  Ver todo el catálogo <X size={14} />
                </button>
              </div>
            )}
            <div className="product-grid">
              {filtered.slice(0, limit).map(card)}
            </div>
            {filtered.length === 0 && (
              <div className="empty-state">
                <Search size={34} />
                <h3>No hay móviles con estos filtros.</h3>
                <p>Prueba otra marca o amplía tu presupuesto.</p>
                <button className="button primary" onClick={reset}>
                  Ver todos los móviles
                </button>
              </div>
            )}
            {limit < filtered.length && (
              <div className="load-more">
                <button
                  className="button secondary"
                  onClick={() => setLimit(limit + 12)}
                >
                  Descubrir más móviles <ChevronDown size={16} />
                </button>
                <span>
                  Viendo {Math.min(limit, filtered.length)} de {filtered.length}
                </span>
              </div>
            )}
            <p className="catalog-disclaimer">
              PVP propuestos con IVA incluido. Catálogo en preparación: stock,
              colores y condiciones sujetos a confirmación antes de activar la
              compra.
            </p>
          </section>
          {view === "home" && (
            <>
              <section className="second-life section-wrap">
                <div className="second-copy">
                  <span className="eyebrow">
                    <Leaf size={15} /> OTRA HISTORIA. TU COMIENZO.
                  </span>
                  <h2>
                    Todo lo que quieres.
                    <br />
                    <span>Con otra vida.</span>
                  </h2>
                  <p>
                    Tu próximo gran móvil puede tener una historia anterior.
                    Explora nuestra selección de segunda mano y conoce su estado
                    antes de elegir.
                  </p>
                  <button
                    className="button dark"
                    onClick={() => chooseCondition("refurbished")}
                  >
                    Explorar reacondicionados <ArrowUpRight size={18} />
                  </button>
                  <div className="life-tags">
                    <span>
                      <Check size={14} /> Estado detallado
                    </span>
                    <span>
                      <Check size={14} /> Batería por confirmar
                    </span>
                    <span>
                      <Check size={14} /> Sin sorpresas
                    </span>
                  </div>
                </div>
                <div className="second-art">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <img
                    src={withBase(
                      products.find((p) => p.model === "iPhone 13")?.image ||
                        "/images/apple.webp",
                    )}
                    alt="Fotografía de catálogo de un iPhone 13"
                    loading="lazy"
                    width="800"
                    height="800"
                  />
                  <span className="second-glass glass">
                    <Leaf size={18} /> Una buena elección, otra vez.
                  </span>
                </div>
              </section>
              <section className="trust-section section-wrap" id="por-que">
                <div className="trust-heading">
                  <span className="eyebrow">
                    LA TRANQUILIDAD TAMBIÉN VIENE INCLUIDA
                  </span>
                  <h2>
                    Menos dudas.
                    <br />
                    <span>Más CleverPhone.</span>
                  </h2>
                  <p>
                    La tecnología cambia. Lo importante, no: saber qué compras y
                    tener las cosas claras.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setInfo("about")}
                  >
                    Conoce nuestra idea <ArrowUpRight size={17} />
                  </button>
                </div>
                <div className="trust-grid">
                  <button onClick={() => setInfo("garantia")}>
                    <div className="trust-icon">
                      <ShieldCheck />
                    </div>
                    <h3>Garantía que se entiende.</h3>
                    <p>
                      Consulta tus derechos y las condiciones de cada producto
                      antes de decidir.
                    </p>
                    <span>
                      Ver condiciones <ArrowRight size={15} />
                    </span>
                  </button>
                  <button onClick={() => setInfo("envio")}>
                    <div className="trust-icon">
                      <Truck />
                    </div>
                    <h3>El total, desde el principio.</h3>
                    <p>
                      Precio con IVA y envío visible antes del pago. Para elegir
                      con toda la información.
                    </p>
                    <span>
                      Envíos y devoluciones <ArrowRight size={15} />
                    </span>
                  </button>
                  <button onClick={() => setInfo("reviews")}>
                    <div className="trust-icon mint">
                      <Star />
                    </div>
                    <h3>Opiniones con nombre propio.</h3>
                    <p>
                      Reseñas auténticas de compradores. Las primeras llegarán
                      con nuestras primeras ventas.
                    </p>
                    <span>
                      Sobre nuestras opiniones <ArrowRight size={15} />
                    </span>
                  </button>
                </div>
              </section>
              <section className="closing-banner section-wrap">
                <span className="eyebrow">TU MÓVIL ESTÁ POR AQUÍ.</span>
                <h2>Vamos a encontrarlo.</h2>
                <button
                  className="button light"
                  onClick={() => chooseCondition("all")}
                >
                  Explorar el catálogo <ArrowUpRight size={19} />
                </button>
                <div className="banner-orb" />
              </section>
            </>
          )}
        </main>
      )}
      <footer className="site-footer section-wrap">
        <div className="footer-top">
          <div>
            <a className="brand" href={withBase("/")}>
              <Logo />
              <span className="brand-word">
                Clever<span>Phone</span>
              </span>
            </a>
            <p>
              Una forma más clever
              <br />
              de elegir tu próximo móvil.
            </p>
          </div>
          <div>
            <b>Encuentra el tuyo</b>
            <button onClick={() => chooseCondition("new")}>
              Móviles nuevos
            </button>
            <button onClick={() => chooseCondition("refurbished")}>
              Reacondicionados
            </button>
            <button
              onClick={() => window.location.assign(withBase("/moviles/todos/?tipo=basic"))}
            >
              Teléfonos básicos
            </button>
          </div>
          <div>
            <b>Estamos contigo</b>
            <button onClick={() => setInfo("garantia")}>
              Garantía y devoluciones
            </button>
            <button onClick={() => setInfo("envio")}>
              Información de envío
            </button>
            <button onClick={() => setInfo("reviews")}>
              Opiniones y Trustpilot
            </button>
          </div>
          <div className="footer-payment">
            <b>Tu próxima compra, segura.</b>
            <span>
              <Lock size={15} /> Pasarela Stripe en preparación
            </span>
            <div>
              <span>VISA</span>
              <span>Mastercard</span>
              <span>Apple Pay*</span>
            </div>
            <small>*Métodos sujetos a activación y disponibilidad.</small>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} CleverPhone · Proyecto en preparación
          </span>
          <div>
            <button onClick={() => setInfo("legal")}>Aviso legal</button>
            <button onClick={() => setInfo("privacy")}>Privacidad</button>
            <button onClick={() => setInfo("legal")}>Condiciones</button>
          </div>
          <span>
            Elegir bien se siente bien. <Sparkles size={13} />
          </span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button
            onClick={() => {
              setCartOpen(true);
              setToast("");
            }}
          >
            Ver carrito
          </button>
        </div>
      )}
      <dialog
        aria-labelledby={cartOpen ? "cart-title" : "info-title"}
        ref={dialog}
        className={"store-dialog " + (cartOpen ? "cart-dialog" : "info-dialog")}
        onCancel={(e) => {
          e.preventDefault();
          closeModal();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        {toast && (
          <div className="toast dialog-toast" role="status">
            <CheckCircle2 size={18} />
            {toast}
            <button
              onClick={() => {
                setCartOpen(true);
                setToast("");
              }}
            >
              Ver carrito
            </button>
          </div>
        )}
        <button
          className="modal-close icon-button"
          onClick={closeModal}
          aria-label="Cerrar"
        >
          <X size={21} />
        </button>
        {cartOpen ? (
          <div className="cart-body">
            <div className="eyebrow">TU PRÓXIMA BUENA ELECCIÓN</div>
            <h2 id="cart-title">
              Tu carrito<span> ({cartCount})</span>
            </h2>
            {cart.length === 0 ? (
              <div className="empty-state">
                <ShoppingBag size={42} />
                <h3>El comienzo de algo bueno.</h3>
                <p>Encuentra tu próximo móvil y guárdalo aquí.</p>
                <button
                  className="button primary"
                  onClick={() => {
                    closeModal();
                    chooseCondition("all");
                  }}
                >
                  Explorar móviles <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map((c) => {
                    const p = products.find((p) => p.id === c.id)!;
                    const color = p.colors.find(
                        (color) => color.key === c.colorKey,
                      ),
                      photo = color?.images[0] || p.colors[0]?.images[0];
                    return (
                      <div className="cart-item" key={lineKey(c)}>
                        {photo ? (
                          <a className="cart-product-photo" href={productPath(p) + (c.colorKey ? "&color=" + encodeURIComponent(c.colorKey) : "")} aria-label={`Ver ${p.model} ${p.storage || ""}`}>
                          <img
                            src={withBase(photo.src)}
                            alt={photo.alt}
                            width="85"
                            height="100"
                          />
                          </a>
                        ) : (
                          <div className="cart-photo-placeholder">
                            <Smartphone />
                          </div>
                        )}
                        <div className="cart-item-copy">
                          <span>
                            {p.brand} ·{" "}
                            {p.condition === "new" ? "Nuevo" : "Segunda mano"}
                          </span>
                          <a className="cart-product-title" href={productPath(p) + (c.colorKey ? "&color=" + encodeURIComponent(c.colorKey) : "")}>{p.model}</a>
                          <small>
                            {[p.storage, p.bundle, c.color]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                          <div className="quantity">
                            <button
                              aria-label={`Quitar una unidad de ${p.model}${c.color ? " · " + c.color : ""}`}
                              onClick={() =>
                                setCart(
                                  cart
                                    .map((x) =>
                                      lineKey(x) === lineKey(c)
                                        ? { ...x, quantity: x.quantity - 1 }
                                        : x,
                                    )
                                    .filter((x) => x.quantity > 0),
                                )
                              }
                            >
                              <Minus size={13} />
                            </button>
                            <span>{c.quantity}</span>
                            <button
                              aria-label={`Añadir una unidad de ${p.model}${c.color ? " · " + c.color : ""}`}
                              disabled={
                                cart
                                  .filter((x) => x.id === p.id)
                                  .reduce((n, x) => n + x.quantity, 0) >= 5 ||
                                cartCount >= 20
                              }
                              onClick={() =>
                                setCart(
                                  cart.map((x) =>
                                    lineKey(x) === lineKey(c)
                                      ? { ...x, quantity: x.quantity + 1 }
                                      : x,
                                  ),
                                )
                              }
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                        </div>
                        <div className="cart-item-price">
                          <b>{euro(p.price * c.quantity)}</b>
                          <button
                            onClick={() =>
                              setCart(
                                cart.filter((x) => lineKey(x) !== lineKey(c)),
                              )
                            }
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="cart-summary">
                  <div>
                    <span>Subtotal (IVA incluido)</span>
                    <b>{euro(total)}</b>
                  </div>
                  <div>
                    <span>Envío peninsular propuesto</span>
                    <b>{euro(4.9)}</b>
                  </div>
                  <div className="cart-total">
                    <span>Total propuesto</span>
                    <strong>{euro(total + 4.9)}</strong>
                  </div>
                  <button
                    className="button primary"
                    disabled={payLoading}
                    onClick={checkout}
                  >
                    <Lock size={17} />
                    {!CHECKOUT_ENABLED
                      ? "Compra online próximamente"
                      : payLoading
                        ? "Conectando…"
                        : "Continuar al pago"}{" "}
                    <ArrowRight size={18} />
                  </button>
                  <p className="checkout-note">
                    Vista previa: los cobros se habilitarán al confirmar
                    catálogo, stock y condiciones de venta.
                  </p>
                  <span className="secure-line">
                    <ShieldCheck size={14} /> Tus datos de tarjeta se
                    introducirán en Stripe.
                  </span>
                </div>
              </>
            )}
            {payState && (
              <div className="payment-message" role="status">
                {payState}
              </div>
            )}
          </div>
        ) : info && texts[info] ? (
          <div className="info-body">
            <div className="trust-icon">
              <ShieldCheck />
            </div>
            <span className="eyebrow">CLEVERPHONE · CON CONFIANZA</span>
            <h2 id="info-title">{texts[info].title}</h2>
            {texts[info].body}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
