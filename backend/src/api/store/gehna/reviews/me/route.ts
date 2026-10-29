import type { AuthenticatedMedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { publishedReviewProduct, publicReview, hasDeliveredProduct } from '../../../../../lib/reviews';
import type ReviewsService from '../../../../../modules/reviews/service';

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const productId = await publishedReviewProduct(req.scope, req.query.product_id);
  const customerId = req.auth_context.actor_id;
  const [reviews, eligible] = await Promise.all([
    req.scope.resolve<ReviewsService>('gehna_reviews').listReviews({ product_id: productId, customer_id: customerId }, { take: 1 }),
    hasDeliveredProduct(req.scope, customerId, productId)
  ]);
  res.json({ review: reviews[0] ? publicReview(reviews[0]) : null, eligible });
}
