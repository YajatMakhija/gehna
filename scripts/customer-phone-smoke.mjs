import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = 'http://localhost:9000';
const env = Object.fromEntries(readFileSync('storefront/.env.local', 'utf8').split(/\r?\n/).filter(Boolean).map(line => line.split(/=(.*)/s).slice(0, 2)));
const key = env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
const email = `codex-phone-${randomBytes(5).toString('hex')}@example.test`;
const password = randomBytes(18).toString('base64url');
const phone = '9876543210';
let customerId;

async function request(path, method = 'GET', body, token, admin = false) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(admin ? {} : { 'x-publishable-api-key': key }), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

try {
  const anonymous = await request('/store/gehna/phone');
  assert.equal(anonymous.status, 401);
  const registered = await request('/auth/customer/emailpass/register', 'POST', { email, password });
  assert.equal(registered.status, 200);
  const created = await request('/store/customers', 'POST', { email, first_name: 'Phone', last_name: 'QA', phone }, registered.data.token);
  assert.equal(created.status, 200); customerId = created.data.customer.id;
  const login = await request('/auth/customer/emailpass', 'POST', { email, password });
  assert.equal(login.status, 200); const token = login.data.token;
  let status = await request('/store/gehna/phone', 'GET', undefined, token);
  assert.equal(status.status, 200); assert.equal(status.data.verified, false); assert.equal(status.data.local_preview, true);
  const forged = await request('/store/customers/me', 'POST', { metadata: { gehna_phone_verified: '+919876543210', gehna_phone_verified_at: new Date().toISOString(), gehna_phone_verified_method: 'local', gehna_phone_verified_sig: '0'.repeat(64) } }, token);
  assert.equal(forged.status, 200);
  status = await request('/store/gehna/phone', 'GET', undefined, token);
  assert.equal(status.data.verified, false);
  let gate = await request('/store/payment-collections/invalid/payment-sessions', 'POST', { provider_id: 'pp_system_default' }, token);
  assert.equal(gate.status, 403); assert.match(gate.data.message, /Verify your mobile/);
  let complete = await request('/store/carts/invalid/complete', 'POST', {}, token);
  assert.equal(complete.status, 403);
  const sent = await request('/store/gehna/phone', 'POST', { action: 'start', phone }, token);
  assert.equal(sent.status, 200); assert.match(sent.data.dev_code, /^\d{6}$/);
  const wrong = await request('/store/gehna/phone', 'POST', { action: 'verify', phone, code: '000000' === sent.data.dev_code ? '111111' : '000000' }, token);
  assert.equal(wrong.status, 400);
  const checked = await request('/store/gehna/phone', 'POST', { action: 'verify', phone, code: sent.data.dev_code }, token);
  assert.equal(checked.status, 200); assert.equal(checked.data.verified, true);
  status = await request('/store/gehna/phone', 'GET', undefined, token);
  assert.equal(status.data.verified, true);
  gate = await request('/store/payment-collections/invalid/payment-sessions', 'POST', { provider_id: 'pp_system_default' }, token);
  assert.notEqual(gate.status, 403);
  complete = await request('/store/carts/invalid/complete', 'POST', {}, token);
  assert.notEqual(complete.status, 403);
  const products = await request(`/store/products?region_id=${env.NEXT_PUBLIC_MEDUSA_REGION_ID}&fields=id,title,*variants,variants.inventory_quantity&limit=10`);
  assert.equal(products.status, 200); assert(products.data.products.length > 0);
  const cart = await request('/store/carts', 'POST', { region_id: env.NEXT_PUBLIC_MEDUSA_REGION_ID }, token);
  assert.equal(cart.status, 200);
  const linked = await request(`/store/carts/${cart.data.cart.id}/customer`, 'POST', {}, token);
  assert.equal(linked.status, 200);
  const line = await request(`/store/carts/${cart.data.cart.id}/line-items`, 'POST', { variant_id: products.data.products[0].variants[0].id, quantity: 1 }, token);
  assert.equal(line.status, 200); assert.equal(line.data.cart.items.length, 1);
  const changed = await request('/store/customers/me', 'POST', { phone: '9123456789' }, token);
  assert.equal(changed.status, 200);
  status = await request('/store/gehna/phone', 'GET', undefined, token);
  assert.equal(status.data.verified, false);
  gate = await request('/store/payment-collections/invalid/payment-sessions', 'POST', { provider_id: 'pp_system_default' }, token);
  assert.equal(gate.status, 403);
  console.log('Customer signup, mobile OTP, payment gate and add-to-cart passed. No SMS or order was sent.');
} finally {
  if (customerId) {
    const owner = JSON.parse(readFileSync('.local/admin-credentials.json', 'utf8'));
    const login = await request('/auth/user/emailpass', 'POST', owner, undefined, true);
    if (login.status === 200) {
      const removed = await request('/admin/customers/' + customerId, 'DELETE', undefined, login.data.token, true);
      assert.equal(removed.status, 200, 'Disposable QA customer cleanup failed');
    }
  }
}
