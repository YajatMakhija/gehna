import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { cancelConfirmedOrder, cancellationPreview, draftProduct, planRequest, publishDraft } from '../../../../lib/assistant';
const active = new Set<string>();
// shortcut: limits apply per server process; use Redis before adding backend replicas.
const usage = new Map<string, number[]>();
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ready: Boolean(process.env.OPENAI_API_KEY) });
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const actor = req.auth_context.actor_id;
  const body = (req.body || {}) as Record<string, any>;
  if (active.has(actor)) return res.status(409).json({ message: 'Your previous request is still processing. Please wait.' });
  active.add(actor);
  try {
    if (body.action === 'publish') return res.json({ product: await publishDraft(req.scope, actor, body.product_id), message: 'Your product is published and available in the store.' });
    if (body.action === 'cancel') {
      if (body.confirm !== true) return res.status(400).json({ message: 'Confirm the order cancellation first.' });
      return res.json({ order: await cancelConfirmedOrder(req.scope, body.order_id), message: 'Order canceled. The sales record is preserved.' });
    }
    if (body.action !== 'request') return res.status(400).json({ message: 'Unknown assistant action.' });
    const recent = (usage.get(actor) || []).filter(t => Date.now() - t < 3600000);
    if (recent.length >= 10) return res.status(429).json({ message: 'You have reached 10 AI requests this hour. Please try later.' });
    usage.set(actor, [...recent, Date.now()]);
    const plan = await planRequest(body.message, body.image);
    if (plan.intent === 'cancel_order') return res.json({ intent: plan.intent, order: await cancellationPreview(req.scope, plan.order_reference), message: 'Review this order before confirming cancellation.' });
    if (plan.intent === 'product') {
      const price = body.price ?? plan.price, stock = body.stock ?? plan.stock;
      if (!body.image || price === null || price === undefined || stock === null || stock === undefined) return res.json({ intent: 'help', message: 'Upload the raw product photo and supply the selling price in INR and stock quantity, then send your request again.' });
      const product = await draftProduct(req.scope, actor, plan, body.image, price, stock);
      return res.json({ intent: plan.intent, product, message: 'I created a product draft with two studio photos and a one-line description. Check the jewellery details, price and stock, then publish.' });
    }
    res.json({ intent: 'help', message: 'Ask me to add jewellery from a photo with its price and stock, or to cancel an unshipped COD order by its order number.' });
  } catch (error: any) {
    req.scope.resolve('logger').error('Gehna assistant request failed: ' + String(error.message || 'Unknown error').slice(0, 250));
    res.status(process.env.OPENAI_API_KEY ? 400 : 503).json({ message: error.message || 'The assistant could not complete this request. Please try again.' });
  } finally { active.delete(actor); }
}
