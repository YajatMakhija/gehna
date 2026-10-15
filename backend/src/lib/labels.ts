import { labelLink } from './couriers';
import { getOrder } from './orders';
export function allowedLabelUrl(value: string) {
  const url = new URL(value);
  const native = url.hostname === 'kr-shipmultichannel.s3.ap-southeast-1.amazonaws.com' || url.hostname === 's3-ap-southeast-1.amazonaws.com' && url.pathname.startsWith('/kr-shipmultichannel/');
  const approved = (process.env.SHIPROCKET_PDF_HOSTS || '').split(',').map(v => v.trim()).filter(Boolean).includes(url.hostname);
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password || !(native || approved) || /^(localhost|127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) throw new Error('Unapproved Shiprocket PDF host. Configure the exact trusted storage hostname in SHIPROCKET_PDF_HOSTS.');
  return url;
}
export async function labelsPdf(container: any, ids: string[], kind = 'labels') {
  const shipmentIds: number[] = [];
  for (const id of ids) {
    const order = await getOrder(container, id); const s = order.metadata?.gehna_shipment;
    if (!s?.awb || !Number.isSafeInteger(s.shiprocket_shipment_id) || order.status === 'canceled') throw new Error('Order #' + order.display_id + ' has no active booked Shiprocket label.');
    if (kind === 'manifest' && s.pickup_status !== 'scheduled') throw new Error('Confirm pickup for every selected order before generating a manifest.');
    shipmentIds.push(s.shiprocket_shipment_id);
  }
  // Shiprocket returns a combined PDF; preserve its approved label layout and barcode unchanged.
  const url = allowedLabelUrl(await labelLink([...new Set(shipmentIds)], kind));
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) });
  if (!response.ok || !response.body) throw new Error('Shiprocket PDF download failed.');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 25000000) throw new Error('Bulk PDF exceeds 25 MB; select fewer orders.'); chunks.push(value); }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Shiprocket did not return a PDF.');
  return bytes;
}
