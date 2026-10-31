import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { customerOrder, customerReturn, orderReturns, returnableQuantity, returnWindow, validateReturn } from '../../../../lib/returns';
import { customerReturnWorkflow } from '../../../../workflows/customer-return';

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const order = await customerOrder(req.scope, req.auth_context.actor_id, req.query.order_id);
  const returns = await orderReturns(req.scope, order.id);
  const window = returnWindow(order);
  res.json({ returns: returns.map(customerReturn), return_deadline: window.expires_at, return_window_expired: window.expired, eligible_items: !window.open ? [] : order.items.map((i: any) => ({ id: i.id, title: i.title, quantity: returnableQuantity(i) })).filter((i: any) => i.quantity > 0) });
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const body = (req.body || {}) as Record<string, any>;
  const owned = await customerOrder(req.scope, req.auth_context.actor_id, body.order_id);
  const result = await req.scope.resolve(Modules.LOCKING).execute('gehna-return:' + owned.id, async () => {
    const order = await customerOrder(req.scope, req.auth_context.actor_id, owned.id);
    const details = validateReturn(order, req.auth_context.actor_id, body, await orderReturns(req.scope, owned.id));
    const { result } = await customerReturnWorkflow(req.scope).run({ input: { order_id: order.id, customer_id: req.auth_context.actor_id, ...details } });
    const returns = await orderReturns(req.scope, owned.id);
    return customerReturn(returns.find((r: any) => r.id === result.return_id));
  });
  res.status(201).json({ return: result, message: 'Return request received. Our team will review it and arrange the next steps.' });
}
