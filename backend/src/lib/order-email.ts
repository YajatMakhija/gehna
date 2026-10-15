import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { getOrder } from './orders';
import { amount, cashOnDelivery } from './reporting';

export type EmailKind = 'order' | 'shipment';
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const money = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount(value));
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_FROM);

export function emailContent(order: any, kind: EmailKind) {
  const name = escapeHtml(order.shipping_address?.first_name || 'there');
  const number = escapeHtml(order.display_id);
  const items = (order.items || []).map((item: any) => `<li>${escapeHtml(item.title)} × ${escapeHtml(item.quantity)}</li>`).join('');
  const payment = cashOnDelivery(order) ? `Pay ${escapeHtml(money(order.total))} on delivery.` : `Order total: ${escapeHtml(money(order.total))}.`;
  const shipment = order.metadata?.gehna_shipment || {};
  const subject = kind === 'order' ? `Gehna order #${order.display_id} confirmed` : `Gehna order #${order.display_id} is booked for delivery`;
  const message = kind === 'order'
    ? `<p>Hi ${name}, we received your order #${number}.</p><ul>${items}</ul><p>${payment}</p><p>We will email you when your courier is booked.</p>`
    : `<p>Hi ${name}, your Gehna order #${number} has been booked with ${escapeHtml(shipment.courier_name || shipment.courier)}.</p><p>AWB: <strong>${escapeHtml(shipment.awb)}</strong></p><p>${payment}</p><p>A booking does not mean the parcel has been collected yet.</p>`;
  return { subject, html: `<!doctype html><html><body style="font:16px/1.6 Arial,sans-serif;color:#27241f;max-width:600px;margin:auto;padding:24px"><h1 style="font-size:24px">Gehna</h1>${message}<p>Thank you for shopping with us.</p></body></html>` };
}

export async function sendOrderEmail(container: any, orderId: string, kind: EmailKind) {
  if (!emailConfigured()) return;
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  await pg.transaction(async (trx: any) => {
    await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))', ['gehna-shipment:' + orderId]);
    const order = await getOrder(container, orderId);
    const previous = order.metadata?.gehna_emails || {};
    if (previous[kind]?.sent_at || Number(previous[kind]?.attempts || 0) >= 3) return;
    if (kind === 'shipment' && !order.metadata?.gehna_shipment?.awb) return;
    const { subject, html } = emailContent(order, kind);
    const attempts = Number(previous[kind]?.attempts || 0) + 1;
    let state: any = { attempts };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `gehna-${kind}-${order.id}` },
        body: JSON.stringify({ from: process.env.ORDER_EMAIL_FROM, to: [order.email], subject, html })
      });
      if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
      state = { attempts, sent_at: new Date().toISOString() };
    } catch (error: any) { state.error = String(error.message || 'Email delivery request failed.').slice(0, 180); }
    await container.resolve(Modules.ORDER).updateOrders(orderId, { metadata: { ...(order.metadata || {}), gehna_emails: { ...previous, [kind]: state } } });
  });
}
