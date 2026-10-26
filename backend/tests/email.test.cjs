const { test } = require('node:test');
const assert = require('node:assert/strict');
const { emailContent, sendOrderEmail } = require('../src/lib/order-email.ts');
test('order and AWB emails escape customer data and send only once', async () => {
  const order = { id: 'order_test', display_id: 15, email: 'qa@example.invalid', total: 1080, currency_code: 'inr', status: 'pending', payment_status: 'authorized', shipping_address: { first_name: '<script>' }, items: [{ title: '<ring>', quantity: 1 }], payment_collections: [{ authorized_amount: 1080, captured_amount: 0, refunded_amount: 0, payments: [{ provider_id: 'pp_system_default' }] }], metadata: { gehna_shipment: { awb: 'AWB123456', courier: 'delhivery' } } };
  const content = emailContent(order, 'order');
  assert(content.html.includes('&lt;script&gt;')); assert(content.html.includes('&lt;ring&gt;')); assert(!content.html.includes('<script>'));
  assert(content.html.includes('https://gehnadesigns.in/images/gehna-logo.png'));
  assert(content.html.includes('alt="Gehna"'));
  assert(content.html.includes('View my orders'));
  assert(content.text.includes('on delivery'));
  assert(content.html.includes('Shiprocket tracking ID (AWB)'));
  assert(content.html.includes('AWB123456'));
  assert(content.text.includes('Shiprocket tracking ID (AWB): AWB123456'));
  assert(content.html.includes('href="https://www.shiprocket.in/shipment-tracking/"'));
  const shipment = emailContent(order, 'shipment'); assert(shipment.html.includes('AWB123456')); assert(shipment.html.includes('on delivery'));
  const before = { key: process.env.RESEND_API_KEY, from: process.env.ORDER_EMAIL_FROM, fetch: global.fetch };
  process.env.RESEND_API_KEY = 'test-only'; process.env.ORDER_EMAIL_FROM = 'Gehna <orders@example.invalid>';
  let sends = 0;
  global.fetch = async (url, init) => { sends++; assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init.headers['Idempotency-Key'], 'gehna-order-order_test'); const payload = JSON.parse(init.body); assert.deepEqual(payload.to, [order.email]); assert(payload.text); assert(payload.html.includes('gehna-logo.png')); return new Response(JSON.stringify({ id: 'email_test' }), { status: 200 }); };
  const scope = { resolve: key => key === '__pg_connection__' ? { transaction: async callback => callback({ raw: async () => {} }) } : key === 'query' ? { graph: async () => ({ data: [order] }) } : key === 'order' ? { updateOrders: async (_id, { metadata }) => { order.metadata = metadata; } } : (() => { throw new Error('Unexpected ' + key); })() };
  try { await sendOrderEmail(scope, order.id, 'order'); await sendOrderEmail(scope, order.id, 'order'); assert.equal(sends, 1); assert(order.metadata.gehna_emails.order.sent_at); }
  finally { global.fetch = before.fetch; if (before.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = before.key; if (before.from === undefined) delete process.env.ORDER_EMAIL_FROM; else process.env.ORDER_EMAIL_FROM = before.from; }
});

test('confirmation and booking emails link assigned tracking safely and explain pending AWBs', () => {
  const order = { display_id: 16, items: [], metadata: { gehna_shipment: { awb: 'AWB123456', courier_name: 'Delhivery', tracking_url: 'https://track.example.test/parcel?awb=AWB123456&source=email' } } };
  for (const kind of ['order', 'shipment']) {
    const content = emailContent(order, kind);
    assert(content.html.includes('href="https://track.example.test/parcel?awb=AWB123456&amp;source=email"'));
    assert(content.text.includes('https://track.example.test/parcel?awb=AWB123456&source=email'));
    assert(content.html.includes('Delhivery'));
    assert(content.html.includes('How to track'));
    assert(content.text.includes('1. Open the tracking link above.'));
    assert(content.text.includes('2. If prompted, enter AWB123456 as the tracking number and select Track.'));
    assert(!content.html.includes('will email your Shiprocket tracking ID'));
  }
  for (const tracking_url of ['javascript:alert(1)', 'http://track.example.test/', 'not a URL', 'https://user:password@track.example.test/']) {
    const content = emailContent({ ...order, metadata: { gehna_shipment: { ...order.metadata.gehna_shipment, tracking_url } } }, 'order');
    assert(content.html.includes('href="https://www.shiprocket.in/shipment-tracking/"'));
    assert(!content.html.includes('href="' + tracking_url + '"'));
  }
  const pending = emailContent({ ...order, metadata: {} }, 'order');
  assert(pending.html.includes('will email your Shiprocket tracking ID as soon as your courier is booked'));
  assert(pending.text.includes('tracking ID will be emailed'));
  assert(!pending.html.includes('Track your order</a>'));
  assert(!pending.text.includes('undefined'));
});
