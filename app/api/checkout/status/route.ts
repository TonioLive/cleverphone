import { PaymentError, sha256 } from "@/lib/payment-guards";
import { ORDER_COOKIE, paymentConfig, paymentDatabase, paymentFailure, paymentResponse, sessionMatchesOrder, stripeRequest, type OrderRow } from "@/lib/payments";

export async function GET(request: Request) {
  try {
    // Existing payments stay verifiable after pausing new sales.
    const { key, siteUrl } = paymentConfig(false);
    if (new URL(request.url).origin !== siteUrl || request.headers.get("Sec-Fetch-Site") === "cross-site") throw new PaymentError("Solicitud no autorizada.", 403);
    const sessionId = new URL(request.url).searchParams.get("session_id");
    const token = request.headers.get("Cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ORDER_COOKIE}=`))?.slice(ORDER_COOKIE.length + 1);
    if (!sessionId || !/^cs_(test_|live_)?[A-Za-z0-9]{16,240}$/.test(sessionId) || !token || !/^[a-f0-9-]{36}$/.test(token)) throw new PaymentError("No encontramos una sesión de compra en este navegador.", 404);
    const order = await paymentDatabase().prepare("SELECT * FROM orders WHERE checkout_session_id = ? AND access_token_hash = ?").bind(sessionId, await sha256(token)).first<OrderRow>();
    if (!order) throw new PaymentError("Sesión de compra no encontrada.", 404);
    const session = await stripeRequest(key, `checkout/sessions/${encodeURIComponent(sessionId)}`);
    if (!sessionMatchesOrder(session, order, key)) throw new PaymentError("Este pago necesita revisión antes de confirmar el pedido.", 409);
    return paymentResponse({ paid: order.status === "paid" && session.status === "complete" && session.payment_status === "paid", total: order.amount_total, currency: order.currency });
  } catch (error) { return paymentFailure(error); }
}
