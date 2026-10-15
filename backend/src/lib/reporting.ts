export type Courier = string;
export type Shipment = { status: string; courier?: Courier; awb?: string; fulfillment_id?: string; error?: string; attempts?: number; updated_at?: string; tracking?: string; label_url?: string; phase?: string; shiprocket_order_id?: number; shiprocket_shipment_id?: number; courier_id?: number; courier_name?: string; estimated_charge?: number; pickup_status?: string; pickup_date?: string | null; pickup_token?: string | null; pickup_error?: string; manifest_url?: string; tracking_url?: string; estimated_delivery?: string | null };
export const monthInIndia = (date: string | Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date(date));
export function amount(value: any): number {
  const n = Number(value?.value ?? value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error('Invalid monetary amount.');
  return Math.round(n * 100) / 100;
}
export function paid(order: any): boolean {
  const captured = (order.payment_collections || []).reduce((s: number, p: any) => s + amount(p.captured_amount) - amount(p.refunded_amount), 0);
  return order.status !== 'canceled' && amount(order.total) > 0 && Math.round(captured * 100) >= Math.round(amount(order.total) * 100);
}
export function cashOnDelivery(order: any): boolean {
  if (order.currency_code !== 'inr' || order.status === 'canceled') return false;
  return (order.payment_collections || []).some((c: any) =>
    amount(c.authorized_amount) >= amount(order.total) &&
    amount(c.captured_amount) < amount(order.total) &&
    amount(c.refunded_amount) === 0 &&
    (c.payments || []).some((p: any) => p.provider_id === 'pp_system_default')
  );
}
export function shippable(order: any): boolean { return paid(order) || cashOnDelivery(order); }
export function csv(rows: unknown[][]): string {
  return '\ufeff' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
}
export function financials(orders: any[], month: string) {
  const monthly = new Map<string, { month: string; captured: number; refunded: number; net: number; orders: number; sales: number }>();
  const current = new Date();
  for (let i = 11; i >= 0; i--) {
    const [year, m] = monthInIndia(current).split('-').map(Number);
    const key = new Date(Date.UTC(year, m - 1 - i, 15)).toISOString().slice(0, 7);
    monthly.set(key, { month: key, captured: 0, refunded: 0, net: 0, orders: 0, sales: 0 });
  }
  if (!monthly.has(month)) monthly.set(month, { month, captured: 0, refunded: 0, net: 0, orders: 0, sales: 0 });
  let lifetimeCaptured = 0, lifetimeRefunded = 0, awaitingCapture = 0;
  for (const order of orders.filter(o => o.currency_code === 'inr')) {
    const bucket = monthly.get(monthInIndia(order.created_at));
    if (bucket && order.status !== 'canceled') { bucket.orders++; bucket.sales += amount(order.total); }
    for (const collection of order.payment_collections || []) {
      if (order.status !== 'canceled') awaitingCapture += Math.max(0, amount(collection.authorized_amount) - amount(collection.captured_amount));
      for (const payment of collection.payments || []) {
        for (const capture of payment.captures || []) {
          const n = amount(capture.amount); lifetimeCaptured += n;
          const b = monthly.get(monthInIndia(capture.created_at)); if (b) b.captured += n;
        }
        for (const refund of payment.refunds || []) {
          const n = amount(refund.amount); lifetimeRefunded += n;
          const b = monthly.get(monthInIndia(refund.created_at)); if (b) b.refunded += n;
        }
      }
    }
  }
  const months = [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)).map(b => ({ ...b, captured: amount(b.captured), refunded: amount(b.refunded), net: Math.round((b.captured - b.refunded) * 100) / 100, sales: amount(b.sales) }));
  return { month, selected: months.find(b => b.month === month), months, lifetime_captured: amount(lifetimeCaptured), lifetime_refunded: amount(lifetimeRefunded), lifetime_net: Math.round((lifetimeCaptured - lifetimeRefunded) * 100) / 100, awaiting_capture: amount(awaitingCapture) };
}
