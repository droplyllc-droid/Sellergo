/**
 * Integration types (pixels, webhooks, apps)
 */

import type {
  TenantScopedEntity,
  UUID,
  ImageAsset,
} from './common';

// =============================================================================
// ANALYTICS INTEGRATIONS
// =============================================================================

export enum AnalyticsProvider {
  GOOGLE_ANALYTICS = 'google_analytics',
  GOOGLE_TAG_MANAGER = 'google_tag_manager',
  GOOGLE_ADS = 'google_ads',
}

export interface AnalyticsIntegration extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly provider: AnalyticsProvider;
  readonly isEnabled: boolean;
  readonly config: GoogleAnalyticsConfig | GoogleTagManagerConfig | GoogleAdsConfig;
}

export interface GoogleAnalyticsConfig {
  readonly measurementId: string;
  readonly enableEnhancedEcommerce: boolean;
}

export interface GoogleTagManagerConfig {
  readonly containerId: string;
}

export interface GoogleAdsConfig {
  readonly conversionId: string;
  readonly conversionLabel?: string;
}

// =============================================================================
// AD PIXELS
// =============================================================================

export enum PixelProvider {
  META = 'meta',
  TIKTOK = 'tiktok',
  SNAPCHAT = 'snapchat',
  TWITTER = 'twitter',
  PINTEREST = 'pinterest',
}

export interface AdPixel extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly provider: PixelProvider;
  readonly name: string;
  readonly pixelId: string;
  readonly accessToken?: string;
  readonly testEventCode?: string;
  readonly isEnabled: boolean;
  readonly enableConversionsApi: boolean;
  readonly events: readonly PixelEvent[];
}

export enum PixelEvent {
  PAGE_VIEW = 'PageView',
  VIEW_CONTENT = 'ViewContent',
  ADD_TO_CART = 'AddToCart',
  INITIATE_CHECKOUT = 'InitiateCheckout',
  PURCHASE = 'Purchase',
  LEAD = 'Lead',
}

export interface CreatePixelRequest {
  readonly provider: PixelProvider;
  readonly name: string;
  readonly pixelId: string;
  readonly accessToken?: string;
  readonly testEventCode?: string;
  readonly enableConversionsApi?: boolean;
}

export interface UpdatePixelRequest {
  readonly name?: string;
  readonly pixelId?: string;
  readonly accessToken?: string;
  readonly testEventCode?: string;
  readonly isEnabled?: boolean;
  readonly enableConversionsApi?: boolean;
}

// =============================================================================
// WEBHOOKS
// =============================================================================

export enum WebhookEvent {
  ORDER_CREATED = 'order.created',
  ORDER_UPDATED = 'order.updated',
  ORDER_CONFIRMED = 'order.confirmed',
  ORDER_SHIPPED = 'order.shipped',
  ORDER_DELIVERED = 'order.delivered',
  ORDER_CANCELLED = 'order.cancelled',
  PRODUCT_CREATED = 'product.created',
  PRODUCT_UPDATED = 'product.updated',
  PRODUCT_DELETED = 'product.deleted',
  CUSTOMER_CREATED = 'customer.created',
  CUSTOMER_UPDATED = 'customer.updated',
  CART_ABANDONED = 'cart.abandoned',
  LOW_STOCK = 'inventory.low_stock',
}

export interface Webhook extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly name: string;
  readonly url: string;
  readonly secret: string;
  readonly events: readonly WebhookEvent[];
  readonly isEnabled: boolean;
  readonly headers?: Record<string, string>;
  readonly lastTriggeredAt?: Date;
  readonly lastStatus?: number;
  readonly failureCount: number;
}

export interface WebhookDelivery extends TenantScopedEntity {
  readonly webhookId: UUID;
  readonly event: WebhookEvent;
  readonly payload: Record<string, unknown>;
  readonly responseStatus?: number;
  readonly responseBody?: string;
  readonly duration?: number;
  readonly success: boolean;
  readonly errorMessage?: string;
  readonly attemptNumber: number;
  readonly nextRetryAt?: Date;
}

