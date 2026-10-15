import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = 'http://localhost:9000';
const credentials = JSON.parse(readFileSync('.local/admin-credentials.json', 'utf8'));
const login = await fetch(base + '/auth/user/emailpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) });
assert.equal(login.status, 200); const { token } = await login.json();
const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
for (const path of ['/admin/gehna/overview', '/admin/gehna/export', '/admin/gehna/shipments']) {
  const response = await fetch(base + path, { method: path.endsWith('overview') ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' }, ...(path.endsWith('overview') ? {} : { body: '{}' }) });
  assert.equal(response.status, 401, path + ' must require owner login');
}
const response = await fetch(base + '/admin/gehna/overview', { headers }); assert.equal(response.status, 200);
const data = await response.json(); assert.equal(data.couriers.provider, 'shiprocket'); assert(Array.isArray(data.order_rows)); assert(Array.isArray(data.finance.months)); assert.equal(data.finance.selected.month, data.finance.month);
const invalid = await fetch(base + '/admin/gehna/overview?month=2026-13', { headers }); assert.equal(invalid.status, 400);
const exportBad = await fetch(base + '/admin/gehna/export', { method: 'POST', headers, body: JSON.stringify({ kind: 'labels', order_ids: [] }) }); assert.equal(exportBad.status, 400);
const actionBad = await fetch(base + '/admin/gehna/shipments', { method: 'POST', headers, body: JSON.stringify({ action: 'book', order_id: 'invalid' }) }); assert.equal(actionBad.status, 400);
const unknown = await fetch(base + '/admin/gehna/shipments', { method: 'POST', headers, body: JSON.stringify({ action: 'book', order_id: 'order_qa_does_not_exist' }) }); assert.equal(unknown.status, 400); assert.match((await unknown.json()).message, /Order not found/);
console.log('Dashboard API, India-month reporting, owner-only access and input validation passed. No shipment, order or payment created.');
