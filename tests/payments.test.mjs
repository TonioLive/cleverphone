import { after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { assertSameOrigin, validateCart, validatedSiteUrl, verifyStripeSignature } from '../lib/payment-guards.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = globalThis.__paymentTestEnv = {};
const fakeCatalog = [
  { id: 'good', brand: 'Test', model: '13', storage: '128 GB', condition: 'new', price: 199.99, verified: true, availabilityStatus: 'in_stock' },
  { id: 'unverified', brand: 'Test', model: '14', storage: '128 GB', condition: 'new', price: 299.99, verified: false, availabilityStatus: 'pending_supplier_confirmation' },
];
async function route(entry) {
  const result = await build({
    entryPoints: [path.join(root, entry)], absWorkingDir: root, bundle: true, write: false,
    platform: 'node', format: 'esm', logLevel: 'silent',
    plugins: [{ name: 'isolated-payment-test', setup(builder) {
      builder.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'payment-test' }));
      builder.onResolve({ filter: /data\/catalog\.json$/ }, () => ({ path: 'catalog', namespace: 'payment-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'payment-test' }, (args) => ({ contents: args.path === 'env' ? 'export const env = globalThis.__paymentTestEnv;' : `export default ${JSON.stringify(fakeCatalog)};`, loader: 'js' }));
    } }],
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const checkout = await route('app/api/checkout/route.ts');
const webhook = await route('app/api/stripe/webhook/route.ts');
const status = await route('app/api/checkout/status/route.ts');
const sqlFiles = (await readdir(path.join(root, 'drizzle'))).filter((name) => name.endsWith('.sql')).sort();
const migrations = await Promise.all(sqlFiles.map((name) => readFile(path.join(root, 'drizzle', name), 'utf8')));
const originalFetch = globalThis.fetch;
let sqlite;
let sessions;
let creates;
let failure;
let failBatch;

function d1(database) {
  function statement(sql, args = []) {
    return {
      bind(...values) { return statement(sql, values); },
      execute() { return database.prepare(sql).run(...args); },
      async run() { return { success: true, meta: this.execute() }; },
      async first() { return database.prepare(sql).get(...args) ?? null; },
      async all() { return { success: true, results: database.prepare(sql).all(...args) }; },
    };
  }
  return {
    prepare: statement,
    async batch(statements) {
      if (failBatch) throw new Error('Simulated D1 failure');
      database.exec('BEGIN');
      try {
        const results = statements.map((item) => ({ success: true, meta: item.execute() }));
        database.exec('COMMIT');
        return results;
      } catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
}

beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const sql of migrations) sqlite.exec(sql);
  sqlite.prepare('INSERT INTO inventory (sku,available,enabled,updated_at) VALUES (?,2,1,?)').run('good', new Date().toISOString());
  Object.keys(env).forEach((key) => delete env[key]);
  Object.assign(env, { STORE_LIVE: 'true', SITE_URL: 'https://store.example', STRIPE_SECRET_KEY: 'sk_test_abcdefghijklmnopqrstuvwxyz', STRIPE_WEBHOOK_SECRET: 'whsec_test_signatures_only', DB: d1(sqlite) });
  sessions = new Map(); creates = 0; failure = null; failBatch = false;
  globalThis.fetch = async (url, options = {}) => {
    assert.ok(String(url).startsWith('https://api.stripe.com/v1/checkout/sessions'));
    if (failure === 'network') throw new TypeError('Simulated network failure');
    if (failure === 'invalid') return Response.json({ error: { type: 'invalid_request_error' } }, { status: 400 });
    if (failure === 'idempotency') return Response.json({ error: { type: 'idempotency_error' } }, { status: 400 });
    if (options.method === 'POST') {
      creates++;
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('line_items[0][price_data][unit_amount]'), '19999');
      assert.equal(form.get('shipping_options[0][shipping_rate_data][fixed_amount][amount]'), '490');
      assert.equal(form.get('allowed_payment_method_types[0]'), 'card');
      assert.equal(form.get('payment_method_types[0]'), null);
      assert.equal(form.get('success_url'), 'https://store.example/?session_id={CHECKOUT_SESSION_ID}');
      const id = `cs_test_${String(creates).padStart(24, '0')}`;
      const session = { id, object: 'checkout.session', url: `https://checkout.stripe.com/c/pay/${id}`, amount_total: 19999 * Number(form.get('line_items[0][quantity]')) + 490, currency: 'eur', mode: 'payment', livemode: false, status: 'open', payment_status: 'unpaid', metadata: { shop: form.get('metadata[shop]'), order_id: form.get('metadata[order_id]') } };
      sessions.set(id, session);
      return Response.json(session);
    }
    const session = sessions.get(String(url).split('/').at(-1));
    assert.ok(session, 'retrieved session exists in fake Stripe');
    return Response.json(session);
  };
});
after(() => { sqlite?.close(); globalThis.fetch = originalFetch; delete globalThis.__paymentTestEnv; });

function buy(items = [{ id: 'good', quantity: 1 }], key = randomUUID()) {
  return checkout.POST(new Request('https://store.example/api/checkout', { method: 'POST', headers: { Origin: 'https://store.example', 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify({ items }) }));
}
function signedEvent(session, type = 'checkout.session.completed', id = 'evt_test123', age = 0) {
  const timestamp = Math.floor(Date.now() / 1000) - age;
  const raw = JSON.stringify({ id, type, data: { object: { id: session.id } } });
  const signature = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.${raw}`).digest('hex');
  return new Request('https://store.example/api/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${timestamp},v1=${signature}` }, body: raw });
}
function oneOrder() { return sqlite.prepare('SELECT * FROM orders').get(); }
function stock() { return sqlite.prepare('SELECT available FROM inventory WHERE sku = ?').get('good').available; }
function session() { return [...sessions.values()][0]; }
function checkStatus(response) {
  return status.GET(new Request(`https://store.example/api/checkout/status?session_id=${session().id}`, { headers: { Cookie: response.headers.get('Set-Cookie').split(';')[0] } }));
}

