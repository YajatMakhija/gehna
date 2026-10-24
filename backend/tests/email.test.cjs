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
  const shipment = emailContent(order, 'shipment'); assert(shipment.html.includes('AWB123456')); assert(shipment.html.includes('on delivery'));
  const before = { key: process.env.RESEND_API_KEY, from: process.env.ORDER_EMAIL_FROM, fetch: global.fetch };
  process.env.RESEND_API_KEY = 'test-only'; process.env.ORDER_EMAIL_FROM = 'Gehna <orders@example.invalid>';
  let sends = 0;
  global.fetch = async (url, init) => { sends++; assert.equal(url, 'https://api.resend.com/emails'); assert.equal(init.headers['Idempotency-Key'], 'gehna-order-order_test'); const payload = JSON.parse(init.body); assert.deepEqual(payload.to, [order.email]); assert(payload.text); assert(payload.html.includes('gehna-logo.png')); return new Response(JSON.stringify({ id: 'email_test' }), { status: 200 }); };
  const scope = { resolve: key => key === '__pg_connection__' ? { transaction: async callback => callback({ raw: async () => {} }) } : key === 'query' ? { graph: async () => ({ data: [order] }) } : key === 'order' ? { updateOrders: async (_id, { metadata }) => { order.metadata = metadata; } } : (() => { throw new Error('Unexpected ' + key); })() };
  try { await sendOrderEmail(scope, order.id, 'order'); await sendOrderEmail(scope, order.id, 'order'); assert.equal(sends, 1); assert(order.metadata.gehna_emails.order.sent_at); }
  finally { global.fetch = before.fetch; if (before.key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = before.key; if (before.from === undefined) delete process.env.ORDER_EMAIL_FROM; else process.env.ORDER_EMAIL_FROM = before.from; }
});
