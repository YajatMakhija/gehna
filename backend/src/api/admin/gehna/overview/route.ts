import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { getOrders } from '../../../../lib/orders';
import { financials, monthInIndia, amount, paid, shippable, cashOnDelivery } from '../../../../lib/reporting';
import { courierConfig } from '../../../../lib/couriers';
import { emailConfigured } from '../../../../lib/order-email';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const month = String(req.query.month || monthInIndia(new Date()));
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) { res.status(400).json({ message: 'Choose a valid month.' }); return; }
  const offset = Number(req.query.offset || 0), take = 25;
  if (!Number.isSafeInteger(offset) || offset < 0) { res.status(400).json({ message: 'Invalid page.' }); return; }
  const search = String(req.query.q || '').trim().toLowerCase().slice(0, 100);
  const status = String(req.query.status || 'all');
  const [all, products, inventory, customers] = await Promise.all([getOrders(req.scope), req.scope.resolve(Modules.PRODUCT).listAndCountProducts({}, { take: 8, order: { updated_at: 'DESC' }, relations: ['images', 'categories'] }), req.scope.resolve(Modules.INVENTORY).listAndCountInventoryItems({}, { take: 1 }), req.scope.resolve(Modules.CUSTOMER).listAndCountCustomers({}, { take: 1 })]);
  const finance = financials(all, month);
  const shipmentState = (o: any) => o.metadata?.gehna_shipment?.status || (o.fulfillments?.length ? 'existing_fulfillment' : o.status === 'canceled' ? 'canceled' : shippable(o) ? 'pending' : 'awaiting_payment');
  let rows = all.filter(o => monthInIndia(o.created_at) === month);
  if (search) rows = rows.filter(o => [o.id, o.display_id, o.email, o.shipping_address?.first_name, o.shipping_address?.last_name, o.shipping_address?.phone, o.metadata?.gehna_shipment?.awb].some(v => String(v || '').toLowerCase().includes(search)));
  if (status === 'action') rows = rows.filter(o => ['blocked', 'retryable', 'needs_review', 'booking', 'fulfillment_error'].includes(shipmentState(o)) || o.metadata?.gehna_shipment?.pickup_status === 'needs_review');
  else if (status !== 'all') rows = rows.filter(o => shipmentState(o) === status);
  const customerMap = new Map<string, any>();
  for (const o of all) {
    const key = o.customer_id || o.email?.toLowerCase(); if (!key) continue;
    let c = customerMap.get(key);
    if (!c) { c = { id: o.customer_id || null, email: o.email, name: [o.shipping_address?.first_name, o.shipping_address?.last_name].filter(Boolean).join(' ') || o.email, phone: o.shipping_address?.phone, city: o.shipping_address?.city, orders: 0, captured: 0, refunded: 0, last_order: o.created_at }; customerMap.set(key, c); }
    if (o.status !== 'canceled') c.orders++;
    if (o.currency_code === 'inr') for (const p of o.payment_collections || []) { c.captured += amount(p.captured_amount); c.refunded += amount(p.refunded_amount); }
  }
  res.json({ products: products[1], product_rows: products[0].map((p: any) => ({ id: p.id, title: p.title, handle: p.handle, status: p.status, thumbnail: p.thumbnail || p.images?.[0]?.url || null, image_count: p.images?.length || 0, category: p.categories?.[0]?.name || null, updated_at: p.updated_at })), inventory: inventory[1], orders: all.length, customers: customers[1], recent_orders: all.slice(0, 5).map(o => ({ id: o.id, display_id: o.display_id, email: o.email, status: o.status })), email_ready: emailConfigured(), email_attention: all.filter(o => Object.values(o.metadata?.gehna_emails || {}).some((entry: any) => entry?.error)).length, storefront_url: process.env.STOREFRONT_URL || 'http://localhost:3000', finance, cod_due: amount(all.filter(cashOnDelivery).reduce((n, o) => n + Math.max(0, amount(o.total) - o.payment_collections.reduce((s: number, c: any) => s + amount(c.captured_amount), 0)), 0)), couriers: courierConfig(), needs_action: all.filter(o => ['blocked', 'retryable', 'needs_review', 'booking', 'fulfillment_error'].includes(shipmentState(o)) || o.metadata?.gehna_shipment?.pickup_status === 'needs_review').length, waiting_to_ship: all.filter(o => shippable(o) && !o.fulfillments?.length && !o.metadata?.gehna_shipment?.awb).length, excluded_currency_orders: all.filter(o => o.currency_code !== 'inr').length, customer_rows: [...customerMap.values()].filter(c => !search || [c.name, c.email, c.phone].some(v => String(v || '').toLowerCase().includes(search))).slice(0, 25).map(c => ({ ...c, captured: amount(c.captured), refunded: amount(c.refunded) })), total: rows.length, offset, take, order_rows: rows.slice(offset, offset + take).map(o => ({ id: o.id, display_id: o.display_id, status: o.status, created_at: o.created_at, email: o.email, customer_id: o.customer_id, currency_code: o.currency_code, total: amount(o.total), payment_status: o.payment_status, payment_state: cashOnDelivery(o) ? 'Cash on Delivery · due' : paid(o) ? 'Collected' : 'Awaiting payment', cod: cashOnDelivery(o), emails: o.metadata?.gehna_emails || {}, authorized: o.payment_collections.reduce((n: number, p: any) => n + amount(p.authorized_amount), 0), captured: o.payment_collections.reduce((n: number, p: any) => n + amount(p.captured_amount), 0), refunded: o.payment_collections.reduce((n: number, p: any) => n + amount(p.refunded_amount), 0), shipping_address: o.shipping_address, items: o.items.map((i: any) => ({ title: i.title, quantity: Number(i.quantity), sku: i.variant_sku })), payments: o.payment_collections.flatMap((c: any) => (c.payments || []).map((p: any) => ({ id: p.id, provider: p.provider_id, gateway_id: p.data?.payment_id || null, captures: (p.captures || []).map((v: any) => ({ amount: amount(v.amount), created_at: v.created_at })), refunds: (p.refunds || []).map((v: any) => ({ amount: amount(v.amount), created_at: v.created_at })) }))), shipment: { ...(o.metadata?.gehna_shipment || {}), status: shipmentState(o) } })) });
}
