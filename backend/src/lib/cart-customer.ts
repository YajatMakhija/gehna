import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';

export async function requireCustomerCart(scope: any, customerId: string, cartId: string) {
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'cart', fields: ['id'], filters: { id: cartId, customer_id: customerId } });
  if (!data.length) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'Your bag must be linked to your account before placing an order. Please sign in again.');
}
