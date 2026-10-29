import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';

export function reviewProductId(value: unknown): string {
  if (typeof value !== 'string' || !/^prod_[\w-]{1,120}$/.test(value)) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Choose a valid product.');
  return value;
}
export function validateReview(input: any) {
  if (!input || !Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Choose a rating from 1 to 5 stars.');
  if (typeof input.body !== 'string' || input.body.trim().length < 10 || input.body.length > 1500) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Write your review in 10–1500 characters.');
  return { rating: input.rating, body: input.body.trim() };
}
export function publicReview(review: any) {
  return { id: review.id, reviewer_name: review.reviewer_name, rating: review.rating, body: review.body, created_at: review.created_at, updated_at: review.updated_at };
}
export async function publishedReviewProduct(scope: any, value: unknown) {
  const id = reviewProductId(value);
  const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({ entity: 'product', fields: ['id'], filters: { id, status: 'published' } });
  if (!data.length) throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Product not found.');
  return id;
}
export async function hasDeliveredProduct(scope: any, customerId: string, productId: string) {
  for (let skip = 0; ; skip += 100) {
    const { data } = await scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'order', fields: ['id', 'status', 'items.product_id', 'items.detail.delivered_quantity'],
      filters: { customer_id: customerId }, pagination: { take: 100, skip, order: { created_at: 'DESC', id: 'DESC' } }
    });
    if (data.some((order: any) => order.status !== 'canceled' && order.items?.some((item: any) => item.product_id === productId && Number(item.detail?.delivered_quantity) > 0))) return true;
    if (data.length < 100) return false;
  }
}
export async function saveCustomerReview(scope: any, customerId: string, input: any) {
  const details = validateReview(input);
  const productId = await publishedReviewProduct(scope, input.product_id);
  return scope.resolve(Modules.LOCKING).execute('gehna-review:' + customerId + ':' + productId, async () => {
    if (!await hasDeliveredProduct(scope, customerId, productId)) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, 'You can review this piece after your order is delivered.');
    const reviews = scope.resolve('gehna_reviews');
    const existing = await reviews.listReviews({ product_id: productId, customer_id: customerId }, { take: 1 });
    const customer = await scope.resolve(Modules.CUSTOMER).retrieveCustomer(customerId);
    const data = { ...details, reviewer_name: String(customer.first_name || 'Gehna customer').trim().slice(0, 40) || 'Gehna customer' };
    const review = existing[0]
      ? await reviews.updateReviews({ id: existing[0].id, ...data })
      : await reviews.createReviews({ ...data, product_id: productId, customer_id: customerId });
    return publicReview(review);
  });
}
