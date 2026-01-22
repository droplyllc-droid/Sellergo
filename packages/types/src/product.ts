/**
 * Product types
 */

import type {
  TenantScopedEntity,
  UUID,
  ImageAsset,
  SeoMeta,
  Money,
} from './common';

// Product status
export enum ProductStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

// Stock status
export enum StockStatus {
  IN_STOCK = 'in_stock',
  LOW_STOCK = 'low_stock',
  OUT_OF_STOCK = 'out_of_stock',
}

// Product entity
export interface Product extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly shortDescription?: string;
  readonly status: ProductStatus;

  // Pricing
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly costPerItem?: number;

  // Media
  readonly images: readonly ProductImage[];
  readonly featuredImageIndex: number;

  // Inventory
  readonly sku?: string;
  readonly barcode?: string;
  readonly trackQuantity: boolean;
  readonly quantity: number;
  readonly lowStockThreshold: number;

  // Organization
  readonly categoryId?: UUID;
  readonly tags: readonly string[];

  // Variants
  readonly hasVariants: boolean;
  readonly variants: readonly ProductVariant[];
  readonly variantOptions: readonly VariantOption[];

  // Offers
  readonly quantityOffers: readonly QuantityOffer[];
  readonly upsells: readonly ProductUpsell[];

  // Promo
  readonly promoMessage?: string;
  readonly promoMessageEnabled: boolean;

  // Reviews
  readonly averageRating: number;
  readonly reviewCount: number;
  readonly showReviews: boolean;

  // Shipping
  readonly weight?: number;
  readonly weightUnit: 'kg' | 'g' | 'lb' | 'oz';
  readonly requiresShipping: boolean;
  readonly shippingPrice?: number;
  readonly freeShipping: boolean;

  // SEO
  readonly seo: SeoMeta;

  // Stats
  readonly totalSold: number;
  readonly totalRevenue: number;
  readonly viewCount: number;
}

// Product image
export interface ProductImage {
  readonly id: UUID;
  readonly url: string;
  readonly alt?: string;
  readonly position: number;
  readonly width?: number;
  readonly height?: number;
}

// Variant option (e.g., Size, Color)
export interface VariantOption {
  readonly id: UUID;
  readonly name: string;
  readonly values: readonly string[];
  readonly position: number;
}

// Product variant
export interface ProductVariant extends TenantScopedEntity {
  readonly productId: UUID;
  readonly storeId: UUID;
  readonly sku?: string;
  readonly barcode?: string;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly costPerItem?: number;
  readonly quantity: number;
  readonly trackQuantity: boolean;
  readonly options: Record<string, string>;
  readonly imageId?: UUID;
  readonly position: number;
  readonly isDefault: boolean;
}

// Quantity offer (bulk pricing)
export interface QuantityOffer {
  readonly id: UUID;
  readonly quantity: number;
  readonly price: number;
  readonly discountPercent: number;
  readonly label?: string;
  readonly isDefault: boolean;
}

// Product upsell
export interface ProductUpsell {
  readonly id: UUID;
  readonly name: string;
  readonly description?: string;
  readonly price: number;
  readonly imageUrl?: string;
  readonly position: number;
  readonly isActive: boolean;
}

// Product category
export interface ProductCategory extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly image?: ImageAsset;
  readonly parentId?: UUID;
  readonly position: number;
  readonly productCount: number;
  readonly isActive: boolean;
  readonly seo: SeoMeta;
}

// Product review
export interface ProductReview extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly productId: UUID;
  readonly customerId?: UUID;
  readonly orderId?: UUID;
  readonly rating: number;
  readonly title?: string;
  readonly content?: string;
  readonly customerName: string;
  readonly customerEmail?: string;
  readonly isVerifiedPurchase: boolean;
  readonly isApproved: boolean;
  readonly approvedAt?: Date;
  readonly images?: readonly ImageAsset[];
}

// Create product request
export interface CreateProductRequest {
  readonly name: string;
  readonly description?: string;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly costPerItem?: number;
  readonly sku?: string;
  readonly barcode?: string;
  readonly trackQuantity: boolean;
  readonly quantity?: number;
  readonly categoryId?: UUID;
  readonly tags?: readonly string[];
  readonly status?: ProductStatus;
}

// Update product request
export interface UpdateProductRequest {
  readonly name?: string;
  readonly description?: string;
  readonly shortDescription?: string;
  readonly price?: number;
  readonly compareAtPrice?: number;
  readonly costPerItem?: number;
  readonly sku?: string;
  readonly barcode?: string;
  readonly trackQuantity?: boolean;
  readonly quantity?: number;
  readonly lowStockThreshold?: number;
  readonly categoryId?: UUID;
  readonly tags?: readonly string[];
  readonly status?: ProductStatus;
  readonly promoMessage?: string;
  readonly promoMessageEnabled?: boolean;
  readonly showReviews?: boolean;
  readonly weight?: number;
  readonly weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
  readonly requiresShipping?: boolean;
  readonly shippingPrice?: number;
  readonly freeShipping?: boolean;
  readonly seo?: Partial<SeoMeta>;
}

// Product list item (for table views)
export interface ProductListItem {
  readonly id: UUID;
  readonly name: string;
  readonly slug: string;
  readonly sku?: string;
  readonly featuredImage?: ProductImage;
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly quantity: number;
  readonly status: ProductStatus;
  readonly stockStatus: StockStatus;
  readonly categoryName?: string;
  readonly totalSold: number;
  readonly createdAt: Date;
}

// Product statistics
export interface ProductStatistics {
  readonly totalProducts: number;
  readonly activeProducts: number;
  readonly draftProducts: number;
  readonly lowStockProducts: number;
  readonly outOfStockProducts: number;
  readonly totalStockValue: Money;
}

// Category tree node
export interface CategoryTreeNode extends ProductCategory {
  readonly children: readonly CategoryTreeNode[];
}

// Product filter
export interface ProductFilter {
  readonly status?: ProductStatus;
  readonly categoryId?: UUID;
  readonly stockStatus?: StockStatus;
  readonly minPrice?: number;
  readonly maxPrice?: number;
  readonly search?: string;
  readonly tags?: readonly string[];
}

// Inventory update
export interface InventoryUpdate {
  readonly productId: UUID;
  readonly variantId?: UUID;
  readonly quantity: number;
  readonly reason?: string;
}

// Bulk inventory update
export interface BulkInventoryUpdate {
  readonly updates: readonly InventoryUpdate[];
}
