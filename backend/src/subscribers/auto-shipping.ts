import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { bookOrder } from '../lib/shipping-flow';
export default async function handler({ event, container }: SubscriberArgs<{ id: string }>) {
  if (process.env.AUTO_SHIP !== 'true') return;
  if (event.name === 'order.placed') { await bookOrder(container, event.data.id, true); return; }
  const payment = await container.resolve(Modules.PAYMENT).retrievePayment(event.data.id);
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'order_payment_collection', fields: ['order.id'], filters: { payment_collection_id: payment.payment_collection_id } });
  for (const link of data) if (link.order?.id) await bookOrder(container, link.order.id, true);
}
export const config: SubscriberConfig = { event: ['order.placed', 'payment.captured'], context: { subscriberId: 'gehna-auto-shipping' } };
