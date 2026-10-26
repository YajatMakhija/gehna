import { amount, cashOnDelivery } from './reporting';
export class CourierError extends Error {
  constructor(message: string, public ambiguous = false, public retryable = false) { super(message); }
}
export function courierConfig() {
  const keys = ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'SHIPROCKET_PICKUP_LOCATION', 'SHIPROCKET_PICKUP_PIN', 'SHIPMENT_LENGTH_CM', 'SHIPMENT_BREADTH_CM', 'SHIPMENT_HEIGHT_CM'];
  const missing = keys.filter(k => !process.env[k]?.trim());
  return { provider: 'shiprocket', ready: !missing.length, missing, auto_enabled: process.env.AUTO_SHIP === 'true', auto_pickup: process.env.SHIPROCKET_AUTO_PICKUP === 'true', selection: 'shiprocket_best_recommended', weight_configured: !!process.env.SHIPMENT_WEIGHT_GRAMS, pickup_name: process.env.SHIPROCKET_PICKUP_LOCATION || null };
}
export function parcel(order: any) {
  if (order.currency_code !== 'inr' || order.shipping_address?.country_code?.toLowerCase() !== 'in') throw new CourierError('Only INR orders shipping within India can be booked.');
  const a = order.shipping_address;
  const phone = String(a.phone || '').replace(/[\s()+-]/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(a.postal_code || '') || !a.address_1 || !a.city || !a.province || !a.first_name || !order.email) throw new CourierError('Complete the customer name, email, Indian phone, address, state, city and six-digit postcode before booking.');
  const physical = (order.items || []).filter((i: any) => i.requires_shipping !== false);
  if (!physical.length) throw new CourierError('This order has no physical items.');
  // ponytail: one parcel per order; split shipments require a parcel-level booking model.
  const measuredWeight = physical.every((i: any) => Number(i.variant?.weight) > 0) ? physical.reduce((n: number, i: any) => n + Number(i.variant.weight) * Number(i.quantity), Number(process.env.PACKAGING_WEIGHT_GRAMS || 0)) : 0;
  const weight = Number(process.env.SHIPMENT_WEIGHT_GRAMS || measuredWeight);
  const length = Number(process.env.SHIPMENT_LENGTH_CM), breadth = Number(process.env.SHIPMENT_BREADTH_CM), height = Number(process.env.SHIPMENT_HEIGHT_CM);
  if (!Number.isFinite(weight) || weight <= 0 || ![length, breadth, height].every(n => Number.isFinite(n) && n > .5)) throw new CourierError('Set the actual packed weight and package dimensions (each above 0.5 cm) before booking.');
  if (!/^\d{6}$/.test(process.env.SHIPROCKET_PICKUP_PIN || '')) throw new CourierError('Set the registered Shiprocket pickup postcode.');
  return { phone, pin: a.postal_code, weight: weight / 1000, length, breadth, height, physical };
}
export function shipmentPayload(order: any) {
  const p = parcel(order); const a = order.shipping_address;
  const items = p.physical.map((i: any) => {
    const units = Number(i.quantity);
    if (!Number.isSafeInteger(units) || units < 1) throw new CourierError('Invalid order quantity.');
    const total = amount(i.total ?? Number(i.unit_price) * units), price = Math.round(total / units * 10000) / 10000;
    const taxBase = total - amount(i.tax_total);
    const tax = taxBase > 0 ? Math.round(amount(i.tax_total) / taxBase * 10000) / 100 : 0;
    return { name: i.title, sku: i.variant_sku || i.id, units, selling_price: price, discount: 0, tax, ...(i.variant?.product?.metadata?.hsn || process.env.PRODUCT_HSN ? { hsn: String(i.variant?.product?.metadata?.hsn || process.env.PRODUCT_HSN) } : {}) };
  });
  const subtotal = amount(items.reduce((n, i) => n + i.selling_price * i.units, 0));
  const shipping = amount(order.shipping_total);
  if (Math.abs(Math.round((subtotal + shipping) * 100) - Math.round(amount(order.total) * 100)) > 1) throw new CourierError('Order totals require review before export to Shiprocket (for example gift cards, non-shipping items or an order adjustment).');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(order.created_at));
  const v = (key: string) => parts.find(p => p.type === key)?.value;
  return { order_id: order.id, order_date: `${v('year')}-${v('month')}-${v('day')} ${v('hour')}:${v('minute')}`, pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION, billing_customer_name: a.first_name, billing_last_name: a.last_name || '', billing_address: a.address_1, billing_address_2: a.address_2 || '', billing_city: a.city, billing_pincode: a.postal_code, billing_state: a.province, billing_country: 'India', billing_email: order.email, billing_phone: p.phone, shipping_is_billing: true, order_items: items, payment_method: cashOnDelivery(order) ? 'COD' : 'Prepaid', shipping_charges: shipping, giftwrap_charges: 0, transaction_charges: 0, total_discount: 0, sub_total: subtotal, length: p.length, breadth: p.breadth, height: p.height, weight: p.weight, ...(order.metadata?.ewaybill ? { ewaybill_no: String(order.metadata.ewaybill) } : {}) };
}
let cachedToken = '', expiresAt = 0;
async function json(path: string, token?: string, body?: any, sideEffect = false) {
  let response: Response;
  try { response = await fetch('https://apiv2.shiprocket.in/v1/external/' + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(20000) }); }
  catch { throw new CourierError(sideEffect ? 'Shiprocket response unknown. Sync the existing order from Shiprocket before proceeding; do not create a second shipment.' : 'Shiprocket is unavailable. Retry later.', sideEffect, !sideEffect); }
  if (response.status === 401) { cachedToken = ''; expiresAt = 0; }
  if (!response.ok) throw new CourierError(`Shiprocket returned HTTP ${response.status}. ${sideEffect ? 'Review and sync the existing order in Shiprocket.' : 'Check API account access or retry.'}`, sideEffect, !sideEffect && (response.status === 429 || response.status >= 500));
  try { return await response.json(); } catch { throw new CourierError('Shiprocket returned an unreadable response.', sideEffect, !sideEffect); }
}
export async function shiprocket(path: string, body?: any, sideEffect = false) {
  if (!cachedToken || Date.now() >= expiresAt) {
    const data = await json('auth/login', undefined, { email: process.env.SHIPROCKET_EMAIL, password: process.env.SHIPROCKET_PASSWORD });
    if (!data.token || typeof data.token !== 'string') throw new CourierError('Shiprocket API authentication failed.');
    cachedToken = data.token; expiresAt = Date.now() + 8 * 24 * 60 * 60 * 1000;
  }
  return json(path, cachedToken, body, sideEffect);
}
export function chooseCourier(companies: any[], recommendedId: unknown) {
  if (!Array.isArray(companies)) throw new CourierError('Unrecognized Shiprocket serviceability response.');
  const id = Number(recommendedId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new CourierError('Shiprocket did not return a Best Recommended courier for this parcel and postcode.');
  const chosen = companies.find(c => Number(c.courier_company_id) === id && !Number(c.blocked));
  if (!chosen?.courier_name) throw new CourierError('Shiprocket\'s Best Recommended courier is unavailable or blocked for this parcel.');
  return { courier: String(chosen.courier_name), courier_id: id, courier_name: String(chosen.courier_name), estimated_charge: Number.isFinite(Number(chosen.rate)) ? amount(chosen.rate) : undefined };
}
export async function selectCourier(order: any) {
  const p = parcel(order);
  const params = new URLSearchParams({ pickup_postcode: process.env.SHIPROCKET_PICKUP_PIN!, delivery_postcode: p.pin, cod: cashOnDelivery(order) ? '1' : '0', weight: String(p.weight), length: String(p.length), breadth: String(p.breadth), height: String(p.height), declared_value: String(amount(order.total)) });
  const data = await shiprocket('courier/serviceability/?' + params);
  const recommendation = data.data?.shiprocket_recommended_courier_id || data.data?.recommended_courier_company_id;
  return chooseCourier(data.data?.available_courier_companies, recommendation);
}
export async function createRemoteOrder(order: any) {
  const data = await shiprocket('orders/create/adhoc', shipmentPayload(order), true);
  if (![data.order_id, data.shipment_id].every(v => Number.isSafeInteger(Number(v)) && Number(v) > 0)) throw new CourierError('Shiprocket returned no confirmed order/shipment IDs. Sync from Shiprocket before retrying.', true);
  return { shiprocket_order_id: Number(data.order_id), shiprocket_shipment_id: Number(data.shipment_id) };
}
export async function assignAwb(shipmentId: number, courierId: number) {
  const data = await shiprocket('courier/assign/awb', { shipment_id: shipmentId, courier_id: courierId }, true);
  const result = data.response?.data;
  const rejection = result?.awb_assign_error || data.message;
  if (data.awb_assign_status !== 1 && typeof rejection === 'string' && rejection.trim()) throw new CourierError('Shiprocket AWB assignment failed: ' + rejection.replace(/\s+/g, ' ').trim().slice(0, 300), true);
  if (data.awb_assign_status !== 1 || !/^[a-zA-Z0-9-]{6,40}$/.test(result?.awb_code || '') || Number(result.shipment_id) !== shipmentId || Number(result.courier_company_id) !== courierId) throw new CourierError('No matching AWB confirmation was returned. Sync the shipment from Shiprocket.', true);
  return { awb: String(result.awb_code), courier_name: String(result.courier_name || '') };
}
export async function remoteOrder(id: number, reference: string) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new CourierError('Enter a valid Shiprocket order ID.');
  const { data } = await shiprocket('orders/show/' + id);
  if (Number(data?.id) !== id || data?.channel_order_id !== reference) throw new CourierError('The Shiprocket order reference does not match this Medusa order.');
  if (Array.isArray(data.shipments) && data.shipments.length !== 1) throw new CourierError('Multiple Shiprocket parcels require review before linking.');
  const s = Array.isArray(data.shipments) ? data.shipments[0] : data.shipments;
  if (!s || !Number.isSafeInteger(Number(s.id)) || Number(s.id) <= 0) throw new CourierError('Shiprocket order has no valid shipment.');
  if (/cancel/i.test(String(data.status || '')) || /cancel/i.test(String(s.status || ''))) throw new CourierError('This Shiprocket order or shipment is canceled.');
  return { shiprocket_order_id: id, shiprocket_shipment_id: Number(s.id), awb: s.awb ? String(s.awb) : undefined, courier_id: Number(s.courier_id) || undefined, courier_name: String(s.courier || ''), tracking: String(s.status || 'Created') };
}
export async function findRemoteOrder(reference: string) {
  const params = new URLSearchParams({ filter_by: 'channel_order_id', filter: reference, per_page: '50' });
  const data = await shiprocket('orders?' + params);
  const matches = (data.data || []).filter((o: any) => o.channel_order_id === reference);
  if (matches.length !== 1) throw new CourierError(matches.length ? 'Multiple Shiprocket orders match. Review duplicates in the Shiprocket portal.' : 'No matching Shiprocket order found. Check the portal; the uncertain request remains on hold.');
  return remoteOrder(Number(matches[0].id), reference);
}
export async function tracking(awb: string, remoteId: number, shipmentId: number) {
  const data = await shiprocket('courier/track/awb/' + encodeURIComponent(awb));
  const t = data.tracking_data; const s = t?.shipment_track?.find((s: any) => s.awb_code === awb && Number(s.order_id) === remoteId && Number(s.shipment_id) === shipmentId);
  if (!t?.track_status || !s) throw new CourierError('Tracking is not available yet or the shipment reference does not match.');
  return { status: String(s.current_status), tracking_url: typeof t.track_url === 'string' && t.track_url.startsWith('https://') ? t.track_url : undefined, estimated_delivery: s.edd || t.etd || null };
}
export async function schedulePickup(shipmentId: number) {
  const data = await shiprocket('courier/generate/pickup', { shipment_id: [shipmentId] }, true);
  if (data.pickup_status !== 1) throw new CourierError('Shiprocket did not confirm pickup. Review the pickup request in its portal.', true);
  return { pickup_status: 'scheduled', pickup_date: data.response?.pickup_scheduled_date || null, pickup_token: data.response?.pickup_token_number || null };
}
export async function labelLink(ids: number[], kind = 'labels') {
  const data = await shiprocket(kind === 'manifest' ? 'manifests/generate' : 'courier/generate/label', { shipment_id: ids });
  if (kind !== 'manifest' && (data.label_created !== 1 || !Array.isArray(data.not_created) || data.not_created.length)) throw new CourierError('Shiprocket could not generate every selected label. Download nothing until all selected labels are available.');
  const url = kind === 'manifest' ? data.manifest_url : data.label_url;
  if (typeof url !== 'string') throw new CourierError('Shiprocket has not returned the requested PDF. Confirm pickup before requesting a manifest.');
  return url;
}

export async function remotePickup(shipmentId: number, orderId: number, awb: string) {
  const { data } = await shiprocket('shipments/' + shipmentId);
  if (Number(data?.id) !== shipmentId || Number(data?.order_id) !== orderId || data?.awb !== awb) throw new CourierError('Pickup shipment reference mismatch.');
  if (!data.pickup_generated_date || !data.pickup_token_number) throw new CourierError('Shiprocket has not confirmed pickup yet. Review its portal before making another pickup request.');
  return { pickup_status: 'scheduled', pickup_token: String(data.pickup_token_number), pickup_error: undefined };
}
