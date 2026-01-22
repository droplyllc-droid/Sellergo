/**
 * Store types
 */

import type {
  TenantScopedEntity,
  UUID,
  UserId,
  CurrencyCode,
  Language,
  ImageAsset,
  ContactInfo,
  SeoMeta,
  Address,
} from './common';
import type { UserRole } from './auth';

// Store status
export enum StoreStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

// Store plan
export enum StorePlan {
  FREE = 'free',
  STARTER = 'starter',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}

// Country restriction mode
export enum CountryRestrictionMode {
  ALLOW_ALL = 'allow_all',
  ALLOW_SELECTED = 'allow_selected',
  BLOCK_SELECTED = 'block_selected',
}

// Store entity
export interface Store extends TenantScopedEntity {
  readonly name: string;
  readonly slug: string;
  readonly description?: string;
  readonly logo?: ImageAsset;
  readonly favicon?: ImageAsset;
  readonly currency: CurrencyCode;
  readonly defaultLanguage: Language;
  readonly supportedLanguages: readonly Language[];
  readonly timezone: string;
  readonly status: StoreStatus;
  readonly plan: StorePlan;
  readonly ownerId: UserId;

  // Contact
  readonly contactInfo: ContactInfo;
  readonly businessAddress?: Address;

  // Settings
  readonly settings: StoreSettings;

  // Domain
  readonly subdomain: string;
  readonly customDomain?: string;
  readonly customDomainVerified: boolean;

  // SEO
  readonly seo: SeoMeta;

  // Analytics
  readonly visitTrackingEnabled: boolean;
}

// Store settings
export interface StoreSettings {
  // Regional
  readonly countryRestrictionMode: CountryRestrictionMode;
  readonly allowedCountries: readonly string[];
  readonly blockedCountries: readonly string[];

  // Checkout
  readonly requirePhone: boolean;
  readonly requireAddress: boolean;
  readonly showQuantityOffers: boolean;
  readonly showUpsells: boolean;
  readonly showTrustBadges: boolean;

  // Notifications
  readonly orderNotificationEmail?: string;
  readonly lowStockThreshold: number;
  readonly lowStockNotificationEnabled: boolean;

  // Appearance
  readonly themeId: string;
  readonly primaryColor: string;
  readonly accentColor: string;

  // Content
  readonly headerCode?: string;
  readonly footerCode?: string;

  // Thank you page
  readonly thankYouPageTitle: string;
  readonly thankYouPageSubtitle: string;
  readonly thankYouPageNextStepsTitle: string;
  readonly thankYouPageNextStepsDescription: string;
}

// Store theme
export interface StoreTheme {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly previewImage: ImageAsset;
  readonly colorSchemes: readonly ColorScheme[];
  readonly isDefault: boolean;
}

export interface ColorScheme {
  readonly primary: string;
  readonly accent: string;
  readonly background: string;
}

// Navigation menu
export interface NavigationMenu {
  readonly id: UUID;
  readonly storeId: UUID;
  readonly type: 'header' | 'footer';
  readonly column?: number;
  readonly title?: string;
  readonly items: readonly NavigationMenuItem[];
}

export interface NavigationMenuItem {
  readonly id: UUID;
  readonly label: string;
  readonly url: string;
  readonly openInNewTab: boolean;
  readonly position: number;
}

// Store domain
export interface StoreDomain extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly domain: string;
  readonly type: 'subdomain' | 'custom';
  readonly isPrimary: boolean;
  readonly isVerified: boolean;
  readonly verificationToken?: string;
  readonly verificationMethod?: 'cname' | 'txt';
  readonly verifiedAt?: Date;
  readonly sslStatus: 'pending' | 'active' | 'failed';
  readonly sslIssuedAt?: Date;
  readonly sslExpiresAt?: Date;
}

// Domain configuration
export const DOMAIN_CONFIG = {
  baseDomain: 'sellergo.shop',
  appSubdomain: 'app',
  getStorefrontUrl: (slug: string): string => `https://${slug}.sellergo.shop`,
  getProductUrl: (slug: string, productSlug: string): string =>
    `https://${slug}.sellergo.shop/products/${productSlug}`,
  getCustomDomainProductUrl: (domain: string, productSlug: string): string =>
    `https://${domain}/products/${productSlug}`,
} as const;

// Store statistics
export interface StoreStatistics {
  readonly totalOrders: number;
  readonly totalRevenue: number;
  readonly totalProducts: number;
  readonly totalCustomers: number;
  readonly averageOrderValue: number;
  readonly confirmationRate: number;
  readonly deliveryRate: number;
}

// Store member
export interface StoreMember {
  readonly id: UUID;
  readonly userId: UserId;
  readonly storeId: UUID;
  readonly role: UserRole;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar?: ImageAsset;
  readonly status: 'pending' | 'active' | 'revoked';
  readonly joinedAt?: Date;
  readonly lastLoginAt?: Date;
  readonly invitedBy?: UserId;
}

// Invite member request
export interface InviteMemberRequest {
  readonly email: string;
  readonly role: UserRole;
  readonly permissions?: readonly string[];
}

// Update store request
export interface UpdateStoreRequest {
  readonly name?: string;
  readonly description?: string;
  readonly currency?: CurrencyCode;
  readonly defaultLanguage?: Language;
  readonly contactInfo?: Partial<ContactInfo>;
  readonly settings?: Partial<StoreSettings>;
  readonly seo?: Partial<SeoMeta>;
}

// Store creation data (for onboarding)
export interface StoreCreationData {
  readonly name: string;
  readonly slug: string;
  readonly currency: CurrencyCode;
  readonly language: Language;
}

// Store summary (for list views)
export interface StoreSummary {
  readonly id: UUID;
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly logo?: ImageAsset;
  readonly status: StoreStatus;
  readonly plan: StorePlan;
  readonly statistics: {
    readonly totalOrders: number;
    readonly totalRevenue: number;
  };
}
