import { createWorkflow, transform, WorkflowResponse } from '@medusajs/framework/workflows-sdk';
import { beginReturnOrderWorkflow, requestItemReturnWorkflow } from '@medusajs/medusa/core-flows';

export const customerReturnWorkflow = createWorkflow('gehna-customer-return', (input: { order_id: string; customer_id: string; reason: string; items: { id: string; quantity: number }[] }) => {
  const change = beginReturnOrderWorkflow.runAsStep({ input: { order_id: input.order_id, created_by: input.customer_id, description: 'Customer return request', internal_note: input.reason, metadata: { gehna_customer_request: true, gehna_reason: input.reason, gehna_items: input.items } } });
  const requested = transform({ change, input }, ({ change, input }) => ({ return_id: change.return_id!, items: input.items }));
  requestItemReturnWorkflow.runAsStep({ input: requested });
  return new WorkflowResponse(change);
});
