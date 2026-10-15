import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { sendOrderEmail } from '../lib/order-email';
export default async function handler({ event, container }: SubscriberArgs<{ id: string }>) {
  await sendOrderEmail(container, event.data.id, 'order');
}
export const config: SubscriberConfig = { event: 'order.placed', context: { subscriberId: 'gehna-order-email' } };
