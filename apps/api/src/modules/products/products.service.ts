/**
 * Products Service
 */

import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductsRepository, ProductFilter, PaginationOptions } from './products.repository';
import { RedisService } from '../../core/redis/redis.service';
import { ErrorCode, ProductStatus } from '@sellergo/types';
import { CreateProductDto, UpdateProductDto } from './dto';
import { generateSlug } from '@sellergo/database';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  async getProduct(tenantId: string, productId: string) {
    const product = await this.productsRepository.findById(tenantId, productId);
    if (!product) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Product not found' });
    return product;
  }

  async getProductBySlug(tenantId: string, storeId: string, slug: string) {
    const product = await this.productsRepository.findBySlug(tenantId, storeId, slug);
    if (!product) throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Product not found' });

    // Increment view count asynchronously
    this.productsRepository.incrementViewCount(tenantId, product.id).catch(() => {});

    return product;
  }

  async getProducts(tenantId: string, storeId: string, filter: ProductFilter, pagination: PaginationOptions) {
    return this.productsRepository.findMany(tenantId, storeId, filter, pagination);
  }

  async createProduct(tenantId: string, storeId: string, dto: CreateProductDto) {
    // Generate slug
    let slug = generateSlug(dto.name);
    let slugSuffix = 0;

    // Ensure unique slug
    while (true) {
      const existing = await this.productsRepository.findBySlug(tenantId, storeId, slug);
      if (!existing) break;
      slugSuffix++;
      slug = `${generateSlug(dto.name)}-${slugSuffix}`;
    }

    return this.productsRepository.create(tenantId, storeId, {
      name: dto.name,
      slug,
      description: dto.description,
      price: dto.price,
      compareAtPrice: dto.compareAtPrice,
      costPerItem: dto.costPerItem,
      sku: dto.sku,
      barcode: dto.barcode,
      trackQuantity: dto.trackQuantity ?? true,
      quantity: dto.quantity ?? 0,
      lowStockThreshold: dto.lowStockThreshold ?? 5,
      categoryId: dto.categoryId,
      tags: dto.tags ?? [],
      status: dto.status ?? ProductStatus.DRAFT,
      images: dto.images?.map((img, index) => ({
        url: img.url,
        alt: img.alt,
        position: img.position ?? index,
      })),
    });
  }

  async updateProduct(tenantId: string, productId: string, dto: UpdateProductDto) {
    const product = await this.getProduct(tenantId, productId);

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
      // Update slug if name changed
      let slug = generateSlug(dto.name);
      if (slug !== product.slug) {
        let slugSuffix = 0;
        while (true) {
          const existing = await this.productsRepository.findBySlug(tenantId, product.storeId, slug);
          if (!existing || existing.id === productId) break;
          slugSuffix++;
          slug = `${generateSlug(dto.name)}-${slugSuffix}`;
        }
        updateData.slug = slug;
      }
    }

    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.shortDescription !== undefined) updateData.shortDescription = dto.shortDescription;
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.compareAtPrice !== undefined) updateData.compareAtPrice = dto.compareAtPrice;
    if (dto.costPerItem !== undefined) updateData.costPerItem = dto.costPerItem;
    if (dto.sku !== undefined) updateData.sku = dto.sku;
    if (dto.barcode !== undefined) updateData.barcode = dto.barcode;
    if (dto.trackQuantity !== undefined) updateData.trackQuantity = dto.trackQuantity;
    if (dto.quantity !== undefined) updateData.quantity = dto.quantity;
    if (dto.lowStockThreshold !== undefined) updateData.lowStockThreshold = dto.lowStockThreshold;
    if (dto.categoryId !== undefined) updateData.categoryId = dto.categoryId;
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.promoMessage !== undefined) updateData.promoMessage = dto.promoMessage;
    if (dto.promoMessageEnabled !== undefined) updateData.promoMessageEnabled = dto.promoMessageEnabled;
    if (dto.showReviews !== undefined) updateData.showReviews = dto.showReviews;
    if (dto.weight !== undefined) updateData.weight = dto.weight;
    if (dto.weightUnit !== undefined) updateData.weightUnit = dto.weightUnit;
    if (dto.requiresShipping !== undefined) updateData.requiresShipping = dto.requiresShipping;
    if (dto.shippingPrice !== undefined) updateData.shippingPrice = dto.shippingPrice;
    if (dto.freeShipping !== undefined) updateData.freeShipping = dto.freeShipping;
    if (dto.seo) updateData.seo = dto.seo;

    await this.invalidateProductCache(productId);
    return this.productsRepository.update(tenantId, productId, updateData);
  }

  async deleteProduct(tenantId: string, productId: string) {
    await this.getProduct(tenantId, productId);
    await this.invalidateProductCache(productId);
    return this.productsRepository.delete(tenantId, productId);
  }

  async bulkUpdateStatus(tenantId: string, productIds: string[], status: ProductStatus) {
    await Promise.all(productIds.map(id => this.invalidateProductCache(id)));
    return this.productsRepository.bulkUpdateStatus(tenantId, productIds, status);
  }

  async bulkDelete(tenantId: string, productIds: string[]) {
    await Promise.all(productIds.map(id => this.invalidateProductCache(id)));
    return this.productsRepository.bulkDelete(tenantId, productIds);
  }

  async updateInventory(tenantId: string, productId: string, quantity: number) {
    await this.getProduct(tenantId, productId);
    await this.invalidateProductCache(productId);
    return this.productsRepository.updateInventory(tenantId, productId, quantity);
  }

  async getStatistics(tenantId: string, storeId: string) {
    return this.productsRepository.getStatistics(tenantId, storeId);
  }

  // Images
  async addImage(tenantId: string, productId: string, url: string, alt?: string) {
    const product = await this.getProduct(tenantId, productId);
    const position = product.images.length;
    await this.invalidateProductCache(productId);
    return this.productsRepository.addImage(tenantId, productId, { url, alt, position });
  }

  async updateImage(tenantId: string, imageId: string, data: { alt?: string; position?: number }) {
    return this.productsRepository.updateImage(tenantId, imageId, data);
  }

  async deleteImage(tenantId: string, productId: string, imageId: string) {
    await this.invalidateProductCache(productId);
    return this.productsRepository.deleteImage(tenantId, imageId);
  }

  async reorderImages(tenantId: string, productId: string, imageIds: string[]) {
    await this.invalidateProductCache(productId);
    return this.productsRepository.reorderImages(tenantId, productId, imageIds);
  }

  async setFeaturedImage(tenantId: string, productId: string, imageIndex: number) {
    await this.invalidateProductCache(productId);
    return this.productsRepository.update(tenantId, productId, { featuredImageIndex: imageIndex });
  }

  // Quantity Offers
  async updateQuantityOffers(tenantId: string, productId: string, offers: Array<{
    id?: string;
    quantity: number;
    price: number;
    discountPercent: number;
    label?: string;
    isDefault: boolean;
  }>) {
    await this.invalidateProductCache(productId);
    const quantityOffers = offers.map((offer, i) => ({
      id: offer.id || crypto.randomUUID(),
      quantity: offer.quantity,
      price: offer.price,
      discountPercent: offer.discountPercent,
      label: offer.label,
      isDefault: offer.isDefault,
    }));
    return this.productsRepository.update(tenantId, productId, { quantityOffers });
  }

  // Upsells
  async updateUpsells(tenantId: string, productId: string, upsells: Array<{
    id?: string;
    name: string;
    description?: string;
    price: number;
    imageUrl?: string;
    position: number;
    isActive: boolean;
  }>) {
    await this.invalidateProductCache(productId);
    const productUpsells = upsells.map((u, i) => ({
      id: u.id || crypto.randomUUID(),
      name: u.name,
      description: u.description,
      price: u.price,
      imageUrl: u.imageUrl,
      position: u.position ?? i,
      isActive: u.isActive,
    }));
    return this.productsRepository.update(tenantId, productId, { upsells: productUpsells });
  }

  private async invalidateProductCache(productId: string): Promise<void> {
    await this.redisService.del(`product:${productId}`);
  }
}
