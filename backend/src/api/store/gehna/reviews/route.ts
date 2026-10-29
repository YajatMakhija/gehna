import type { MedusaRequest, AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { publishedReviewProduct, publicReview, saveCustomerReview } from '../../../../lib/reviews';
import type ReviewsService from '../../../../modules/reviews/service';

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const productId = await publishedReviewProduct(req.scope, req.query.product_id);
  const offset = Number(req.query.offset || 0);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Invalid review page.');
  const service = req.scope.resolve<ReviewsService>('gehna_reviews');
  const [reviews, counts] = await Promise.all([
    service.listReviews({ product_id: productId }, { take: 10, skip: offset, order: { created_at: 'DESC', id: 'DESC' } }),
    Promise.all([1, 2, 3, 4, 5].map(async rating => (await service.listAndCountReviews({ product_id: productId, rating }, { take: 1, select: ['id'] }))[1]))
  ]);
  const count = counts.reduce((sum, value) => sum + value, 0);
  const average = count ? counts.reduce((sum, value, i) => sum + value * (i + 1), 0) / count : null;
  res.json({ reviews: reviews.map(publicReview), count, average, offset, limit: 10 });
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ review: await saveCustomerReview(req.scope, req.auth_context.actor_id, req.body) });
}
