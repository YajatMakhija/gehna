import { model } from '@medusajs/framework/utils';

export const Review = model.define('gehna_review', {
  id: model.id({ prefix: 'rev' }).primaryKey(),
  product_id: model.text(),
  customer_id: model.text(),
  reviewer_name: model.text(),
  rating: model.number(),
  body: model.text(),
}).indexes([{ on: ['product_id', 'customer_id'], unique: true, where: 'deleted_at IS NULL' }]);
