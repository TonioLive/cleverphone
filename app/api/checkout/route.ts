import { assertSameOrigin, PaymentError, readLimitedBody, sha256, validateCart } from "@/lib/payment-guards";
import { ORDER_COOKIE, SHIPPING_AMOUNT, StripeProviderError, paymentCatalog, paymentConfig, paymentDatabase, paymentFailure, paymentResponse, releaseStatements, reserveOrder, sessionMatchesOrder, stripeRequest, type OrderRow, type StripeSession } from "@/lib/payments";

function checkoutResponse(session: StripeSession, token: string) {
  let redirect: URL;
  try { redirect = new URL(session.url ?? ""); }
  catch { throw new PaymentError("No pudimos abrir el pago seguro.", 502); }
  if (redirect.protocol !== "https:" || redirect.hostname !== "checkout.stripe.com") throw new PaymentError("Destino de pago no autorizado.", 502);
  return paymentResponse({ url: redirect.href }, 200, { "Set-Cookie": `${ORDER_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/api/checkout; Max-Age=86400` });
}

export async function POST(request: Request) {
  try {
    const { key, siteUrl } = paymentConfig();
    assertSameOrigin(request, siteUrl);
    if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) throw new PaymentError("Envía el carrito en formato JSON.", 415);
    const body = await readLimitedBody(request, 8192);
    let payload: unknown;
    try { payload = JSON.parse(new TextDecoder().decode(body)); }
    catch { throw new PaymentError("Carrito no válido."); }
    const lines = validateCart(payload, paymentCatalog);
    const db = paymentDatabase();
    const suppliedKey = request.headers.get("Idempotency-Key");
    if (suppliedKey && !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(suppliedKey)) throw new PaymentError("Identificador de intento no válido.");
    const accessToken = suppliedKey?.toLowerCase() ?? crypto.randomUUID();
    const accessHash = await sha256(accessToken);
    let order = await db.prepare("SELECT * FROM orders WHERE access_token_hash = ?").bind(accessHash).first<OrderRow>();
    if (order) {
      const saved = await db.prepare("SELECT sku, quantity, unit_amount FROM order_lines WHERE order_id = ?").bind(order.id).all<{ sku: string; quantity: number; unit_amount: number }>();
      if (saved.results.length !== lines.length || lines.some((line) => !saved.results.some((row) => row.sku === line.id && row.quantity === line.quantity && row.unit_amount === line.unitAmount))) throw new PaymentError("Este intento pertenece a otro carrito. Actualiza el intento de compra.", 409);
      if (order.status !== "pending") throw new PaymentError("Este intento de compra ya terminó. Revisa su estado antes de volver a comprar.", 409);
      if (order.checkout_session_id) {
        const existing = await stripeRequest(key, `checkout/sessions/${encodeURIComponent(order.checkout_session_id)}`);
        if (!sessionMatchesOrder(existing, order, key) || existing.status !== "open") throw new PaymentError("Esta sesión ya no admite pagos. Revisa el estado del pedido.", 409);
        return checkoutResponse(existing, accessToken);
      }
    } else {
      const id = crypto.randomUUID();
      await reserveOrder(db, id, accessHash, lines);
      order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<OrderRow>();
      if (!order) throw new PaymentError("No pudimos registrar el pedido.", 503);
    }
    const orderId = order.id;
    const params = new URLSearchParams({
      mode: "payment", locale: "es",
      success_url: `${siteUrl}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?checkout=cancelled`,
      client_reference_id: orderId,
      "metadata[shop]": "cleverphone", "metadata[order_id]": orderId,
      "payment_intent_data[metadata][order_id]": orderId,
      "allowed_payment_method_types[0]": "card",
      billing_address_collection: "required",
      "shipping_address_collection[allowed_countries][0]": "ES",
      "shipping_options[0][shipping_rate_data][type]": "fixed_amount",
      "shipping_options[0][shipping_rate_data][fixed_amount][amount]": String(SHIPPING_AMOUNT),
      "shipping_options[0][shipping_rate_data][fixed_amount][currency]": "eur",
      "shipping_options[0][shipping_rate_data][display_name]": "Envío peninsular",
      "custom_text[shipping_address][message]": "Envío a España peninsular. No disponible en Canarias, Ceuta y Melilla. Confirma la cobertura antes de pagar.",
      expires_at: String(Math.floor(Date.parse(order.created_at) / 1000) + 3600),
    });
    for (const [index, line] of lines.entries()) {
      params.set(`line_items[${index}][price_data][currency]`, "eur");
      params.set(`line_items[${index}][price_data][unit_amount]`, String(line.unitAmount));
      params.set(`line_items[${index}][price_data][product_data][name]`, line.name);
      params.set(`line_items[${index}][quantity]`, String(line.quantity));
    }
    // An uncertain Stripe/network result keeps the stock reservation. Reconcile
    // it using metadata.order_id and this stable provider idempotency key.
    let session: StripeSession;
    try { session = await stripeRequest(key, "checkout/sessions", params, `cleverphone-${orderId}`); }
    catch (error) {
      // A definitive 4xx cannot have produced a payable session. Network,
      // timeout, conflict, rate-limit and server failures remain uncertain.
      if (error instanceof StripeProviderError && error.definitive) await db.batch(releaseStatements(db, orderId, "failed", new Date().toISOString()));
      throw error;
    }
    await db.prepare("UPDATE orders SET checkout_session_id = ?, updated_at = ? WHERE id = ?").bind(session.id, new Date().toISOString(), orderId).run();
    return checkoutResponse(session, accessToken);
  } catch (error) { return paymentFailure(error); }
}
