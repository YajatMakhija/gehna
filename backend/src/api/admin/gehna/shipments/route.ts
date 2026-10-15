import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { bookOrder, reconcileOrder, refreshTracking, requestPickup, syncPickup } from '../../../../lib/shipping-flow';
export async function POST(req: MedusaRequest<{ action: string; order_id: string; shiprocket_order_id?: number }>, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const { action, order_id, shiprocket_order_id } = req.body || {};
  if (typeof order_id !== 'string' || !/^order_[\w-]+$/.test(order_id)) { res.status(400).json({ message: 'A valid order ID is required.' }); return; }
  if (shiprocket_order_id !== undefined && (!Number.isSafeInteger(shiprocket_order_id) || shiprocket_order_id <= 0)) { res.status(400).json({ message: 'A valid Shiprocket order ID is required.' }); return; }
  try {
    const shipment = action === 'book' ? await bookOrder(req.scope, order_id) : action === 'track' ? await refreshTracking(req.scope, order_id) : action === 'pickup' ? await requestPickup(req.scope, order_id) : action === 'sync_pickup' ? await syncPickup(req.scope, order_id) : action === 'reconcile' ? await reconcileOrder(req.scope, order_id, shiprocket_order_id) : null;
    if (!shipment) throw new Error('Invalid shipment action.');
    res.json({ shipment });
  } catch (e: any) { res.status(400).json({ message: e.message }); }
}
