const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceImage, productDetails, planRequest, publishDraft, cancellationPreview } = require('../src/lib/assistant.ts');
test('assistant validates image bytes, price and inventory at the boundary', () => {
  const png = 'data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  assert.equal(sourceImage(png).mime, 'image/png');
  assert.throws(() => sourceImage('https://evil.example/image.png'));
  assert.throws(() => sourceImage('data:image/png;base64,PHNjcmlwdD4='));
  const text = { title: 'Gold-tone hoops', description: 'Small hoops for everyday styling.' };
  assert.equal(productDetails(text, 1499.50, 10).price, 1499.50);
  for (const price of [null, '1499', 0, -1, Infinity, 1.999]) assert.throws(() => productDetails(text, price, 1));
  for (const stock of [null, '10', -1, 1.5]) assert.throws(() => productDetails(text, 100, stock));
});
test('assistant parses structured proposals without executing model instructions', async () => {
  const before = { fetch: global.fetch, key: process.env.OPENAI_API_KEY };
  process.env.OPENAI_API_KEY = 'test-only';
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(init.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ intent: 'product', title: 'Hoops', description: 'Everyday hoops.', price: null, stock: null, order_reference: null, message: '' }) }] }] }), { status: 200 });
  };
  try { const plan = await planRequest('Add these hoops'); assert.equal(plan.price, null); assert.equal(plan.stock, null); }
  finally { global.fetch = before.fetch; if (before.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = before.key; }
});
test('assistant cannot publish another staff member draft or cancel a shipped/paid order', async () => {
  await assert.rejects(publishDraft({ resolve: () => ({ retrieveProduct: async () => ({ status: 'draft', metadata: { gehna_ai_generated: true, gehna_ai_actor: 'user_other' } }) }) }, 'user_owner', 'prod_test'), /draft/);
  let order = { id: 'order_test', display_id: 1, status: 'pending', items: [], payment_collections: [], fulfillments: [], metadata: { gehna_shipment: { awb: '12345' } } };
  const scope = { resolve: () => ({ graph: async ({ fields }) => ({ data: [fields.length === 1 ? { id: order.id } : order] }) }) };
  await assert.rejects(cancellationPreview(scope, '#1'), /payment or shipment/);
  order = { ...order, metadata: {}, payment_collections: [{ captured_amount: 100 }] };
  await assert.rejects(cancellationPreview(scope, '#1'), /payment or shipment/);
  await assert.rejects(cancellationPreview(scope, 'all orders'), /exact order/);
});

test('photo drafting creates a draft, two files and exact INR inventory; failures clean up', async () => {
  const corePath = require.resolve('@medusajs/medusa/core-flows'), original = require(corePath);
  const originalFetch = global.fetch, originalKey = process.env.OPENAI_API_KEY;
  let productInput, inventoryInput, fail = false, deleted = [], uploaded = [];
  require.cache[corePath].exports = { ...original,
    createProductsWorkflow: () => ({ run: async ({ input }) => { productInput = input.products[0]; return { result: [{ id: 'prod_test', variants: [{ id: 'variant_test' }] }] }; } }),
    createInventoryLevelsWorkflow: () => ({ run: async ({ input }) => { inventoryInput = input; if (fail) throw new Error('Inventory failure'); } })
  };
  delete require.cache[require.resolve('../src/lib/assistant.ts')];
  const { draftProduct } = require('../src/lib/assistant.ts');
  const scope = { resolve: key => ({
    store: { listStores: async () => [{ default_sales_channel_id: 'sc_test' }] },
    sales_channel: { listSalesChannels: async () => [{ id: 'sc_test' }] },
    fulfillment: { listShippingProfiles: async () => [{ id: 'sp_test' }] },
    stock_location: { listStockLocations: async () => [{ id: 'sloc_test' }] },
    file: { createFiles: async f => { uploaded.push(f); return { id: 'file_' + uploaded.length, url: 'https://local.test/' + uploaded.length }; }, deleteFiles: async id => deleted.push(id) },
    product: { deleteProducts: async ids => deleted.push(...ids) },
    query: { graph: async () => ({ data: [{ inventory_items: [{ inventory_item_id: 'iitem_test' }] }] }) }
  })[key] };
  const png = Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  process.env.OPENAI_API_KEY = 'test-only';
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(init.body.get('n'), '2'); assert(init.body.get('image') instanceof Blob);
    return new Response(JSON.stringify({ data: [{ b64_json: png }, { b64_json: png }] }));
  };
  try {
    const draft = await draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small everyday hoops.' }, 'data:image/png;base64,' + png, 1499.50, 7);
    assert.equal(draft.status, 'draft'); assert.equal(draft.images.length, 2);
    assert.equal(productInput.status, 'draft'); assert.equal(productInput.variants[0].prices[0].amount, 1499.50);
    assert.equal(inventoryInput.inventory_levels[0].stocked_quantity, 7);
    assert.equal(uploaded[0].content, png);
    fail = true;
    await assert.rejects(draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small hoops.' }, 'data:image/png;base64,' + png, 100, 3), /Inventory failure/);
    assert.deepEqual(deleted, ['prod_test', 'file_3', 'file_4']);
  } finally {
    global.fetch = originalFetch; require.cache[corePath].exports = original;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    delete require.cache[require.resolve('../src/lib/assistant.ts')];
  }
});
