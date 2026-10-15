import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { createOrderFulfillmentWorkflow } from '@medusajs/medusa/core-flows';
import { getOrder } from './orders';
import { shippable, type Shipment } from './reporting';
import { courierConfig, CourierError, selectCourier, createRemoteOrder, assignAwb, parcel, shipmentPayload, remoteOrder, findRemoteOrder, tracking, schedulePickup, remotePickup } from './couriers';
import { sendOrderEmail } from './order-email';
async function save(container: any, orderId: string, shipment: Shipment) {
  const orders = container.resolve(Modules.ORDER); const order = await orders.retrieveOrder(orderId);
  await orders.updateOrders(orderId, { metadata: { ...(order.metadata || {}), gehna_shipment: { ...shipment, provider: 'shiprocket', updated_at: new Date().toISOString() } } });
}
async function locked<T>(container: any, orderId: string, task: () => Promise<T>) {
  return container.resolve(ContainerRegistrationKeys.PG_CONNECTION).transaction(async (trx: any) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', ['gehna-shipment:' + orderId]); return task();
  });
}
async function attach(container: any, orderId: string, shipment: Shipment) {
  const order = await getOrder(container, orderId);
  if (!shippable(order)) throw new CourierError('Order canceled or no longer eligible for shipping. Review and cancel the AWB in Shiprocket before proceeding.');
  const existing = order.fulfillments?.find((f: any) => f.metadata?.gehna_awb === shipment.awb);
  if (existing) return { ...shipment, fulfillment_id: existing.id, status: 'booked', error: undefined };
  if (order.fulfillments?.length) throw new CourierError('Order already has a fulfillment. Review it before linking this AWB.');
  const { result } = await createOrderFulfillmentWorkflow(container).run({ input: { order_id: orderId, items: order.items.filter((i: any) => i.requires_shipping !== false).map((i: any) => ({ id: i.id, quantity: Number(i.quantity) })), labels: [{ tracking_number: shipment.awb!, tracking_url: shipment.tracking_url || 'https://www.shiprocket.in/shipment-tracking/', label_url: '/admin/gehna/export?order_id=' + orderId }], metadata: { gehna_awb: shipment.awb, gehna_courier: shipment.courier, shiprocket_order_id: shipment.shiprocket_order_id, shiprocket_shipment_id: shipment.shiprocket_shipment_id }, no_notification: false } });
  return { ...shipment, fulfillment_id: result.id, status: 'booked', error: undefined };
}
async function pickup(container: any, orderId: string, shipment: Shipment) {
  if (!shipment.awb || !shipment.shiprocket_shipment_id) throw new CourierError('A confirmed Shiprocket AWB is required before pickup.');
  if (['scheduled', 'requesting', 'needs_review'].includes(shipment.pickup_status || '')) return shipment;
  shipment = { ...shipment, pickup_status: 'requesting', pickup_error: undefined }; await save(container, orderId, shipment);
  try { shipment = { ...shipment, ...await schedulePickup(shipment.shiprocket_shipment_id!) }; }
  catch (e: any) { shipment = { ...shipment, pickup_status: 'needs_review', pickup_error: e.message }; }
  await save(container, orderId, shipment); return shipment;
}
export async function bookOrder(container: any, orderId: string, automatic = false) {
  const result = await locked(container, orderId, async () => {
    const order = await getOrder(container, orderId); let shipment: Shipment = order.metadata?.gehna_shipment || { status: 'pending', attempts: 0 }; const config = courierConfig();
    if (automatic && !config.auto_enabled) return shipment;
    if (['booking', 'needs_review'].includes(shipment.status)) return shipment;
    if (shipment.awb) {
      shipment = { ...shipment, attempts: (shipment.attempts || 0) + 1 };
      try { shipment = await attach(container, orderId, shipment); }
      catch (e: any) { shipment = { ...shipment, status: 'fulfillment_error', error: e.message }; }
      await save(container, orderId, shipment); return shipment;
    }
    if (!shippable(order)) return { ...shipment, status: 'awaiting_payment', error: 'A valid Cash on Delivery authorization or full captured payment is required before booking.' };
    if (order.fulfillments?.length) return { ...shipment, status: 'existing_fulfillment', error: 'This order already has a fulfillment.' };
    try {
      parcel(order); shipmentPayload(order);
      if (!config.ready) throw new CourierError('Configure the Shiprocket API user, registered pickup location and actual package dimensions first.');
      shipment = { ...shipment, status: 'checking', attempts: (shipment.attempts || 0) + 1, error: undefined }; await save(container, orderId, shipment);
      if (shipment.shiprocket_order_id) {
        const remote = await remoteOrder(shipment.shiprocket_order_id, orderId);
        if (remote.awb) {
          shipment = { ...shipment, ...remote, status: 'booked' }; await save(container, orderId, shipment);
          shipment = await attach(container, orderId, shipment); await save(container, orderId, shipment); return shipment;
        }
      }
      const chosen = await selectCourier(order); shipment = { ...shipment, ...chosen };
      if (!shipment.shiprocket_order_id) {
        shipment = { ...shipment, status: 'booking', phase: 'creating_order' }; await save(container, orderId, shipment);
        const remote = await createRemoteOrder(order); shipment = { ...shipment, ...remote, status: 'order_created' }; await save(container, orderId, shipment);
      }
      // Persist before each side effect. A crash or timeout holds this existing order for reconciliation.
      shipment = { ...shipment, status: 'booking', phase: 'assigning_awb' }; await save(container, orderId, shipment);
      const awb = await assignAwb(shipment.shiprocket_shipment_id!, chosen.courier_id);
      shipment = { ...shipment, ...awb, status: 'booked', phase: undefined, tracking: 'AWB assigned' }; await save(container, orderId, shipment);
      try { shipment = await attach(container, orderId, shipment); }
      catch (e: any) { shipment = { ...shipment, status: 'fulfillment_error', error: e.message }; }
      if (config.auto_pickup && shipment.status === 'booked') shipment = await pickup(container, orderId, shipment);
    } catch (e: any) {
      shipment = { ...shipment, status: shipment.awb ? 'fulfillment_error' : shipment.status === 'booking' || e.ambiguous ? 'needs_review' : e.retryable ? 'retryable' : 'blocked', error: e.message || 'Shiprocket booking failed.' };
    }
    await save(container, orderId, shipment); return shipment;
  });
  if (result.awb && result.status === 'booked') await sendOrderEmail(container, orderId, 'shipment');
  return result;
}
export async function reconcileOrder(container: any, orderId: string, remoteId?: number) {
  const result = await locked(container, orderId, async () => {
    const order = await getOrder(container, orderId); const previous = order.metadata?.gehna_shipment;
    if (!previous || !['booking', 'needs_review', 'fulfillment_error', 'booked', 'order_created'].includes(previous.status)) throw new CourierError('Only an existing booking or uncertain request can be reconciled.');
    if (previous.shiprocket_order_id && remoteId && previous.shiprocket_order_id !== remoteId) throw new CourierError('This order already has a different Shiprocket order ID.');
    const id = remoteId || previous.shiprocket_order_id;
    const remote = id ? await remoteOrder(id, orderId) : await findRemoteOrder(orderId);
    if (previous.awb && previous.awb !== remote.awb) throw new CourierError('The Shiprocket AWB has changed. Review the shipment in both systems before linking it.');
    let shipment: Shipment = { ...previous, ...remote, error: undefined };
    if (!remote.awb) {
      shipment.status = previous.phase === 'assigning_awb' ? 'needs_review' : 'order_created';
      shipment.error = previous.phase === 'assigning_awb' ? 'Shiprocket has not confirmed an AWB yet. Complete or verify assignment in its portal, then sync again.' : undefined;
    } else {
      const courier = remote.courier_name?.trim();
      if (!courier) throw new CourierError('Shiprocket returned an AWB without a courier name. Review it before proceeding.');
      shipment = { ...shipment, courier, status: 'booked', phase: undefined };
      await save(container, orderId, shipment);
      try { shipment = await attach(container, orderId, shipment); }
      catch (e: any) { shipment = { ...shipment, status: 'fulfillment_error', error: e.message }; }
    }
    await save(container, orderId, shipment); return shipment;
  });
  if (result.awb && result.status === 'booked') await sendOrderEmail(container, orderId, 'shipment');
  return result;
}
export async function refreshTracking(container: any, orderId: string) {
  return locked(container, orderId, async () => {
    const order = await getOrder(container, orderId); const s = order.metadata?.gehna_shipment;
    if (!s?.awb || !s.shiprocket_order_id || !s.shiprocket_shipment_id) throw new CourierError('This order has no booked Shiprocket AWB.');
    const result = await tracking(s.awb, s.shiprocket_order_id, s.shiprocket_shipment_id);
    const shipment = { ...s, tracking: result.status, tracking_url: result.tracking_url, estimated_delivery: result.estimated_delivery }; await save(container, orderId, shipment); return shipment;
  });
}
export async function requestPickup(container: any, orderId: string) {
  return locked(container, orderId, async () => {
    const order = await getOrder(container, orderId);
    if (!shippable(order)) throw new CourierError('Canceled or ineligible orders cannot request pickup.');
    return pickup(container, orderId, order.metadata?.gehna_shipment || {});
  });
}


export async function syncPickup(container: any, orderId: string) {
  return locked(container, orderId, async () => {
    const order = await getOrder(container, orderId); const s = order.metadata?.gehna_shipment;
    if (!s?.awb || !s.shiprocket_order_id || !s.shiprocket_shipment_id) throw new CourierError('A booked Shiprocket order is required.');
    const confirmation = await remotePickup(s.shiprocket_shipment_id, s.shiprocket_order_id, s.awb);
    const shipment = { ...s, ...confirmation }; await save(container, orderId, shipment); return shipment;
  });
}
