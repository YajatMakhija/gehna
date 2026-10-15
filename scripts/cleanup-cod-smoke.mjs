import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = 'http://localhost:9000';
const owner = JSON.parse(readFileSync('.local/admin-credentials.json', 'utf8'));
const login = await fetch(base + '/auth/user/emailpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(owner) });
assert.equal(login.status, 200);
const { token } = await login.json();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const month = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date());
const response = await fetch(`${base}/admin/gehna/overview?month=${month}&q=codex-cod-`, { headers });
assert.equal(response.status, 200);
const dashboard = await response.json();
assert(dashboard.total <= 25, 'Too many matching orders for safe cleanup; inspect manually.');
let canceled = 0;
for (const order of dashboard.order_rows) {
  if (!/^codex-cod-[a-f0-9]{10}@example\.test$/.test(order.email) || order.status === 'canceled') continue;
  const result = await fetch(`${base}/admin/orders/${order.id}/cancel`, { method: 'POST', headers, body: '{}' });
  if (!result.ok) throw new Error(`Could not cancel local QA order #${order.display_id}: HTTP ${result.status}`);
  canceled++;
}
console.log(`Canceled ${canceled} local COD QA orders. Existing customer/order records remain for audit.`);
