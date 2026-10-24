import { authenticate, defineMiddlewares, AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';

async function requirePaymentCollection(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'payment_collection', fields: ['id'], filters: { id: req.path.split('/')[3] } });
  if (!data.length) return res.status(404).json({ message: 'Payment collection not found.' });
  next();
}

export default defineMiddlewares({ routes: [
  { matcher: '/store/gehna/phone', middlewares: [authenticate('customer', ['bearer', 'session'])] },
  { matcher: '/admin/gehna/assistant', bodyParser: { sizeLimit: '12mb' }, middlewares: [authenticate('user', ['bearer', 'session'])] },
  { matcher: /^\/store\/payment-collections\/[^/]+\/payment-sessions$/, methods: ['POST'], middlewares: [authenticate('customer', ['bearer', 'session']), requirePaymentCollection] },
  { matcher: /^\/store\/carts\/[^/]+\/complete$/, methods: ['POST'], middlewares: [authenticate('customer', ['bearer', 'session'])] },
] });
