const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReturn, returnableQuantity, customerOrder, customerReturn, returnWindow } = require('../src/lib/returns.ts');
const order = { id: 'order_test', customer_id: 'cus_owner', status: 'pending', fulfillments: [{ delivered_at: new Date(Date.now() - 3600000).toISOString() }], items: [{ id: 'item_test', detail: { delivered_quantity: 2, return_requested_quantity: 0, return_received_quantity: 0 } }] };
const input = { reason: 'The clasp is damaged.', items: [{ id: 'item_test', quantity: 1 }] };

test('two-day returns use delivery, include the cutoff, and cannot be extended by another delivery', () => {
  const delivered = Date.parse('2026-10-29T10:00:00Z'), cutoff = delivered + 48 * 60 * 60 * 1000;
  const fixture = { ...order, created_at: '2026-09-01T00:00:00Z', fulfillments: [{ delivered_at: new Date(delivered).toISOString() }] };
  for (const now of [delivered, cutoff - 1, cutoff]) assert.equal(validateReturn(fixture, 'cus_owner', input, [], now).items.length, 1);
  assert.throws(() => validateReturn(fixture, 'cus_owner', input, [], cutoff + 1), /within 2 days/);
  assert.throws(() => validateReturn(fixture, 'cus_owner', input, [], delivered - 1), /within 2 days/);
  assert.equal(returnWindow(fixture, cutoff).expires_at, '2026-10-31T10:00:00.000Z');
  for (const fulfillments of [[], [{ delivered_at: 'invalid' }], [{ delivered_at: new Date(delivered).toISOString(), canceled_at: '2026-10-30' }]]) assert.equal(returnWindow({ ...fixture, fulfillments }, cutoff).open, false);
  assert.equal(returnWindow({ ...fixture, fulfillments: [...fixture.fulfillments, { delivered_at: new Date(cutoff).toISOString() }] }, cutoff + 1).open, false);
  assert.equal(returnWindow(fixture, cutoff + 1).expired, true);
});
test('returns require ownership, delivered items, exact quantities and no active request', () => {
  assert.equal(validateReturn(order, 'cus_owner', input, []).items[0].quantity, 1);
  for (const [o, customer, body, returns] of [[order, 'cus_other', input, []], [{ ...order, status: 'canceled' }, 'cus_owner', input, []], [order, 'cus_owner', input, [{ status: 'open' }]], [order, 'cus_owner', { ...input, items: [...input.items, ...input.items] }, []], [order, 'cus_owner', { ...input, reason: 'no' }, []]]) assert.throws(() => validateReturn(o, customer, body, returns));
  for (const quantity of [0, -1, 1.5, '1', 3]) assert.throws(() => validateReturn(order, 'cus_owner', { ...input, items: [{ id: 'item_test', quantity }] }, []));
  assert.throws(() => validateReturn(order, 'cus_owner', { ...input, items: [{ id: 'someone_else_item', quantity: 1 }] }, []));
  assert.equal(returnableQuantity({ detail: { delivered_quantity: 3, return_requested_quantity: 1, return_received_quantity: 1 } }), 1);
  assert.equal(returnableQuantity({ detail: { delivered_quantity: 1, return_requested_quantity: 0, return_dismissed_quantity: 1 } }), 0);
  assert.equal(returnableQuantity({ detail: { shipped_quantity: 2 } }), 0);
});
test('customer order lookup filters by authenticated customer and status is safe to expose', async () => {
  const scope = { resolve: () => ({ graph: async ({ filters }) => { assert.deepEqual(filters, { id: 'order_test', customer_id: 'cus_owner' }); return { data: [order] }; } }) };
  assert.equal((await customerOrder(scope, 'cus_owner', 'order_test')).id, order.id);
  await assert.rejects(customerOrder({ resolve: () => ({ graph: async () => ({ data: [] }) }) }, 'cus_other', 'order_test'), /not found/);
  assert.equal(customerReturn({ id: 'return_test', status: 'open', metadata: { secret: 'private' } }).status, 'awaiting_review');
  assert(!JSON.stringify(customerReturn({ metadata: { secret: 'private' } })).includes('private'));
});
