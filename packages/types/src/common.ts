/**
 * Common types used across the application
 */

// Branded types for type safety
declare const __brand: unique symbol;
type Brand<T, TBrand extends string> = T & { [__brand]: TBrand };

export type UUID = Brand<string, 'UUID'>;
export type TenantId = Brand<string, 'TenantId'>;
export type UserId = Brand<string, 'UserId'>;
export type StoreId = Brand<string, 'StoreId'>;
export type ProductId = Brand<string, 'ProductId'>;
export type OrderId = Brand<string, 'OrderId'>;
export type CustomerId = Brand<string, 'CustomerId'>;

// Pagination
export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
  readonly sortBy?: string;
  readonly sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly meta: {
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNextPage: boolean;
    readonly hasPrevPage: boolean;
  };
}

// Date range filter
export interface DateRangeFilter {
  readonly startDate?: Date;
  readonly endDate?: Date;
}

// Currency
export type CurrencyCode = 'TND' | 'USD' | 'EUR' | 'MAD' | 'DZD' | 'EGP' | 'SAR' | 'AED';

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

// Supported languages
export type Language = 'en' | 'fr' | 'ar' | 'es';

// Audit fields
export interface AuditFields {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy?: UserId;
  readonly updatedBy?: UserId;
}

// Soft delete
export interface SoftDeletable {
  readonly deletedAt?: Date;
  readonly deletedBy?: UserId;
}

// Base entity
export interface BaseEntity extends AuditFields {
  readonly id: UUID;
}

// Tenant-scoped entity
export interface TenantScopedEntity extends BaseEntity {
  readonly tenantId: TenantId;
}

// Result type for operations
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// Operation status
export type OperationStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// Address
export interface Address {
  readonly street: string;
  readonly city: string;
  readonly state?: string;
  readonly postalCode?: string;
  readonly country: string;
  readonly phone?: string;
}

// Contact info
export interface ContactInfo {
  readonly email?: string;
  readonly phone?: string;
  readonly whatsapp?: string;
}

// Image
export interface ImageAsset {
  readonly url: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
}

// SEO metadata
export interface SeoMeta {
  readonly title?: string;
  readonly description?: string;
  readonly keywords?: readonly string[];
  readonly ogImage?: string;
  readonly canonicalUrl?: string;
  readonly noIndex?: boolean;
}

// Error codes
export enum ErrorCode {
  // Auth errors (1xxx)
  UNAUTHORIZED = 'AUTH_001',
  INVALID_CREDENTIALS = 'AUTH_002',
  TOKEN_EXPIRED = 'AUTH_003',
  TOKEN_INVALID = 'AUTH_004',
  MFA_REQUIRED = 'AUTH_005',
  MFA_INVALID = 'AUTH_006',
  EMAIL_NOT_VERIFIED = 'AUTH_007',
  ACCOUNT_LOCKED = 'AUTH_008',
  PASSWORD_TOO_WEAK = 'AUTH_009',

  // Authorization errors (2xxx)
  FORBIDDEN = 'AUTHZ_001',
  INSUFFICIENT_PERMISSIONS = 'AUTHZ_002',
  RESOURCE_NOT_FOUND = 'AUTHZ_003',
  TENANT_MISMATCH = 'AUTHZ_004',

  // Validation errors (3xxx)
  VALIDATION_ERROR = 'VAL_001',
  INVALID_INPUT = 'VAL_002',
  MISSING_REQUIRED_FIELD = 'VAL_003',

  // Business logic errors (4xxx)
  STORE_LIMIT_REACHED = 'BIZ_001',
  PRODUCT_OUT_OF_STOCK = 'BIZ_002',
  ORDER_CANNOT_BE_MODIFIED = 'BIZ_003',
  INSUFFICIENT_BALANCE = 'BIZ_004',
  DOMAIN_ALREADY_EXISTS = 'BIZ_005',

  // External service errors (5xxx)
  STRIPE_ERROR = 'EXT_001',
  DELIVERY_SERVICE_ERROR = 'EXT_002',
  EMAIL_SERVICE_ERROR = 'EXT_003',

  // System errors (9xxx)
  INTERNAL_ERROR = 'SYS_001',
  SERVICE_UNAVAILABLE = 'SYS_002',
  RATE_LIMIT_EXCEEDED = 'SYS_003',
  DATABASE_ERROR = 'SYS_004',
}

// API Error response
export interface ApiError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;
  readonly requestId: string;
}
