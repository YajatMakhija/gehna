import { Module } from '@medusajs/framework/utils';
import ReviewsService from './service';

export default Module('gehna_reviews', { service: ReviewsService });
