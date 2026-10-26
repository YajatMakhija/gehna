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
  const items = (order.items || []).map((item: any) => `<tr><td style="padding:16px 0;border-bottom:1px solid #eee5de"><strong>${escapeHtml(item.title)}</strong><br><span style="color:#756960;font-size:13px">Quantity: ${escapeHtml(item.quantity)}</span></td><td align="right" style="padding:16px 0;border-bottom:1px solid #eee5de;white-space:nowrap">${typeof item.total === 'number' ? escapeHtml(money(item.total)) : '—'}</td></tr>`).join('');
  const payment = cashOnDelivery(order) ? `Pay ${escapeHtml(money(order.total))} on delivery.` : `Order total: ${escapeHtml(money(order.total))}.`;
  const shipment = order.metadata?.gehna_shipment || {};
  const awb = String(shipment.awb || '').trim();
  let trackingUrl = 'https://www.shiprocket.in/shipment-tracking/';
  try { const url = new URL(shipment.tracking_url); if (url.protocol === 'https:' && !url.username && !url.password) trackingUrl = url.href; } catch {}
  const trackingText = awb
    ? `Courier: ${shipment.courier_name || shipment.courier || 'Shiprocket'}. Shiprocket tracking ID (AWB): ${awb}.\nTrack your order: ${trackingUrl}`
    : 'Your Shiprocket tracking ID will be emailed as soon as your courier is booked.';
  const subject = kind === 'order' ? `Gehna order #${order.display_id} confirmed` : `Gehna order #${order.display_id} is booked for delivery`;
  const heading = kind === 'order' ? 'Your order is confirmed.' : 'Your jewellery is booked for delivery.';
  const introduction = kind === 'order'
    ? `Hi ${name}, thank you for choosing Gehna. We have received your order.${awb ? ' Your delivery tracking details are below.' : ' We will email your Shiprocket tracking ID as soon as your courier is booked.'}`
    : `Hi ${name}, your order has been booked with ${escapeHtml(shipment.courier_name || shipment.courier)}. A booking does not mean the parcel has been collected yet.`;
  const address = order.shipping_address || {};
  const addressLines = [[address.first_name, address.last_name].filter(Boolean).join(' '), address.address_1, address.address_2, [address.city, address.province, address.postal_code].filter(Boolean).join(', '), address.phone].filter(Boolean).map(escapeHtml).join('<br>');
  const tracking = awb ? `<div style="padding:16px;background:#faf5ec;border-radius:8px"><p style="margin:0 0 8px">Courier: <strong>${escapeHtml(shipment.courier_name || shipment.courier || 'Shiprocket')}</strong><br>Shiprocket tracking ID (AWB): <strong>${escapeHtml(awb)}</strong></p><a href="${escapeHtml(trackingUrl)}" style="color:#80582d;font-weight:600">Track your order</a></div>` : '';
  const text = `Gehna\n${heading}\nOrder #${order.display_id}\n${kind === 'order' ? 'Thank you. We received your order.' : 'Your courier is booked. Pickup is not yet confirmed.'}\n${trackingText}\n${(order.items || []).map((item: any) => `${item.title} × ${item.quantity}`).join('\n')}\n${payment}\nView your orders: https://gehnadesigns.in/account/\nQuestions? Reply to this email.`;
  return { subject, text, html: `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f7f3ef;font:15px/1.65 Arial,Helvetica,sans-serif;color:#292320">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(subject)}. ${payment}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #eee5de;border-radius:12px">
<tr><td align="center" style="padding:32px 24px 24px;border-bottom:1px solid #eee5de"><a href="https://gehnadesigns.in/"><img src="https://gehnadesigns.in/images/gehna-logo.png" width="150" alt="Gehna" style="display:block;width:150px;max-width:100%;height:auto;border:0"></a><p style="margin:12px 0 0;font-size:11px;letter-spacing:2px;color:#8a7251">JEWELLERY FOR EVERY VERSION OF YOU</p></td></tr>
<tr><td style="padding:32px 28px"><p style="margin:0 0 12px;color:#8a7251;font-size:12px;letter-spacing:1px">ORDER #${number}</p><h1 style="margin:0 0 20px;font-size:28px;line-height:1.25;font-weight:600">${heading}</h1><p>${introduction}</p>${tracking}
<h2 style="margin:28px 0 0;font-size:17px">Your jewellery</h2><table width="100%" cellspacing="0" cellpadding="0" aria-label="Order items">${items}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px"><tr><td style="padding:6px 0;color:#756960">Delivery</td><td align="right">${escapeHtml(money(order.shipping_total))}</td></tr><tr><td style="padding:10px 0;font-size:18px"><strong>Order total</strong></td><td align="right" style="font-size:18px"><strong>${escapeHtml(money(order.total))}</strong></td></tr></table>
<p style="padding:16px;background:#faf5ec;border-radius:8px">${payment}</p>${addressLines ? `<h2 style="margin-top:28px;font-size:17px">Delivering to</h2><p style="color:#756960">${addressLines}</p>` : ''}
<table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0"><tr><td bgcolor="#292320" style="border-radius:6px"><a href="https://gehnadesigns.in/account/" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-weight:600">View my orders</a></td></tr></table>
<p style="margin-bottom:0">Thank you for making Gehna part of your everyday.<br><strong>With love, Team Gehna</strong></p></td></tr>
<tr><td align="center" style="padding:24px;background:#faf7f3;border-top:1px solid #eee5de;font-size:12px;color:#756960">Questions about your order? Reply to this email.<br><a href="mailto:rajesh@gehnadesigns.in" style="color:#756960">rajesh@gehnadesigns.in</a> · <a href="https://gehnadesigns.in/" style="color:#756960">gehnadesigns.in</a></td></tr>
</table></td></tr></table></body></html>` };
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
    const { subject, html, text } = emailContent(order, kind);
    const attempts = Number(previous[kind]?.attempts || 0) + 1;
    let state: any = { attempts };
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `gehna-${kind}-${order.id}` },
        body: JSON.stringify({ from: process.env.ORDER_EMAIL_FROM, to: [order.email], subject, html, text })
      });
      if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
      state = { attempts, sent_at: new Date().toISOString() };
    } catch (error: any) { state.error = String(error.message || 'Email delivery request failed.').slice(0, 180); }
    await container.resolve(Modules.ORDER).updateOrders(orderId, { metadata: { ...(order.metadata || {}), gehna_emails: { ...previous, [kind]: state } } });
  });
}
