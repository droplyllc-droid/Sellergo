/**
 * Products Repository
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { ProductStatus, StockStatus } from '@sellergo/types';

export interface ProductFilter {
  status?: ProductStatus;
  categoryId?: string;
  stockStatus?: StockStatus;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  tags?: string[];
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { orderBy: { position: 'asc' } },
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { reviews: true } },
      },
    });
  }

  async findBySlug(tenantId: string, storeId: string, slug: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.findFirst({
      where: { storeId, slug },
      include: {
        images: { orderBy: { position: 'asc' } },
        variants: { orderBy: { position: 'asc' } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async findMany(tenantId: string, storeId: string, filter: ProductFilter, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;

    const where: Record<string, unknown> = { storeId };
    if (filter.status) where.status = filter.status;
    if (filter.categoryId) where.categoryId = filter.categoryId;
    if (filter.minPrice || filter.maxPrice) {
      where.price = {};
      if (filter.minPrice) (where.price as Record<string, number>).gte = filter.minPrice;
      if (filter.maxPrice) (where.price as Record<string, number>).lte = filter.maxPrice;
    }
    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' } },
        { sku: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.tags?.length) where.tags = { hasSome: filter.tags };
    if (filter.stockStatus === 'out_of_stock') where.quantity = 0;
    else if (filter.stockStatus === 'low_stock') where.quantity = { gt: 0, lte: this.db.prisma.$queryRawUnsafe('low_stock_threshold') };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          images: { take: 1, orderBy: { position: 'asc' } },
          category: { select: { id: true, name: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async create(tenantId: string, storeId: string, data: {
    name: string;
    slug: string;
    description?: string;
    price: number;
    compareAtPrice?: number;
    costPerItem?: number;
    sku?: string;
    barcode?: string;
    trackQuantity: boolean;
    quantity: number;
    lowStockThreshold: number;
    categoryId?: string;
    tags: string[];
    status: ProductStatus;
    images?: Array<{ url: string; alt?: string; position: number }>;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.create({
      data: {
        tenantId,
        storeId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        costPerItem: data.costPerItem,
        sku: data.sku,
        barcode: data.barcode,
        trackQuantity: data.trackQuantity,
        quantity: data.quantity,
        lowStockThreshold: data.lowStockThreshold,
        categoryId: data.categoryId,
        tags: data.tags,
        status: data.status,
        featuredImageIndex: 0,
        hasVariants: false,
        variantOptions: [],
        quantityOffers: [],
        upsells: [],
        promoMessageEnabled: false,
        averageRating: 0,
        reviewCount: 0,
        showReviews: true,
        weightUnit: 'kg',
        requiresShipping: true,
        freeShipping: false,
        seo: { title: data.name, description: data.description?.slice(0, 160) || '' },
        totalSold: 0,
        totalRevenue: 0,
        viewCount: 0,
        images: data.images ? { create: data.images.map((img, i) => ({ tenantId, ...img, position: img.position ?? i })) } : undefined,
      },
      include: { images: true },
    });
  }

  async update(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.update({ where: { id }, data });
  }

  async delete(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.delete({ where: { id } });
  }

  async bulkUpdateStatus(tenantId: string, ids: string[], status: ProductStatus) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.updateMany({ where: { id: { in: ids } }, data: { status } });
  }

  async bulkDelete(tenantId: string, ids: string[]) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.deleteMany({ where: { id: { in: ids } } });
  }

  async updateInventory(tenantId: string, productId: string, quantity: number) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.update({ where: { id: productId }, data: { quantity } });
  }

  async incrementViewCount(tenantId: string, productId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.product.update({ where: { id: productId }, data: { viewCount: { increment: 1 } } });
  }

  async getStatistics(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    const [total, active, draft, archived] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.product.count({ where: { storeId, status: 'active' } }),
      prisma.product.count({ where: { storeId, status: 'draft' } }),
      prisma.product.count({ where: { storeId, status: 'archived' } }),
    ]);
    return { total, active, draft, archived };
  }

  // Images
  async addImage(tenantId: string, productId: string, data: { url: string; alt?: string; position: number }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productImage.create({ data: { tenantId, productId, ...data } });
  }

  async updateImage(tenantId: string, imageId: string, data: { alt?: string; position?: number }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productImage.update({ where: { id: imageId }, data });
  }

  async deleteImage(tenantId: string, imageId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productImage.delete({ where: { id: imageId } });
  }

  async reorderImages(tenantId: string, productId: string, imageIds: string[]) {
    const prisma = await this.db.withTenant(tenantId);
    const updates = imageIds.map((id, position) => prisma.productImage.update({ where: { id }, data: { position } }));
    return prisma.$transaction(updates);
  }

  // Variants
  async getVariants(tenantId: string, productId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productVariant.findMany({ where: { productId }, orderBy: { position: 'asc' } });
  }

  async createVariant(tenantId: string, storeId: string, productId: string, data: {
    sku?: string;
    price: number;
    compareAtPrice?: number;
    quantity: number;
    trackQuantity: boolean;
    options: Record<string, string>;
    position: number;
    isDefault: boolean;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productVariant.create({ data: { tenantId, storeId, productId, ...data } });
  }

  async updateVariant(tenantId: string, variantId: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productVariant.update({ where: { id: variantId }, data });
  }

  async deleteVariant(tenantId: string, variantId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productVariant.delete({ where: { id: variantId } });
  }

  // Categories
  async getCategories(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.category.findMany({
      where: { storeId },
      include: { _count: { select: { products: true } } },
      orderBy: { position: 'asc' },
    });
  }

  async getCategoryById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
  }

  async createCategory(tenantId: string, storeId: string, data: { name: string; slug: string; description?: string; image?: string; parentId?: string; position: number }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.category.create({
      data: { tenantId, storeId, ...data, isActive: true, seo: { title: data.name, description: data.description || '' } },
    });
  }

  async updateCategory(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    // Set products in this category to no category
    await prisma.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    return prisma.category.delete({ where: { id } });
  }

  // Reviews
  async getReviews(tenantId: string, productId: string, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;
    const [items, total] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId, isApproved: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productReview.count({ where: { productId, isApproved: true } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async createReview(tenantId: string, storeId: string, productId: string, data: {
    customerId?: string;
    orderId?: string;
    rating: number;
    title?: string;
    content?: string;
    customerName: string;
    customerEmail?: string;
    isVerifiedPurchase: boolean;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productReview.create({
      data: { tenantId, storeId, productId, ...data, isApproved: false },
    });
  }

  async approveReview(tenantId: string, reviewId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productReview.update({ where: { id: reviewId }, data: { isApproved: true, approvedAt: new Date() } });
  }

  async deleteReview(tenantId: string, reviewId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.productReview.delete({ where: { id: reviewId } });
  }

  async updateProductRating(tenantId: string, productId: string) {
    const prisma = await this.db.withTenant(tenantId);
    const result = await prisma.productReview.aggregate({
      where: { productId, isApproved: true },
      _avg: { rating: true },
      _count: true,
    });
    return prisma.product.update({
      where: { id: productId },
      data: { averageRating: result._avg.rating || 0, reviewCount: result._count },
    });
  }
}
