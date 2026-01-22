/**
 * Order types
 */

import type {
  TenantScopedEntity,
  UUID,
  Address,
  Money,
  ImageAsset,
} from './common';

// Order status
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
  REFUNDED = 'refunded',
}

// Payment status
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIALLY_PAID = 'partially_paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}

// Payment method
export enum PaymentMethod {
  COD = 'cod',
  CARD = 'card',
  BANK_TRANSFER = 'bank_transfer',
}

// Fulfillment status
export enum FulfillmentStatus {
  UNFULFILLED = 'unfulfilled',
  PARTIALLY_FULFILLED = 'partially_fulfilled',
  FULFILLED = 'fulfilled',
}

// Order source
export enum OrderSource {
  STOREFRONT = 'storefront',
  MANUAL = 'manual',
  IMPORT = 'import',
  API = 'api',
}

// Order entity
export interface Order extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly orderNumber: string;
  readonly customerId?: UUID;

  // Status
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly fulfillmentStatus: FulfillmentStatus;

  // Customer info
  readonly customerEmail?: string;
  readonly customerPhone: string;
  readonly customerName: string;

  // Shipping
  readonly shippingAddress: Address;
  readonly billingAddress?: Address;

  // Items
  readonly items: readonly OrderItem[];
  readonly itemCount: number;

  // Pricing
  readonly subtotal: number;
  readonly shippingCost: number;
  readonly discount: number;
  readonly total: number;
  readonly currency: string;

  // Payment
  readonly paymentMethod: PaymentMethod;
  readonly paidAt?: Date;
  readonly paidAmount: number;

  // Source & tracking
  readonly source: OrderSource;
  readonly sourceIp?: string;
  readonly sourceUrl?: string;
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;

  // Delivery
  readonly carrierId?: UUID;
  readonly carrierName?: string;
  readonly trackingNumber?: string;
  readonly trackingUrl?: string;
  readonly estimatedDeliveryDate?: Date;
  readonly shippedAt?: Date;
  readonly deliveredAt?: Date;

  // Notes
  readonly customerNote?: string;
  readonly internalNote?: string;

  // Timestamps
  readonly confirmedAt?: Date;
  readonly cancelledAt?: Date;
  readonly cancellationReason?: string;

  // Fees (platform fees)
  readonly platformFee: number;
  readonly platformFeeRate: number;
}

// Order item
export interface OrderItem {
  readonly id: UUID;
  readonly orderId: UUID;
  readonly productId: UUID;
  readonly variantId?: UUID;
  readonly name: string;
  readonly sku?: string;
  readonly image?: ImageAsset;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly totalPrice: number;
  readonly discount: number;
  readonly options?: Record<string, string>;
  readonly isUpsell: boolean;
}

// Order timeline event
export interface OrderTimelineEvent {
  readonly id: UUID;
  readonly orderId: UUID;
  readonly type: OrderEventType;
  readonly title: string;
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
  readonly createdBy?: UUID;
  readonly isSystem: boolean;
}

export enum OrderEventType {
  CREATED = 'created',
  CONFIRMED = 'confirmed',
  PAYMENT_RECEIVED = 'payment_received',
  PROCESSING_STARTED = 'processing_started',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  NOTE_ADDED = 'note_added',
  STATUS_CHANGED = 'status_changed',
  TRACKING_UPDATED = 'tracking_updated',
}

// Abandoned cart
export interface AbandonedCart extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly cartId: string;
  readonly customerId?: UUID;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
  readonly customerName?: string;
  readonly items: readonly CartItem[];
  readonly subtotal: number;
  readonly currency: string;
  readonly abandonedAt: Date;
  readonly recoveryEmailSent: boolean;
  readonly recoveryEmailSentAt?: Date;
  readonly recoveredAt?: Date;
  readonly recoveredOrderId?: UUID;
  readonly sourceUrl?: string;
  readonly sourceIp?: string;
}

