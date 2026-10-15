import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
export const ORDER_FIELDS = ['id', 'display_id', 'status', 'created_at', 'email', 'customer_id', 'currency_code', 'total', 'shipping_total', 'metadata', 'payment_status', 'fulfillment_status', 'shipping_address.*', 'items.*', 'items.variant.weight', 'items.variant.product.metadata', 'shipping_methods.shipping_option_id', 'fulfillments.id', 'fulfillments.canceled_at', 'fulfillments.metadata', 'payment_collections.*', 'payment_collections.payments.id', 'payment_collections.payments.provider_id', 'payment_collections.payments.data', 'payment_collections.payments.captures.*', 'payment_collections.payments.refunds.*'];
export async function getOrder(container: any, id: string) {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'order', fields: ORDER_FIELDS, filters: { id } });
  if (!data[0]) throw new Error('Order not found.');
  return data[0];
}
export async function getOrders(container: any) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const orders: any[] = [];
  // ponytail: paginate a single-store report in memory; move aggregation to SQL when report latency becomes material.
  for (let skip = 0; ; skip += 200) {
    const { data } = await query.graph({ entity: 'order', fields: ORDER_FIELDS, pagination: { take: 200, skip, order: { created_at: 'DESC', id: 'DESC' } } });
    orders.push(...data); if (data.length < 200) return orders;
  }
}
