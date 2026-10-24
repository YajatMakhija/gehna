import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const base = 'http://localhost:9000';
const owner = JSON.parse(readFileSync('.local/admin-credentials.json', 'utf8'));
const login = await fetch(base + '/auth/user/emailpass', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(owner) });
assert.equal(login.status, 200);
const { token } = await login.json();
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
for (const method of ['GET', 'POST']) {
  const denied = await fetch(base + '/admin/gehna/assistant', { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'POST' ? { body: '{}' } : {}) });
  assert.equal(denied.status, 401);
}
const status = await fetch(base + '/admin/gehna/assistant', { headers });
assert.equal(status.status, 200);
assert.equal(typeof (await status.json()).ready, 'boolean');
const me = await (await fetch(base + '/admin/users/me', { headers })).json();
const profiles = await (await fetch(base + '/admin/shipping-profiles', { headers })).json();
const created = await fetch(base + '/admin/products', { method: 'POST', headers, body: JSON.stringify({ title: 'Assistant QA draft', handle: 'assistant-qa-' + Date.now(), status: 'draft', options: [{ title: 'Size', values: ['One size'] }], variants: [{ title: 'One size', options: { Size: 'One size' }, prices: [{ currency_code: 'inr', amount: 100 }] }], shipping_profile_id: profiles.shipping_profiles.find(p => p.type === 'default').id, metadata: { gehna_ai_generated: true, gehna_ai_actor: me.user.id } }) });
const createdData = await created.json();
assert.equal(created.status, 200, JSON.stringify(createdData));
const { product } = createdData;
try {
  for (let i = 0; i < 2; i++) {
    const published = await fetch(base + '/admin/gehna/assistant', { method: 'POST', headers, body: JSON.stringify({ action: 'publish', product_id: product.id }) });
    assert.equal(published.status, 200);
    assert.equal((await published.json()).product.status, 'published');
  }
} finally {
  const removed = await fetch(base + '/admin/products/' + product.id, { method: 'DELETE', headers });
  assert.equal(removed.status, 200);
}
console.log('Assistant admin-only access, configuration status, draft publishing and repeat-publish checks passed. No OpenAI calls made.');
