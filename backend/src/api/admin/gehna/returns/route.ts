import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { customerReturn } from '../../../../lib/returns';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const returns = await req.scope.resolve(Modules.ORDER).listReturns({}, { select: ['id', 'order_id', 'status', 'created_at', 'requested_at', 'canceled_at', 'metadata'], take: 100, order: { created_at: 'DESC' } });
  res.json({ returns: returns.filter(r => r.metadata?.gehna_customer_request).map(r => ({ ...customerReturn(r), order_id: r.order_id })) });
}
