const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceImage, productDetails, productCategory, planRequest, publishDraft, cancellationPreview } = require('../src/lib/assistant.ts');
test('assistant validates image bytes, price and inventory at the boundary', () => {
  const png = 'data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  assert.equal(sourceImage(png).mime, 'image/png');
  assert.throws(() => sourceImage('https://evil.example/image.png'));
  assert.throws(() => sourceImage('data:image/png;base64,PHNjcmlwdD4='));
  const text = { title: 'Gold-tone hoops', description: 'Small hoops for everyday styling.' };
  assert.equal(productDetails(text, 1499.50, 10).price, 1499.50);
  for (const price of [null, '1499', 0, -1, Infinity, 1.999]) assert.throws(() => productDetails(text, price, 1));
  for (const stock of [null, '10', -1, 1.5]) assert.throws(() => productDetails(text, 100, stock));
  assert.equal(productCategory('Gold-tone hoop earrings'), 'Earrings');
  assert.equal(productCategory('Fine pendant chain'), 'Necklaces');
  assert.equal(productCategory('Stone-studded ring'), 'Rings');
  assert.equal(productCategory('Studded necklace'), 'Necklaces');
  assert.equal(productCategory('Gold rings'), 'Rings');
  assert.equal(productCategory('Gold bracelets'), 'Bracelets');
  assert.equal(productCategory('New piece'), 'Jewellery');
  assert.equal(productCategory('Gold ring', 'Pairs well with hoop earrings.'), 'Rings');
  assert.equal(productCategory('Everyday piece', 'Delicate pendant chain.'), 'Necklaces');
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

test('photo drafting creates three distinct shots and exact INR inventory; failures clean up', async () => {
  const corePath = require.resolve('@medusajs/medusa/core-flows'), original = require(corePath);
  const originalFetch = global.fetch, originalKey = process.env.OPENAI_API_KEY;
  let productInput, inventoryInput, fail = false, renderFails = false, productCreates = 0, deleted = [], uploaded = [], prompts = [];
  let categoryMode = 'create', categoryCreates = 0, categoryReads = 0;
  require.cache[corePath].exports = { ...original,
    createProductsWorkflow: () => ({ run: async ({ input }) => { productCreates++; productInput = input.products[0]; return { result: [{ id: 'prod_test', variants: [{ id: 'variant_test' }] }] }; } }),
    createInventoryLevelsWorkflow: () => ({ run: async ({ input }) => { inventoryInput = input; if (fail) throw new Error('Inventory failure'); } }),
    createProductCategoriesWorkflow: () => ({ run: async () => { categoryCreates++; if (categoryMode !== 'create') throw new Error('Category create failed'); return { result: [{ id: 'pcat_earrings' }] }; } })
  };
  delete require.cache[require.resolve('../src/lib/assistant.ts')];
  const { draftProduct } = require('../src/lib/assistant.ts');
  const scope = { resolve: key => ({
    store: { listStores: async () => [{ default_sales_channel_id: 'sc_test' }] },
    sales_channel: { listSalesChannels: async () => [{ id: 'sc_test' }] },
    fulfillment: { listShippingProfiles: async () => [{ id: 'sp_test' }] },
    stock_location: { listStockLocations: async () => [{ id: 'sloc_test' }] },
    file: { createFiles: async f => { uploaded.push(f); return { id: 'file_' + uploaded.length, url: 'https://local.test/' + uploaded.length }; }, deleteFiles: async id => deleted.push(id) },
    product: { listProductCategories: async () => { categoryReads++; return categoryMode === 'existing' || (categoryMode === 'race' && categoryReads > 1) ? [{ id: 'pcat_existing' }] : []; }, deleteProducts: async ids => deleted.push(...ids) },
    query: { graph: async () => ({ data: [{ inventory_items: [{ inventory_item_id: 'iitem_test' }] }] }) }
  })[key] };
  const png = Buffer.from([137,80,78,71,13,10,26,10]).toString('base64');
  process.env.OPENAI_API_KEY = 'test-only';
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/images/edits');
    assert.equal(init.body.get('n'), '1'); assert(init.body.get('image') instanceof Blob);
    assert.equal(init.body.get('quality'), 'high'); assert.equal(init.body.get('output_format'), 'png');
    const prompt = init.body.get('prompt'); prompts.push(prompt);
    if (renderFails && prompt.includes('Editorial close-up 2')) return new Response('{}', { status: 500 });
    return new Response(JSON.stringify({ data: [{ b64_json: png }] }));
  };
  try {
    const draft = await draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small everyday hoops.' }, 'data:image/png;base64,' + png, 1499.50, 7);
    assert.equal(draft.status, 'draft'); assert.equal(draft.images.length, 3);
    assert.equal(new Set(prompts).size, 3); assert.match(prompts[0], /no props, packaging or human model/);
    for (const prompt of prompts.slice(1)) { assert.match(prompt, /adult Indian woman aged 25 or older/); assert.doesNotMatch(prompt, /South Asian/); }
    assert.match(prompts[1], /front-facing composition/); assert.match(prompts[2], /three-quarter camera angle/);
    for (const prompt of prompts) assert.match(prompt, /Preserve the exact design/);
    assert.equal(productInput.status, 'draft'); assert.deepEqual(productInput.category_ids, ['pcat_earrings']); assert.equal(productInput.variants[0].prices[0].amount, 1499.50);
    assert.equal(inventoryInput.inventory_levels[0].stocked_quantity, 7);
    assert.equal(uploaded[0].content, png);
    assert.equal(productInput.thumbnail, draft.images[0]); assert.equal(productInput.images.length, 3);
    fail = true;
    await assert.rejects(draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small hoops.' }, 'data:image/png;base64,' + png, 100, 3), /Inventory failure/);
    assert.deepEqual(deleted, ['prod_test', 'file_4', 'file_5', 'file_6']);
    renderFails = true; fail = false;
    const createdBeforeFailure = productCreates, uploadedBeforeFailure = uploaded.length;
    await assert.rejects(draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small hoops.' }, 'data:image/png;base64,' + png, 100, 3), /HTTP 500/);
    assert.equal(productCreates, createdBeforeFailure); assert.equal(uploaded.length, uploadedBeforeFailure);
    renderFails = false;
    categoryMode = 'existing'; categoryReads = 0;
    const categoriesCreatedBefore = categoryCreates;
    await draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small hoops.' }, 'data:image/png;base64,' + png, 100, 3);
    assert.equal(categoryCreates, categoriesCreatedBefore); assert.deepEqual(productInput.category_ids, ['pcat_existing']);
    categoryMode = 'race'; categoryReads = 0;
    await draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small hoops.' }, 'data:image/png;base64,' + png, 100, 3);
    assert.equal(categoryReads, 2); assert.deepEqual(productInput.category_ids, ['pcat_existing']);
    categoryMode = 'failure'; categoryReads = 0;
    const productsBeforeCategoryFailure = productCreates;
    await assert.rejects(draftProduct(scope, 'user_owner', { title: 'Hoops', description: 'Small hoops.' }, 'data:image/png;base64,' + png, 100, 3), /Category create failed/);
    assert.equal(productCreates, productsBeforeCategoryFailure);
  } finally {
    global.fetch = originalFetch; require.cache[corePath].exports = original;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    delete require.cache[require.resolve('../src/lib/assistant.ts')];
  }
});
