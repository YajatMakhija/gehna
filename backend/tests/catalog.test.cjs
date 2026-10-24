const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mapProduct } = require('../../storefront/src/lib/api.ts');

test('catalog preserves explicit categories and infers whole jewellery names', () => {
  assert.equal(mapProduct({ title: 'Hoops', categories: [{ name: 'Curated' }] }).category, 'Curated');
  assert.equal(mapProduct({ title: 'Hoops', type: { value: 'Special' } }).category, 'Special');
  assert.equal(mapProduct({ title: 'Gold ring', description: 'Pair with earrings.' }).category, 'Rings');
  for (const [title, category] of [['Everyday earrings', 'Earrings'], ['Studded necklace', 'Necklaces'], ['Stone-studded ring', 'Rings'], ['Gold rings', 'Rings'], ['Bangles', 'Bracelets'], ['Gift box', 'Jewellery']]) {
    assert.equal(mapProduct({ title }).category, category, title);
  }
});

test('catalog keeps cover first, ordered unique gallery images and a safe empty fallback', () => {
  const product = mapProduct({ thumbnail: '/cover.png', images: [{ url: '/second.png' }, { url: '/cover.png' }, { url: '/third.png' }] });
  assert.equal(product.image, '/cover.png');
  assert.deepEqual(product.images, ['/cover.png', '/second.png', '/third.png']);
  assert.deepEqual(mapProduct({ images: [{ url: '/only.png' }] }).images, ['/only.png']);
  assert.deepEqual(mapProduct({}).images, ['/images/jhumkas.png']);
});
