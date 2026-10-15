import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { getOrder } from '../../../../lib/orders';
import { labelsPdf } from '../../../../lib/labels';
import { csv, amount } from '../../../../lib/reporting';
function ids(value: unknown) {
  if (!Array.isArray(value) || !value.length || value.length > 100 || value.some(id => typeof id !== 'string' || !/^order_[\w-]+$/.test(id))) throw new Error('Select between 1 and 100 valid orders.');
  return [...new Set(value)] as string[];
}
async function download(req: MedusaRequest, res: MedusaResponse, kind: string, orderIds: string[], preview = false) {
  res.setHeader('Cache-Control', 'no-store');
  if (kind === 'labels' || kind === 'manifest') {
    const bytes = await labelsPdf(req.scope, orderIds, kind);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', (preview ? 'inline' : 'attachment') + '; filename="gehna-shipping-documents.pdf"'); res.send(bytes); return;
  }
  if (kind !== 'csv') throw new Error('Unknown download type.');
  const rows: unknown[][] = [['Order', 'Order ID', 'Created', 'Customer', 'Email', 'Phone', 'Address', 'City', 'State', 'PIN', 'Currency', 'Total', 'Payment', 'Captured', 'Refunded', 'Courier', 'AWB', 'Shipping status']];
  for (const id of orderIds) {
    const o = await getOrder(req.scope, id); const a = o.shipping_address || {}; const s = o.metadata?.gehna_shipment || {};
    rows.push([o.display_id, o.id, o.created_at, [a.first_name, a.last_name].filter(Boolean).join(' '), o.email, a.phone, [a.address_1, a.address_2].filter(Boolean).join(', '), a.city, a.province, a.postal_code, o.currency_code, amount(o.total), o.payment_status, o.payment_collections.reduce((n: number, c: any) => n + amount(c.captured_amount), 0), o.payment_collections.reduce((n: number, c: any) => n + amount(c.refunded_amount), 0), s.courier, s.awb, s.tracking || s.status]);
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8'); res.setHeader('Content-Disposition', 'attachment; filename="gehna-orders.csv"'); res.send(csv(rows));
}
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try { await download(req, res, 'labels', ids([req.query.order_id]), req.query.preview === '1'); } catch (e: any) { res.status(400).json({ message: e.message }); }
}
export async function POST(req: MedusaRequest<{ kind: string; order_ids: string[] }>, res: MedusaResponse) {
  try { await download(req, res, req.body.kind, ids(req.body.order_ids)); } catch (e: any) { res.status(400).json({ message: e.message }); }
}
