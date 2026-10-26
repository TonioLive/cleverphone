import { colorFamily } from "./product-colors.ts";
export class PaymentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type CatalogProduct = {
  id: string;
  brand: string;
  model: string;
  storage?: string;
  condition: string;
  price: number;
  verified: boolean;
  availabilityStatus: string;
  color?: string;
  hidden?: boolean;
};
export type CheckoutLine = {
  id: string;
  quantity: number;
  unitAmount: number;
  name: string;
};

export function validateCart(
  payload: unknown,
  catalog: readonly CatalogProduct[],
): CheckoutLine[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    throw new PaymentError("Carrito no válido.");
  const items = (payload as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length === 0 || items.length > 20)
    throw new PaymentError("El carrito debe tener entre 1 y 20 artículos.");
  const quantities = new Map<string, number>();
  const requestedColors = new Map<string, string>();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new PaymentError("Artículo no válido.");
    const { id, quantity, color } = item as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      id.length > 160 ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 5
    )
      throw new PaymentError("Cada artículo admite de 1 a 5 unidades.");
    const combined = (quantities.get(id) ?? 0) + quantity;
    if (combined > 5) throw new PaymentError("Máximo 5 unidades por modelo.");
    quantities.set(id, combined);
    if (color !== undefined) {
      if (typeof color !== "string" || color.length > 80)
        throw new PaymentError("Color no válido.");
      const previous = requestedColors.get(id);
      if (previous && colorFamily(previous) !== colorFamily(color))
        throw new PaymentError(
          "Cada color necesita una referencia de venta independiente.",
          409,
        );
      requestedColors.set(id, color);
    }
  }
  if (
    [...quantities.values()].reduce((sum, quantity) => sum + quantity, 0) > 20
  )
    throw new PaymentError("Máximo 20 unidades por pedido.");
  const byId = new Map(catalog.map((product) => [product.id, product]));
  return [...quantities].map(([id, quantity]) => {
    const product = byId.get(id);
    if (!product || product.hidden)
      throw new PaymentError(
        "Uno de los productos ya no está en el catálogo.",
        409,
      );
    if (product.verified !== true || product.availabilityStatus !== "in_stock")
      throw new PaymentError(
        "Este producto necesita confirmar stock, variante y precio antes de comprar.",
        409,
      );
    const requestedColor = requestedColors.get(id);
    if (
      requestedColor &&
      (!product.color ||
        product.color.includes("/") ||
        product.color.includes("confirmar") ||
        colorFamily(product.color) !== colorFamily(requestedColor))
    )
      throw new PaymentError(
        "El color elegido necesita una referencia de venta confirmada antes de cobrar.",
        409,
      );
    const unitAmount = Math.round(product.price * 100);
    if (
      !Number.isFinite(product.price) ||
      !Number.isSafeInteger(unitAmount) ||
      unitAmount < 50 ||
      unitAmount > 1_000_000
    )
      throw new PaymentError(
        "El precio de este producto necesita revisión.",
        409,
      );
    return {
      id,
      quantity,
      unitAmount,
      name: `${product.brand} ${product.model} ${product.storage ?? ""}${requestedColor ? " · " + requestedColor : ""} · ${product.condition === "new" ? "Nuevo" : "Segunda mano"}`.trim(),
    };
  });
}

export function validatedSiteUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new PaymentError(
      "Pagos no activos. Falta configurar el dominio seguro.",
      503,
    );
  }
}

export function assertSameOrigin(request: Request, siteUrl: string): void {
  if (
    request.headers.get("Origin") !== siteUrl ||
    new URL(request.url).origin !== siteUrl ||
    request.headers.get("Sec-Fetch-Site") === "cross-site"
  )
    throw new PaymentError("Solicitud no autorizada.", 403);
}

export async function readLimitedBody(
  request: Request,
  maximum: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(request.headers.get("Content-Length")) > maximum)
    throw new PaymentError("Solicitud demasiado grande.", 413);
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maximum) {
      await reader.cancel();
      throw new PaymentError("Solicitud demasiado grande.", 413);
    }
    chunks.push(value);
  }
  const output = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

export async function verifyStripeSignature(
  body: Uint8Array<ArrayBuffer>,
  header: string | null,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!header || header.length > 4096 || !secret.startsWith("whsec_"))
    return false;
  const parts = header.split(",").map((part) => part.trim());
  const timestamps = parts.filter((part) => part.startsWith("t="));
  if (timestamps.length !== 1 || !/^t=\d{10}$/.test(timestamps[0]))
    return false;
  const timestampText = timestamps[0].slice(2);
  if (Math.abs(now - Number(timestampText)) > 300) return false;
  const signatures = parts
    .filter((part) => /^v1=[a-f0-9]{64}$/.test(part))
    .map((part) => part.slice(3));
  if (!signatures.length) return false;
  const prefix = new TextEncoder().encode(`${timestampText}.`);
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix);
  signed.set(body, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const signature of signatures) {
    const bytes = new Uint8Array(
      signature.match(/../g)!.map((hex) => Number.parseInt(hex, 16)),
    );
    if (await crypto.subtle.verify("HMAC", key, bytes, signed)) return true;
  }
  return false;
}

export async function sha256(value: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
