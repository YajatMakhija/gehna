const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateReview, reviewProductId, publicReview, hasDeliveredProduct, saveCustomerReview } = require('../src/lib/reviews.ts');
const { requireCustomerCart } = require('../src/lib/cart-customer.ts');

test('checkout requires the cart to belong to the authenticated customer', async () => {
  let found = true;
  const scope = { resolve: () => ({ graph: async ({ filters }) => {
    assert.deepEqual(filters, { id: 'cart_test', customer_id: 'cus_owner' });
    return { data: found ? [{ id: 'cart_test' }] : [] };
  } }) };
  await requireCustomerCart(scope, 'cus_owner', 'cart_test');
  found = false;
  await assert.rejects(requireCustomerCart(scope, 'cus_owner', 'cart_test'), /must be linked to your account/);
});

test('review input is bounded, stars are integers and public output excludes private data', () => {
  assert.deepEqual(validateReview({ rating: 5, body: '  Beautiful details and comfortable to wear.  ' }), { rating: 5, body: 'Beautiful details and comfortable to wear.' });
  for (const rating of [0, 6, 1.5, '5', null]) assert.throws(() => validateReview({ rating, body: 'A lovely pair of earrings.' }));
  for (const body of ['', 'short', 'x'.repeat(1501), {}, null]) assert.throws(() => validateReview({ rating: 4, body }));
  for (const id of [null, [], '', 'not-a-product', 'prod_' + 'x'.repeat(121)]) assert.throws(() => reviewProductId(id));
  assert.equal(reviewProductId('prod_test'), 'prod_test');
  const safe = publicReview({ id: 'rev_test', rating: 5, body: 'Lovely earrings.', reviewer_name: 'Asha', customer_id: 'cus_private', email: 'private@example.test', metadata: { secret: 'hidden' } });
  assert.deepEqual(Object.keys(safe).sort(), ['id','rating','body','reviewer_name','created_at','updated_at'].sort());
  assert(!JSON.stringify(safe).includes('private'));
});

test('review eligibility uses only the authenticated customer and delivered matching products', async () => {
  let orders = [];
  const scope = { resolve: () => ({ graph: async ({ entity, filters }) => { assert.equal(entity, 'order'); assert.deepEqual(filters, { customer_id: 'cus_owner' }); return { data: orders }; } }) };
  for (const order of [
    { status: 'pending', items: [{ product_id: 'prod_other', detail: { delivered_quantity: 1 } }] },
    { status: 'pending', items: [{ product_id: 'prod_test', detail: { shipped_quantity: 1 } }] },
    { status: 'canceled', items: [{ product_id: 'prod_test', detail: { delivered_quantity: 1 } }] },
  ]) { orders = [order]; assert.equal(await hasDeliveredProduct(scope, 'cus_owner', 'prod_test'), false); }
  orders = [{ status: 'completed', items: [{ product_id: 'prod_test', detail: { delivered_quantity: 1 } }] }];
  assert.equal(await hasDeliveredProduct(scope, 'cus_owner', 'prod_test'), true);
});

test('reviews overwrite only the authenticated customer record and reject non-purchasers', async () => {
  let delivered = true, existing = [], created = 0, updated = 0;
  const reviews = {
    listReviews: async filter => { assert.deepEqual(filter, { product_id: 'prod_test', customer_id: 'cus_owner' }); return existing; },
    createReviews: async value => { created++; assert.equal(value.customer_id, 'cus_owner'); return { id: 'rev_owner', ...value }; },
    updateReviews: async value => { updated++; assert.equal(value.id, 'rev_owner'); return value; },
  };
  const scope = { resolve: key => ({
    query: { graph: async ({ entity, filters }) => entity === 'product' ? { data: [{ id: 'prod_test' }] } : (assert.equal(filters.customer_id, 'cus_owner'), { data: delivered ? [{ status: 'completed', items: [{ product_id: 'prod_test', detail: { delivered_quantity: 1 } }] }] : [] }) },
    locking: { execute: async (key, action) => { assert.equal(key, 'gehna-review:cus_owner:prod_test'); return action(); } },
    customer: { retrieveCustomer: async id => { assert.equal(id, 'cus_owner'); return { first_name: 'Asha' }; } },
    gehna_reviews: reviews,
  }[key]) };
  const input = { product_id: 'prod_test', customer_id: 'cus_other', rating: 4, body: 'A beautifully made pair of earrings.' };
  assert.equal((await saveCustomerReview(scope, 'cus_owner', input)).reviewer_name, 'Asha');
  existing = [{ id: 'rev_owner' }];
  await saveCustomerReview(scope, 'cus_owner', { ...input, rating: 5 });
  assert.equal(created, 1); assert.equal(updated, 1);
  delivered = false;
  await assert.rejects(saveCustomerReview(scope, 'cus_owner', input), /after your order is delivered/);
  assert.equal(updated, 1);
});
