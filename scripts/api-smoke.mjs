import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Keep this suite local: it creates temporary records and never books a real shipment.
const env = Object.fromEntries(readFileSync('backend/.env', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^['"]|['"]$/g, '')]; }));
assert.equal(env.AUTO_SHIP, 'false', 'Disable automatic shipping before local QA');

assert(!process.env.RESEND_API_KEY, 'Disable real email before local QA');
assert(process.env.AUTO_SHIP !== 'true' && process.env.NODE_ENV !== 'production', 'Local QA only');
const originalFetch = globalThis.fetch;
const rows = [];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : input);
  assert(['localhost', '127.0.0.1'].includes(url.hostname), 'QA attempted an external request');
  const method = init.method || 'GET';
  const path = url.pathname.replace(/\b(?:prod|variant|iitem|sloc|cart|cus|addr|cuaddr|pay_col|order|file|cali)_[A-Za-z0-9_-]+/g, ':id').replace(/(\/(?:static|admin\/uploads)\/)\S+$/, '$1:key');
  const response = await originalFetch(input, { ...init, signal: init.signal || AbortSignal.timeout(30000) });
  rows.push({ method, path, status: response.status });
  return response;
};

try {
  const preflightLogin = await fetch('http://localhost:9000/auth/user/emailpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: readFileSync('.local/admin-credentials.json', 'utf8') });
  assert.equal(preflightLogin.status, 200);
  const preflightToken = (await preflightLogin.json()).token;
  const preflightResponse = await fetch('http://localhost:9000/admin/gehna/overview', { headers: { Authorization: `Bearer ${preflightToken}` } });
  assert.equal(preflightResponse.status, 200);
  const preflight = await preflightResponse.json();
  assert.equal(preflight.couriers.auto_enabled, false, 'Running backend must disable real shipping');
  assert.equal(preflight.email_ready, false, 'Running backend must disable email');
  for (const suite of ['smoke', 'operations-smoke', 'customer-smoke', 'dashboard-product-smoke', 'assistant-smoke', 'cod-smoke']) {
    await import(`./${suite}.mjs`);
  }
  const credentials = JSON.parse(readFileSync('.local/admin-credentials.json', 'utf8'));
  const login = await fetch('http://localhost:9000/auth/user/emailpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  for (const path of ['/health', '/admin/users/me', '/admin/products', '/admin/inventory-items', '/admin/customers', '/admin/orders']) {
    const response = await fetch('http://localhost:9000' + path, { headers });
    assert.equal(response.status, 200, path);
  }
  const overview = await (await fetch('http://localhost:9000/admin/gehna/overview', { headers })).json();
  const order = overview.order_rows.find(o => o.email.startsWith('codex-cod-'));
  assert(order, 'Missing local COD order for export test');
  const csv = await fetch('http://localhost:9000/admin/gehna/export', { method: 'POST', headers, body: JSON.stringify({ kind: 'csv', order_ids: [order.id] }) });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  assert((await csv.text()).includes(order.id));
  for (const method of ['GET', 'POST']) {
    const response = await fetch('http://localhost:9000/admin/gehna/export', { method, headers, ...(method === 'POST' ? { body: JSON.stringify({ kind: 'labels', order_ids: [order.id] }) } : {}) });
    assert.equal(response.status, 400, 'An unbooked order must not produce a label');
  }
  const stockEnv = Object.fromEntries(readFileSync('storefront/.env.local', 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
  async function store(path, method = 'GET', body, expected = 200) {
    const response = await fetch('http://localhost:9000' + path, { method, headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': stockEnv.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.equal(response.status, expected, `${method} ${path}`);
    return response.json();
  }
  await store('/store/regions');
  const { products } = await store(`/store/products?region_id=${stockEnv.NEXT_PUBLIC_MEDUSA_REGION_ID}&fields=*variants`);
  const { cart } = await store('/store/carts', 'POST', { region_id: stockEnv.NEXT_PUBLIC_MEDUSA_REGION_ID });
  const added = await store(`/store/carts/${cart.id}/line-items`, 'POST', { variant_id: products[0].variants[0].id, quantity: 1 });
  const lineId = added.cart.items[0].id;
  const updated = await store(`/store/carts/${cart.id}/line-items/${lineId}`, 'POST', { quantity: 2 });
  assert.equal(updated.cart.items[0].quantity, 2);
  await store(`/store/carts/${cart.id}/promotions`, 'POST', { promo_codes: ['QA-NONEXISTENT-CODE'] }, 400);
  await store(`/store/carts/${cart.id}/promotions`, 'POST', { promo_codes: [] });
  await store(`/store/carts/${cart.id}/line-items/${lineId}`, 'DELETE');
  const empty = await store(`/store/carts/${cart.id}`);
  assert.equal(empty.cart.items.length, 0);
  const badFile = await fetch('http://localhost:9000/store/files/%21invalid', { headers: { 'x-publishable-api-key': stockEnv.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY } });
  assert.equal(badFile.status, 400);
  console.log('All commerce API smoke suites passed. Expected 400/401/403/404 responses verified.');
} finally {
  try { await import('./cleanup-cod-smoke.mjs'); } finally {
    mkdirSync('.local', { recursive: true });
    const endpoints = [...new Set(rows.map(r => `${r.method} ${r.path}`))].sort().map(endpoint => ({ endpoint, statuses: [...new Set(rows.filter(r => `${r.method} ${r.path}` === endpoint).map(r => r.status))] }));
    writeFileSync('.local/api-qa-results.json', JSON.stringify({ date: new Date().toISOString(), requests: rows.length, endpoints }, null, 2));
    globalThis.fetch = originalFetch;
    console.log(`API evidence: ${rows.length} requests; ${endpoints.length} endpoint/method combinations. Saved to .local/api-qa-results.json`);
  }
}
