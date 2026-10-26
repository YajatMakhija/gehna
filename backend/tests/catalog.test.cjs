const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapProduct, loadCatalog } = require('../../storefront/src/lib/api.ts');

test('catalog preserves explicit categories and infers whole jewellery names', () => {
  assert.equal(mapProduct({ title: 'Hoops', categories: [{ name: 'Curated' }] }).category, 'Curated');
  assert.equal(mapProduct({ title: 'Hoops', type: { value: 'Special' } }).category, 'Special');
  assert.equal(mapProduct({ title: 'Gold ring', description: 'Pair with earrings.' }).category, 'Rings');
  for (const [title, category] of [['Everyday earrings', 'Earrings'], ['Studded necklace', 'Necklaces'], ['Stone-studded ring', 'Rings'], ['Gold rings', 'Rings'], ['Bangles', 'Bracelets'], ['Gift box', 'Jewellery']]) {
    assert.equal(mapProduct({ title }).category, category, title);
  }
});

test('catalog refresh reads all pages with current price, stock and images and surfaces API errors', async () => {
  const original = global.fetch;
  const offsets = [];
  global.fetch = async (url, init) => {
    assert.equal(init.cache, 'no-store');
    const offset = Number(new URL(url).searchParams.get('offset')); offsets.push(offset);
    return new Response(JSON.stringify({ count: 101, products: Array.from({ length: offset === 0 ? 100 : 1 }, (_, i) => ({ id: 'product_' + (offset + i), title: 'Hoops', thumbnail: '/updated.png', variants: [{ id: 'variant_' + i, manage_inventory: true, inventory_quantity: 0, calculated_price: { calculated_amount: 1599 } }] })) }));
  };
  try {
    const products = await loadCatalog('reg_test');
    assert.equal(products.length, 101); assert.deepEqual(offsets, [0, 100]);
    assert.equal(products[100].id, 'product_100'); assert.equal(products[0].price, 1599); assert.equal(products[0].stock, 0); assert.equal(products[0].image, '/updated.png');
    global.fetch = async () => new Response(JSON.stringify({ message: 'Store unavailable' }), { status: 503 });
    await assert.rejects(loadCatalog('reg_test'), /Store unavailable/);
  } finally { global.fetch = original; }
});

test('catalog keeps cover first, ordered unique gallery images and a safe empty fallback', () => {
  const product = mapProduct({ thumbnail: '/cover.png', images: [{ url: '/second.png' }, { url: '/cover.png' }, { url: '/third.png' }] });
  assert.equal(product.image, '/cover.png');
  assert.deepEqual(product.images, ['/cover.png', '/second.png', '/third.png']);
  assert.deepEqual(mapProduct({ images: [{ url: '/only.png' }] }).images, ['/only.png']);
  assert.deepEqual(mapProduct({}).images, ['/images/jhumkas.png']);
});
