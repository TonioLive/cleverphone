import { env } from "cloudflare:workers";
import catalog from "@/data/catalog.json";
import { PaymentError, validatedSiteUrl, type CatalogProduct, type CheckoutLine } from "./payment-guards";

export const paymentCatalog = catalog as CatalogProduct[];
export const STRIPE_VERSION = "2026-09-30.endive";
export const ORDER_COOKIE = "cp_checkout";
export const SHIPPING_AMOUNT = 490;
export type StripeSession = {
  id: string;
  object: string;
  url?: string;
  amount_total: number;
  currency: string;
  mode: string;
  livemode: boolean;
  status: string;
  payment_status: string;
  metadata?: { shop?: string; order_id?: string };
};
export type OrderRow = { id: string; checkout_session_id: string | null; access_token_hash: string; status: string; amount_total: number; currency: string; created_at: string };

export class StripeProviderError extends PaymentError {
  providerStatus: number;
  definitive: boolean;
  constructor(providerStatus: number, type?: string) {
    super("No pudimos iniciar o verificar el pago. Inténtalo más tarde.", 502);
    this.providerStatus = providerStatus;
    this.definitive = providerStatus >= 400 && providerStatus < 500 && ![408, 409, 429].includes(providerStatus)
      && ["invalid_request_error", "authentication_error", "permission_error"].includes(type ?? "");
  }
}

export function paymentConfig(requireLive = true) {
  const key = env.STRIPE_SECRET_KEY;
  if ((requireLive && env.STORE_LIVE !== "true") || !key || !/^sk_(test|live)_[A-Za-z0-9]+$/.test(key) || !env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) throw new PaymentError("Pagos no activos. Estamos confirmando el catálogo y la configuración de cobro.", 503);
  return { key, siteUrl: validatedSiteUrl(env.SITE_URL), webhookSecret: env.STRIPE_WEBHOOK_SECRET };
}

export function paymentDatabase(): D1Database {
  if (!env.DB) throw new PaymentError("Pagos no activos. El registro seguro de pedidos no está disponible.", 503);
  return env.DB;
}

export async function stripeRequest(key: string, path: string, body?: URLSearchParams, idempotencyKey?: string): Promise<StripeSession> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": STRIPE_VERSION, ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    ...(body ? { body: body.toString() } : {}),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    let type: string | undefined;
    try { type = (await response.json() as { error?: { type?: string } }).error?.type; } catch { /* Keep unknown outcomes reserved. */ }
    throw new StripeProviderError(response.status, type);
  }
  const session = await response.json() as StripeSession;
  if (!session || session.object !== "checkout.session" || !/^cs_(test_|live_)?[A-Za-z0-9]+$/.test(session.id)) throw new PaymentError("El proveedor de pago no devolvió una sesión válida.", 502);
  return session;
}

export function sessionMatchesOrder(session: StripeSession, order: OrderRow, key: string): boolean {
  return session.mode === "payment" && session.metadata?.shop === "cleverphone" && session.metadata.order_id === order.id
    && session.amount_total === order.amount_total && session.currency === order.currency
    && session.livemode === key.startsWith("sk_live_") && (!order.checkout_session_id || order.checkout_session_id === session.id);
}

export async function reserveOrder(db: D1Database, id: string, accessHash: string, lines: CheckoutLine[]): Promise<void> {
  const now = new Date().toISOString();
  const total = lines.reduce((sum, line) => sum + line.unitAmount * line.quantity, SHIPPING_AMOUNT);
  const stock = await db.prepare(`SELECT sku, available, enabled FROM inventory WHERE sku IN (${lines.map(() => "?").join(",")})`).bind(...lines.map((line) => line.id)).all<{ sku: string; available: number; enabled: number }>();
  if (lines.some((line) => !stock.results.some((row) => row.sku === line.id && row.enabled === 1 && row.available >= line.quantity))) throw new PaymentError("No hay stock confirmado suficiente. Actualiza tu carrito.", 409);
  // D1 batch is transactional. CHECK available >= 0 and the order-line foreign
  // key roll back the reservation if concurrent stock updates make it invalid.
  const statements = [db.prepare("INSERT INTO orders (id, access_token_hash, status, amount_total, currency, created_at, updated_at) VALUES (?, ?, 'pending', ?, 'eur', ?, ?)").bind(id, accessHash, total, now, now)];
  for (const line of lines) {
    statements.push(db.prepare("UPDATE inventory SET available = CASE WHEN enabled = 1 THEN available - ? ELSE -1 END, updated_at = ? WHERE sku = ?").bind(line.quantity, now, line.id));
    statements.push(db.prepare("INSERT INTO order_lines (order_id, sku, quantity, unit_amount, product_name) VALUES (?, ?, ?, ?, ?)").bind(id, line.id, line.quantity, line.unitAmount, line.name));
  }
  try { await db.batch(statements); }
  catch { throw new PaymentError("El stock acaba de cambiar o no está disponible. Revisa tu carrito.", 409); }
}

export function releaseStatements(db: D1Database, orderId: string, status: "expired" | "failed", now: string): D1PreparedStatement[] {
  // The status predicate prevents repeated webhook deliveries releasing twice.
  return [
    db.prepare("UPDATE inventory SET available = available + (SELECT quantity FROM order_lines WHERE order_id = ? AND sku = inventory.sku), updated_at = ? WHERE sku IN (SELECT sku FROM order_lines WHERE order_id = ?) AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'pending')").bind(orderId, now, orderId, orderId),
    db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(status, now, orderId),
  ];
}

export function paymentResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff", ...headers } });
}
export function paymentFailure(error: unknown) {
  if (error instanceof PaymentError) return paymentResponse({ error: error.message }, error.status);
  // Never disclose provider responses, keys, payment tokens or database errors.
  return paymentResponse({ error: "El servicio de pago no está disponible. No se ha confirmado ningún pedido." }, 503);
}