// Cart item
export interface CartItem {
  readonly productId: UUID;
  readonly variantId?: UUID;
  readonly name: string;
  readonly image?: ImageAsset;
  readonly quantity: number;
  readonly price: number;
  readonly options?: Record<string, string>;
}

// Order statistics
export interface OrderStatistics {
  readonly totalOrders: number;
  readonly totalRevenue: Money;
  readonly averageOrderValue: Money;
  readonly confirmationRate: number;
  readonly deliveryRate: number;
  readonly pendingOrders: number;
  readonly confirmedOrders: number;
  readonly shippedOrders: number;
  readonly deliveredOrders: number;
  readonly cancelledOrders: number;
}

// Abandoned cart statistics
export interface AbandonedCartStatistics {
  readonly totalAbandoned: number;
  readonly totalRecovered: number;
  readonly recoveryRate: number;
  readonly lostRevenue: Money;
  readonly recoveredRevenue: Money;
}

// Create order request (manual order)
export interface CreateOrderRequest {
  readonly customerName: string;
  readonly customerPhone: string;
  readonly customerEmail?: string;
  readonly shippingAddress: Address;
  readonly items: readonly CreateOrderItemRequest[];
  readonly shippingCost?: number;
  readonly discount?: number;
  readonly customerNote?: string;
  readonly internalNote?: string;
  readonly paymentMethod: PaymentMethod;
}

export interface CreateOrderItemRequest {
  readonly productId: UUID;
  readonly variantId?: UUID;
  readonly quantity: number;
  readonly unitPrice?: number;
}

// Update order request
export interface UpdateOrderRequest {
  readonly status?: OrderStatus;
  readonly paymentStatus?: PaymentStatus;
  readonly trackingNumber?: string;
  readonly trackingUrl?: string;
  readonly carrierName?: string;
  readonly internalNote?: string;
  readonly estimatedDeliveryDate?: Date;
}

// Order filter
export interface OrderFilter {
  readonly status?: OrderStatus | readonly OrderStatus[];
  readonly paymentStatus?: PaymentStatus;
  readonly fulfillmentStatus?: FulfillmentStatus;
  readonly paymentMethod?: PaymentMethod;
  readonly source?: OrderSource;
  readonly customerId?: UUID;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
  readonly search?: string;
  readonly minTotal?: number;
  readonly maxTotal?: number;
}

// Order list item (for table views)
export interface OrderListItem {
  readonly id: UUID;
  readonly orderNumber: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly items: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly image?: ImageAsset;
  }[];
  readonly itemCount: number;
  readonly total: number;
  readonly currency: string;
  readonly status: OrderStatus;
  readonly paymentStatus: PaymentStatus;
  readonly paymentMethod: PaymentMethod;
  readonly carrierName?: string;
  readonly trackingNumber?: string;
  readonly createdAt: Date;
}

// Export order data
export interface OrderExportData {
  readonly orderNumber: string;
  readonly createdAt: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly customerEmail?: string;
  readonly shippingAddress: string;
  readonly items: string;
  readonly subtotal: number;
  readonly shippingCost: number;
  readonly discount: number;
  readonly total: number;
  readonly status: string;
  readonly paymentStatus: string;
  readonly paymentMethod: string;
  readonly trackingNumber?: string;
}

// Delivery carrier
export interface DeliveryCarrier {
  readonly id: UUID;
  readonly name: string;
  readonly code: string;
  readonly logo?: ImageAsset;
  readonly description?: string;
  readonly isActive: boolean;
  readonly trackingUrlTemplate?: string;
  readonly supportedCountries: readonly string[];
}

// Store carrier connection
export interface StoreCarrierConnection extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly carrierId: UUID;
  readonly carrierName: string;
  readonly apiKey?: string;
  readonly apiSecret?: string;
  readonly accountId?: string;
  readonly isConnected: boolean;
  readonly lastSyncAt?: Date;
  readonly settings?: Record<string, unknown>;
}
