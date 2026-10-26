import { PaymentError, readLimitedBody, verifyStripeSignature } from "@/lib/payment-guards";
import { paymentConfig, paymentDatabase, paymentFailure, paymentResponse, releaseStatements, sessionMatchesOrder, stripeRequest, type OrderRow } from "@/lib/payments";

const supportedEvents = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed", "checkout.session.expired"]);

export async function POST(request: Request) {
  try {
    // Late events must still be recorded after STORE_LIVE pauses new orders.
    const { key, webhookSecret } = paymentConfig(false);
    const raw = await readLimitedBody(request, 1_048_576);
    if (!await verifyStripeSignature(raw, request.headers.get("Stripe-Signature"), webhookSecret)) throw new PaymentError("Firma de webhook no válida.", 400);
    let event: { id?: string; type?: string; data?: { object?: { id?: string } } };
    try { event = JSON.parse(new TextDecoder().decode(raw)); }
    catch { throw new PaymentError("Evento no válido.", 400); }
    if (!event || typeof event.id !== "string" || !/^evt_[A-Za-z0-9]+$/.test(event.id) || typeof event.type !== "string") throw new PaymentError("Evento no válido.", 400);
    if (!supportedEvents.has(event.type)) return paymentResponse({ received: true, ignored: true });
    const sessionId = event.data?.object?.id;
    if (typeof sessionId !== "string" || !/^cs_(test_|live_)?[A-Za-z0-9]{16,240}$/.test(sessionId)) throw new PaymentError("Sesión no válida.", 400);
    const db = paymentDatabase();
    const duplicate = await db.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(event.id).first();
    if (duplicate) return paymentResponse({ received: true });
    // Retrieve current authoritative state; webhook delivery order and browser
    // success URLs cannot determine payment or fulfillment.
    const session = await stripeRequest(key, `checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (session.metadata?.shop !== "cleverphone" || !session.metadata.order_id) return paymentResponse({ received: true, ignored: true });
    const order = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(session.metadata.order_id).first<OrderRow>();
    if (!order) throw new PaymentError("Pedido pendiente de conciliación. Reintentar el evento.", 503);
    if (!sessionMatchesOrder(session, order, key)) throw new PaymentError("Pago pendiente de revisión de importe o moneda.", 409);
    const now = new Date().toISOString();
    const statements = [db.prepare("INSERT OR IGNORE INTO stripe_events (id, type, session_id, received_at) VALUES (?, ?, ?, ?)").bind(event.id, event.type, session.id, now)];
    statements.push(db.prepare("UPDATE orders SET checkout_session_id = COALESCE(checkout_session_id, ?), updated_at = ? WHERE id = ?").bind(session.id, now, order.id));
    if (session.status === "complete" && session.payment_status === "paid") {
      statements.push(db.prepare("UPDATE orders SET status = CASE WHEN status IN ('pending', 'paid') THEN 'paid' ELSE 'payment_review' END, updated_at = ? WHERE id = ?").bind(now, order.id));
    } else if (session.status === "expired") {
      statements.push(...releaseStatements(db, order.id, "expired", now));
    } else if (event.type === "checkout.session.async_payment_failed" && session.payment_status !== "paid") {
      statements.push(...releaseStatements(db, order.id, "failed", now));
    }
    // Await durable atomic recording. A D1 failure returns non-2xx for Stripe
    // to retry. No fulfillment is executed by this handler.
    await db.batch(statements);
    return paymentResponse({ received: true });
  } catch (error) { return paymentFailure(error); }
}
