import type { MedusaContainer } from '@medusajs/framework/types';
import { getOrders } from '../lib/orders';
import { bookOrder } from '../lib/shipping-flow';
import { shippable } from '../lib/reporting';
export default async function retryShipments(container: MedusaContainer) {
  if (process.env.AUTO_SHIP !== 'true') return;
  const orders = await getOrders(container);
  const candidates = orders.filter(o => {
    const s = o.metadata?.gehna_shipment;
    return shippable(o) && !o.fulfillments?.length && (!s || (['pending', 'checking', 'retryable', 'order_created', 'fulfillment_error'].includes(s.status) && (s.attempts || 0) < 3));
  });
  for (const order of candidates.slice(0, 100)) {
    try { await bookOrder(container, order.id, true); }
    catch { container.resolve('logger').error('Shipping recovery failed for order ' + order.id + '. Review it in the dashboard.'); }
  }
}
export const config = { name: 'gehna-shipping-recovery', schedule: '*/5 * * * *' };
