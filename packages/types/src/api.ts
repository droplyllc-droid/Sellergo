/**
 * API types - Request/Response wrappers and API contracts
 */

import type { ErrorCode, PaginatedResponse, PaginationParams } from './common';

// =============================================================================
// API RESPONSE WRAPPERS
// =============================================================================

// Success response
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: ResponseMeta;
}

// Error response
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly details?: Record<string, unknown>;
    readonly validationErrors?: readonly ValidationError[];
  };
  readonly meta: ResponseMeta;
}

// Response metadata
export interface ResponseMeta {
  readonly requestId: string;
  readonly timestamp: string;
  readonly version: string;
  readonly duration?: number;
}

// Validation error
export interface ValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
}

// Generic API response
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Paginated API response
export interface ApiPaginatedResponse<T> extends ApiSuccessResponse<PaginatedResponse<T>> {
  readonly data: PaginatedResponse<T>;
}

// =============================================================================
// API REQUEST TYPES
// =============================================================================

// Base list query params
export interface ListQueryParams extends PaginationParams {
  readonly search?: string;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

// Date filter params
export interface DateFilterParams {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly period?: string;
}

// =============================================================================
// API VERSIONING
// =============================================================================

export const API_VERSION = 'v1';
export const API_BASE_PATH = `/api/${API_VERSION}`;

// =============================================================================
// API ENDPOINTS (for type safety)
// =============================================================================

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    MFA_SETUP: '/auth/mfa/setup',
    MFA_VERIFY: '/auth/mfa/verify',
    MFA_DISABLE: '/auth/mfa/disable',
    ME: '/auth/me',
    SESSIONS: '/auth/sessions',
  },

  // Stores
  STORES: {
    LIST: '/stores',
    CREATE: '/stores',
    GET: (id: string) => `/stores/${id}`,
    UPDATE: (id: string) => `/stores/${id}`,
    DELETE: (id: string) => `/stores/${id}`,
    SWITCH: (id: string) => `/stores/${id}/switch`,
    SETTINGS: (id: string) => `/stores/${id}/settings`,
    DOMAINS: (id: string) => `/stores/${id}/domains`,
  },

  // Products
  PRODUCTS: {
    LIST: '/products',
    CREATE: '/products',
    GET: (id: string) => `/products/${id}`,
    UPDATE: (id: string) => `/products/${id}`,
    DELETE: (id: string) => `/products/${id}`,
    IMAGES: (id: string) => `/products/${id}/images`,
    VARIANTS: (id: string) => `/products/${id}/variants`,
    DUPLICATE: (id: string) => `/products/${id}/duplicate`,
  },

  // Categories
  CATEGORIES: {
    LIST: '/categories',
    CREATE: '/categories',
    GET: (id: string) => `/categories/${id}`,
    UPDATE: (id: string) => `/categories/${id}`,
    DELETE: (id: string) => `/categories/${id}`,
  },

  // Orders
  ORDERS: {
    LIST: '/orders',
    CREATE: '/orders',
    GET: (id: string) => `/orders/${id}`,
    UPDATE: (id: string) => `/orders/${id}`,
    CANCEL: (id: string) => `/orders/${id}/cancel`,
    CONFIRM: (id: string) => `/orders/${id}/confirm`,
    SHIP: (id: string) => `/orders/${id}/ship`,
    DELIVER: (id: string) => `/orders/${id}/deliver`,
    TIMELINE: (id: string) => `/orders/${id}/timeline`,
    EXPORT: '/orders/export',
  },

  // Abandoned Carts
  ABANDONED_CARTS: {
    LIST: '/abandoned-carts',
    GET: (id: string) => `/abandoned-carts/${id}`,
    RECOVER: (id: string) => `/abandoned-carts/${id}/recover`,
  },

  // Customers
  CUSTOMERS: {
    LIST: '/customers',
    CREATE: '/customers',
    GET: (id: string) => `/customers/${id}`,
    UPDATE: (id: string) => `/customers/${id}`,
    DELETE: (id: string) => `/customers/${id}`,
    ORDERS: (id: string) => `/customers/${id}/orders`,
    BLOCK: '/customers/block',
    UNBLOCK: (id: string) => `/customers/block/${id}`,
    BLOCKED: '/customers/blocked',
  },

  // Team
  TEAM: {
    LIST: '/team',
    INVITE: '/team/invite',
    GET: (id: string) => `/team/${id}`,
    UPDATE: (id: string) => `/team/${id}`,
    REMOVE: (id: string) => `/team/${id}`,
    RESEND_INVITE: (id: string) => `/team/${id}/resend-invite`,
    ACCEPT_INVITE: '/team/accept-invite',
  },

  // Analytics
  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    SALES: '/analytics/sales',
    CUSTOMERS: '/analytics/customers',
    TRAFFIC: '/analytics/traffic',
    PRODUCTS: '/analytics/products',
    TEAM: '/analytics/team',
    CALCULATOR: '/analytics/calculator',
    REALTIME: '/analytics/realtime',
    EXPORT: '/analytics/export',
  },

  // Integrations
  INTEGRATIONS: {
    STATUS: '/integrations/status',
    ANALYTICS: '/integrations/analytics',
    PIXELS: '/integrations/pixels',
    WEBHOOKS: '/integrations/webhooks',
  },

  // Apps
  APPS: {
    LIST: '/apps',
    GET: (id: string) => `/apps/${id}`,
    INSTALL: (id: string) => `/apps/${id}/install`,
    UNINSTALL: (id: string) => `/apps/${id}/uninstall`,
    CONFIGURE: (id: string) => `/apps/${id}/configure`,
    INSTALLED: '/apps/installed',
  },

  // Billing
  BILLING: {
    ACCOUNT: '/billing/account',
    TRANSACTIONS: '/billing/transactions',
    TOP_UP: '/billing/top-up',
    INVOICES: '/billing/invoices',
    PAYMENT_METHODS: '/billing/payment-methods',
    PLANS: '/billing/plans',
    SUBSCRIBE: '/billing/subscribe',
    CANCEL_SUBSCRIPTION: '/billing/cancel-subscription',
  },

  // Settings
  SETTINGS: {
    GENERAL: '/settings/general',
    CONTENT: '/settings/content',
    THEMES: '/settings/themes',
    DOMAINS: '/settings/domains',
    PAYMENTS: '/settings/payments',
    SHIPPING: '/settings/shipping',
    SEO: '/settings/seo',
  },

  // Profile
  PROFILE: {
    GET: '/profile',
    UPDATE: '/profile',
    CHANGE_PASSWORD: '/profile/change-password',
    DELETE_ACCOUNT: '/profile/delete',
  },

  // Uploads
  UPLOADS: {
    IMAGE: '/uploads/image',
    PRODUCT_IMAGES: '/uploads/product-images',
  },

  // Webhooks (incoming from external services)
  WEBHOOKS: {
    STRIPE: '/webhooks/stripe',
    CARRIER: (carrier: string) => `/webhooks/carrier/${carrier}`,
  },
} as const;

