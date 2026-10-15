import { authenticate, defineMiddlewares, AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse, MedusaNextFunction } from '@medusajs/framework/http';
import { Modules } from '@medusajs/framework/utils';
import { phoneVerified } from '../lib/phone';

async function requireVerifiedPhone(req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) {
  const customer = await req.scope.resolve(Modules.CUSTOMER).retrieveCustomer((req as AuthenticatedMedusaRequest).auth_context.actor_id);
  if (!phoneVerified(customer)) return res.status(403).json({ message: 'Verify your mobile number in your account before placing an order.' });
  next();
}

export default defineMiddlewares({ routes: [
  { matcher: '/store/gehna/phone', middlewares: [authenticate('customer', ['bearer', 'session'])] },
  { matcher: /^\/store\/payment-collections\/[^/]+\/payment-sessions$/, methods: ['POST'], middlewares: [authenticate('customer', ['bearer', 'session']), requireVerifiedPhone] },
  { matcher: /^\/store\/carts\/[^/]+\/complete$/, methods: ['POST'], middlewares: [authenticate('customer', ['bearer', 'session']), requireVerifiedPhone] },
] });
