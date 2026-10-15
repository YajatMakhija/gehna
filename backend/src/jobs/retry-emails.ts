import type { MedusaContainer } from '@medusajs/framework/types';
import { getOrders } from '../lib/orders';
import { emailConfigured, sendOrderEmail } from '../lib/order-email';
export default async function retryEmails(container: MedusaContainer) {
  if (!emailConfigured()) return;
  const orders = await getOrders(container);
  for (const order of orders.filter(o => o.status !== 'canceled' &&
    (!o.metadata?.gehna_emails?.order?.sent_at && (o.metadata?.gehna_emails?.order?.attempts || 0) < 3 ||
    o.metadata?.gehna_shipment?.awb && !o.metadata?.gehna_emails?.shipment?.sent_at && (o.metadata?.gehna_emails?.shipment?.attempts || 0) < 3)).slice(0, 200)) {
    for (const kind of ['order', 'shipment'] as const) {
      if (kind === 'shipment' && !order.metadata?.gehna_shipment?.awb) continue;
      try { await sendOrderEmail(container, order.id, kind); }
      catch { container.resolve('logger').error(`Email recovery failed for ${order.id} (${kind}).`); }
    }
  }
}
export const config = { name: 'gehna-email-recovery', schedule: '*/5 * * * *' };
