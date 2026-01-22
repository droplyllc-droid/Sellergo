/**
 * Reviews Service
 */

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ProductsRepository } from './products.repository';
import { ErrorCode } from '@sellergo/types';
import { CreateReviewDto } from './dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async getReviews(tenantId: string, productId: string, page: number = 1, limit: number = 10) {
    return this.productsRepository.getReviews(tenantId, productId, { page, limit });
  }

  async createReview(tenantId: string, storeId: string, productId: string, dto: CreateReviewDto, customerId?: string, orderId?: string) {
    // Check if product exists
    const product = await this.productsRepository.findById(tenantId, productId);
    if (!product) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Product not found' });

    const review = await this.productsRepository.createReview(tenantId, storeId, productId, {
      customerId,
      orderId,
      rating: dto.rating,
      title: dto.title,
      content: dto.content,
      customerName: dto.customerName,
      customerEmail: dto.customerEmail,
      isVerifiedPurchase: !!orderId,
    });

    return review;
  }

  async approveReview(tenantId: string, reviewId: string, productId: string) {
    await this.productsRepository.approveReview(tenantId, reviewId);
    await this.productsRepository.updateProductRating(tenantId, productId);
    return { success: true };
  }

  async deleteReview(tenantId: string, reviewId: string, productId: string) {
    await this.productsRepository.deleteReview(tenantId, reviewId);
    await this.productsRepository.updateProductRating(tenantId, productId);
  }

  async getPendingReviews(tenantId: string, storeId: string, page: number = 1, limit: number = 20) {
    // This would need a separate repository method
    // For now, return empty
    return { items: [], total: 0, page, limit, totalPages: 0 };
  }
}