test('payments are disabled by default before touching stock or Stripe', async () => {
  delete env.STORE_LIVE;
  const response = await buy();
  assert.equal(response.status, 503); assert.equal(stock(), 2); assert.equal(creates, 0);
  assert.match((await response.json()).error, /Pagos no activos/);
});
test('unverified products cannot be purchased', async () => {
  assert.equal((await buy([{ id: 'unverified', quantity: 1 }])).status, 409);
  assert.equal(oneOrder(), undefined); assert.equal(creates, 0);
});
test('server price plus shipping overrides a forged client price', async () => {
  const response = await buy([{ id: 'good', quantity: 1, price: 0.01 }]);
  assert.equal(response.status, 200); assert.equal(oneOrder().amount_total, 20489);
  assert.equal(stock(), 1); assert.equal(session().amount_total, 20489);
});
test('same idempotency key recovers one session and reserves once', async () => {
  const key = randomUUID();
  const first = await buy(undefined, key); const second = await buy(undefined, key);
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.deepEqual(await first.json(), await second.json()); assert.equal(creates, 1); assert.equal(stock(), 1);
});
test('reusing a checkout attempt with a different cart is rejected', async () => {
  const key = randomUUID(); await buy(undefined, key);
  assert.equal((await buy([{ id: 'good', quantity: 2 }], key)).status, 409);
  assert.equal(stock(), 1); assert.equal(creates, 1);
});
test('two buyers for the last unit cannot oversell or leave a partial order', async () => {
  sqlite.prepare('UPDATE inventory SET available = 1').run();
  const responses = await Promise.all([buy(), buy()]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
  assert.equal(stock(), 0); assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM orders').get().n, 1);
});
test('definitive Stripe 4xx releases stock and marks the order failed', async () => {
  failure = 'invalid'; assert.equal((await buy()).status, 502);
  assert.equal(stock(), 2); assert.equal(oneOrder().status, 'failed');
});
test('uncertain network failure retains reservation for reconciliation', async () => {
  failure = 'network'; assert.equal((await buy()).status, 503);
  assert.equal(stock(), 1); assert.equal(oneOrder().status, 'pending');
});
test('Stripe idempotency conflicts retain stock because an earlier session may exist', async () => {
  failure = 'idempotency'; assert.equal((await buy()).status, 502);
  assert.equal(stock(), 1); assert.equal(oneOrder().status, 'pending');
});
test('valid webhook verifies Stripe, persists payment, and deduplicates deliveries', async () => {
  const purchase = await buy(); Object.assign(session(), { status: 'complete', payment_status: 'paid' });
  assert.equal((await webhook.POST(signedEvent(session()))).status, 200);
  assert.equal((await webhook.POST(signedEvent(session()))).status, 200);
  assert.equal(oneOrder().status, 'paid'); assert.equal(stock(), 1);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM stripe_events').get().n, 1);
  assert.deepEqual(await (await checkStatus(purchase)).json(), { paid: true, total: 20489, currency: 'eur' });
});
test('invalid or stale signatures cannot mark an order paid', async () => {
  await buy(); Object.assign(session(), { status: 'complete', payment_status: 'paid' });
  const forged = new Request('https://store.example/api/stripe/webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${Math.floor(Date.now() / 1000)},v1=${'a'.repeat(64)}` }, body: '{}' });
  assert.equal((await webhook.POST(forged)).status, 400);
  assert.equal((await webhook.POST(signedEvent(session(), undefined, undefined, 301))).status, 400);
  assert.equal(oneOrder().status, 'pending');
});
test('expiration returns stock only once, including separate repeated events', async () => {
  await buy(); Object.assign(session(), { status: 'expired' });
  assert.equal((await webhook.POST(signedEvent(session(), 'checkout.session.expired', 'evt_expire1'))).status, 200);
  assert.equal((await webhook.POST(signedEvent(session(), 'checkout.session.expired', 'evt_expire2'))).status, 200);
  assert.equal(stock(), 2); assert.equal(oneOrder().status, 'expired');
});
test('D1 write failure does not acknowledge a webhook or confirm payment', async () => {
  const purchase = await buy(); Object.assign(session(), { status: 'complete', payment_status: 'paid' }); failBatch = true;
  assert.equal((await webhook.POST(signedEvent(session()))).status, 503);
  assert.equal(oneOrder().status, 'pending'); assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM stripe_events').get().n, 0);
  assert.deepEqual(await (await checkStatus(purchase)).json(), { paid: false, total: 20489, currency: 'eur' });
});
test('a success query without the private checkout cookie reveals no payment', async () => {
  await buy();
  assert.equal((await status.GET(new Request(`https://store.example/api/checkout/status?session_id=${session().id}`))).status, 404);
});
test('guardrails enforce combined quantities, trusted HTTPS origin, and exact raw bytes', async () => {
  assert.throws(() => validateCart({ items: [{ id: 'good', quantity: 3 }, { id: 'good', quantity: 3 }] }, fakeCatalog));
  assert.throws(() => validateCart({ items: [{ id: 'good', quantity: 1.1 }] }, fakeCatalog));
  assert.throws(() => validatedSiteUrl('http://store.example'));
  assert.throws(() => validatedSiteUrl('https://store.example/redirect'));
  assert.throws(() => assertSameOrigin(new Request('https://store.example/api/checkout', { headers: { Origin: 'https://evil.example' } }), 'https://store.example'));
  const raw = Buffer.from('\ufeff{"x":"á"}'); const timestamp = Math.floor(Date.now() / 1000);
  const hmac = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(`${timestamp}.`).update(raw).digest('hex');
  assert.equal(await verifyStripeSignature(raw, `t=${timestamp},v1=${hmac}`, env.STRIPE_WEBHOOK_SECRET), true);
  assert.equal(await verifyStripeSignature(Buffer.from('{"x":"á"}'), `t=${timestamp},v1=${hmac}`, env.STRIPE_WEBHOOK_SECRET), false);
});


test('selected colours are preserved only against a confirmed colour SKU', () => {
  const product={...fakeCatalog[0],color:'Azul'};
  const line=validateCart({items:[{id:'good',quantity:1,color:'Blue'}]},[product])[0];
  assert.match(line.name,/Blue/);
  assert.throws(()=>validateCart({items:[{id:'good',quantity:1,color:'Negro'}]},[product]),/color elegido/);
  assert.throws(()=>validateCart({items:[{id:'good',quantity:1,color:'Azul'}]},fakeCatalog),/color elegido/);
  assert.throws(()=>validateCart({items:[{id:'good',quantity:1,color:'Azul'},{id:'good',quantity:1,color:'Negro'}]},[product]),/referencia de venta independiente/);
});


test('hidden catalogue references cannot be bought even if accidentally marked live', () => {
  assert.throws(()=>validateCart({items:[{id:'good',quantity:1}]},[{...fakeCatalog[0],hidden:true}]),/ya no está en el catálogo/);
});