export interface CreateWebhookRequest {
  readonly name: string;
  readonly url: string;
  readonly events: readonly WebhookEvent[];
  readonly headers?: Record<string, string>;
}

export interface UpdateWebhookRequest {
  readonly name?: string;
  readonly url?: string;
  readonly events?: readonly WebhookEvent[];
  readonly isEnabled?: boolean;
  readonly headers?: Record<string, string>;
}

// Webhook payload structure
export interface WebhookPayload<T = unknown> {
  readonly event: WebhookEvent;
  readonly timestamp: string;
  readonly data: T;
  readonly storeId: string;
  readonly webhookId: string;
}

// =============================================================================
// APPS (Third-party integrations)
// =============================================================================

export enum AppCategory {
  PRODUCTIVITY = 'productivity',
  AUTOMATION = 'automation',
  NOTIFICATIONS = 'notifications',
  MARKETING = 'marketing',
  ANALYTICS = 'analytics',
  SHIPPING = 'shipping',
}

export enum AppStatus {
  AVAILABLE = 'available',
  COMING_SOON = 'coming_soon',
  BETA = 'beta',
}

export interface App {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly description: string;
  readonly shortDescription: string;
  readonly logo: ImageAsset;
  readonly category: AppCategory;
  readonly status: AppStatus;
  readonly features: readonly string[];
  readonly developer: string;
  readonly websiteUrl?: string;
  readonly privacyPolicyUrl?: string;
  readonly termsUrl?: string;
  readonly requiredScopes: readonly string[];
}

export interface InstalledApp extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly appId: string;
  readonly appName: string;
  readonly isEnabled: boolean;
  readonly config: Record<string, unknown>;
  readonly installedBy: UUID;
  readonly installedAt: Date;
  readonly lastUsedAt?: Date;
}

// Google Sheets integration
export interface GoogleSheetsConfig {
  readonly spreadsheetId: string;
  readonly sheetName: string;
  readonly columnMapping: Record<string, string>;
  readonly syncNewOrders: boolean;
  readonly syncOrderUpdates: boolean;
  readonly lastSyncAt?: Date;
}

// Zapier integration (via webhooks)
export interface ZapierConfig {
  readonly webhookUrl: string;
  readonly triggerEvents: readonly WebhookEvent[];
}

// WhatsApp Business integration
export interface WhatsAppConfig {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly businessAccountId: string;
  readonly enableOrderConfirmation: boolean;
  readonly enableShippingUpdates: boolean;
  readonly enableDeliveryNotification: boolean;
  readonly templates: Record<string, string>;
}

// =============================================================================
// INTEGRATION STATUS
// =============================================================================

export interface IntegrationStatus {
  readonly googleAnalytics: boolean;
  readonly googleTagManager: boolean;
  readonly googleAds: boolean;
  readonly metaPixel: boolean;
  readonly tiktokPixel: boolean;
  readonly snapchatPixel: boolean;
  readonly twitterPixel: boolean;
  readonly pinterestTag: boolean;
  readonly totalActive: number;
  readonly totalAvailable: number;
}

// =============================================================================
// PIXEL EVENTS DATA
// =============================================================================

export interface PixelEventData {
  readonly eventName: PixelEvent;
  readonly eventId: string;
  readonly timestamp: number;
  readonly sourceUrl: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly userData?: {
    readonly email?: string;
    readonly phone?: string;
    readonly firstName?: string;
    readonly lastName?: string;
    readonly city?: string;
    readonly country?: string;
  };
  readonly customData?: {
    readonly currency?: string;
    readonly value?: number;
    readonly contentIds?: readonly string[];
    readonly contentType?: string;
    readonly contentName?: string;
    readonly numItems?: number;
    readonly orderId?: string;
  };
}