// =============================================================================
// RATE LIMITING
// =============================================================================

export interface RateLimitInfo {
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
}

export const RATE_LIMITS = {
  // Per IP
  GLOBAL: { limit: 1000, window: 60 }, // 1000 req/min
  AUTH: { limit: 10, window: 60 }, // 10 req/min for auth endpoints

  // Per tenant
  API: { limit: 100, window: 60 }, // 100 req/min
  UPLOADS: { limit: 20, window: 60 }, // 20 uploads/min
  EXPORTS: { limit: 5, window: 60 }, // 5 exports/min
  WEBHOOKS: { limit: 50, window: 60 }, // 50 webhook deliveries/min
} as const;

// =============================================================================
// WEBHOOK SIGNATURES
// =============================================================================

export interface WebhookSignature {
  readonly timestamp: number;
  readonly signature: string;
  readonly algorithm: 'sha256';
}

export const WEBHOOK_SIGNATURE_HEADER = 'x-sellergo-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-sellergo-timestamp';
export const WEBHOOK_TOLERANCE_SECONDS = 300; // 5 minutes

// =============================================================================
// API HEADERS
// =============================================================================

export const API_HEADERS = {
  REQUEST_ID: 'x-request-id',
  TENANT_ID: 'x-tenant-id',
  STORE_ID: 'x-store-id',
  API_VERSION: 'x-api-version',
  RATE_LIMIT_LIMIT: 'x-ratelimit-limit',
  RATE_LIMIT_REMAINING: 'x-ratelimit-remaining',
  RATE_LIMIT_RESET: 'x-ratelimit-reset',
} as const;
