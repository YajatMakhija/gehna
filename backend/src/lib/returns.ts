import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';

export function returnWindow(order: any, now = Date.now()) {
  // shortcut: one parcel per order; use parcel-specific windows before introducing split shipping.
  const delivered = (order.fulfillments || []).filter((f: any) => !f.canceled_at && f.delivered_at).map((f: any) => new Date(f.delivered_at).getTime()).filter(Number.isFinite);
  const started = delivered.length ? Math.min(...delivered) : null;
  const deadline = started === null ? null : started + 48 * 60 * 60 * 1000;
  return { expires_at: deadline === null ? null : new Date(deadline).toISOString(), open: order.status !== 'canceled' && started !== null && now >= started && now <= deadline!, expired: deadline !== null && now > deadline };
}
export function returnableQuantity(item: any) {
  const detail = item.detail || {};
  return Math.max(0, Number(detail.delivered_quantity || 0) - Number(detail.return_requested_quantity || 0) - Number(detail.return_received_quantity || 0) - Number(detail.return_dismissed_quantity || 0));
}
export function validateReturn(order: any, customerId: string, input: any, existing: any[], now = Date.now()) {
  if (!order || order.customer_id !== customerId) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Order not found.');
  if (order.status === 'canceled') throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Canceled orders cannot be returned.');
  if (!returnWindow(order, now).open) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Returns must be requested within 2 days (48 hours) of delivery.');
  if (typeof input.reason !== 'string' || input.reason.trim().length < 5 || input.reason.length > 1000) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Describe the reason in 5–1000 characters.');
  if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50 || input.items.some((i: any) => !i || typeof i.id !== 'string') || new Set(input.items.map((i: any) => i.id)).size !== input.items.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Choose each item once with a valid quantity.');
  if (existing.some(r => !r.canceled_at && !['canceled', 'received'].includes(r.status))) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'This order already has a return in progress.');
  for (const item of input.items) {
    const ordered = order.items.find((i: any) => i.id === item.id);
    if (!ordered || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > returnableQuantity(ordered)) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Only delivered quantities that have not already been returned can be requested.');
  }
  return { reason: input.reason.trim(), items: input.items.map((i: any) => ({ id: i.id, quantity: i.quantity })) };
}
export async function customerOrder(scope: any, customerId: string, orderId: unknown) {
  if (typeof orderId !== 'string' || !orderId || orderId.length > 128) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Choose an order.');
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'order', fields: ['id', 'version', 'customer_id', 'status', 'fulfillments.delivered_at', 'fulfillments.canceled_at', 'items.id', 'items.title', 'items.detail.delivered_quantity', 'items.detail.return_requested_quantity', 'items.detail.return_received_quantity', 'items.detail.return_dismissed_quantity'], filters: { id: orderId, customer_id: customerId } });
  if (!data[0]) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Order not found.');
  return data[0];
}
export async function orderReturns(scope: any, orderId: string) {
  return scope.resolve(Modules.ORDER).listReturns({ order_id: orderId }, { select: ['id', 'status', 'created_at', 'requested_at', 'canceled_at', 'metadata'], order: { created_at: 'DESC' } });
}
export function customerReturn(r: any) {
  return { id: r.id, status: r.canceled_at ? 'canceled' : r.status === 'received' ? 'received' : !r.requested_at ? 'awaiting_review' : r.status, created_at: r.created_at, reason: r.metadata?.gehna_reason || '', items: r.metadata?.gehna_items || [] };
}
