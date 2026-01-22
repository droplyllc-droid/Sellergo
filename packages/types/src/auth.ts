/**
 * Authentication and Authorization types
 */

import type { BaseEntity, TenantId, UserId, UUID, Language, ImageAsset } from './common';

// User roles
export enum UserRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
  READ_ONLY = 'read_only',
}

// Permissions
export enum Permission {
  // Store
  STORE_READ = 'store:read',
  STORE_UPDATE = 'store:update',
  STORE_DELETE = 'store:delete',

  // Products
  PRODUCT_CREATE = 'product:create',
  PRODUCT_READ = 'product:read',
  PRODUCT_UPDATE = 'product:update',
  PRODUCT_DELETE = 'product:delete',

  // Orders
  ORDER_CREATE = 'order:create',
  ORDER_READ = 'order:read',
  ORDER_UPDATE = 'order:update',
  ORDER_DELETE = 'order:delete',
  ORDER_EXPORT = 'order:export',

  // Customers
  CUSTOMER_READ = 'customer:read',
  CUSTOMER_UPDATE = 'customer:update',
  CUSTOMER_BLOCK = 'customer:block',
  CUSTOMER_DELETE = 'customer:delete',

  // Analytics
  ANALYTICS_READ = 'analytics:read',
  ANALYTICS_EXPORT = 'analytics:export',

  // Team
  TEAM_READ = 'team:read',
  TEAM_INVITE = 'team:invite',
  TEAM_UPDATE = 'team:update',
  TEAM_REMOVE = 'team:remove',

  // Settings
  SETTINGS_READ = 'settings:read',
  SETTINGS_UPDATE = 'settings:update',

  // Integrations
  INTEGRATION_READ = 'integration:read',
  INTEGRATION_MANAGE = 'integration:manage',

  // Billing
  BILLING_READ = 'billing:read',
  BILLING_MANAGE = 'billing:manage',
}

// Role to permissions mapping
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.OWNER]: Object.values(Permission),
  [UserRole.ADMIN]: [
    Permission.STORE_READ,
    Permission.STORE_UPDATE,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE,
    Permission.ORDER_DELETE,
    Permission.ORDER_EXPORT,
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_UPDATE,
    Permission.CUSTOMER_BLOCK,
    Permission.ANALYTICS_READ,
    Permission.ANALYTICS_EXPORT,
    Permission.TEAM_READ,
    Permission.TEAM_INVITE,
    Permission.TEAM_UPDATE,
    Permission.SETTINGS_READ,
    Permission.SETTINGS_UPDATE,
    Permission.INTEGRATION_READ,
    Permission.INTEGRATION_MANAGE,
    Permission.BILLING_READ,
  ],
  [UserRole.MANAGER]: [
    Permission.STORE_READ,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_READ,
    Permission.PRODUCT_UPDATE,
    Permission.ORDER_CREATE,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE,
    Permission.CUSTOMER_READ,
    Permission.CUSTOMER_UPDATE,
    Permission.ANALYTICS_READ,
    Permission.TEAM_READ,
    Permission.SETTINGS_READ,
  ],
  [UserRole.STAFF]: [
    Permission.STORE_READ,
    Permission.PRODUCT_READ,
    Permission.ORDER_READ,
    Permission.ORDER_UPDATE,
    Permission.CUSTOMER_READ,
  ],
  [UserRole.READ_ONLY]: [
    Permission.STORE_READ,
    Permission.PRODUCT_READ,
    Permission.ORDER_READ,
    Permission.CUSTOMER_READ,
    Permission.ANALYTICS_READ,
  ],
} as const;

// User status
export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

// MFA method
export enum MfaMethod {
  TOTP = 'totp',
  SMS = 'sms',
  EMAIL = 'email',
  WEBAUTHN = 'webauthn',
}

// User entity
export interface User extends BaseEntity {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly emailVerifiedAt?: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar?: ImageAsset;
  readonly status: UserStatus;
  readonly preferredLanguage: Language;
  readonly mfaEnabled: boolean;
  readonly mfaMethod?: MfaMethod;
  readonly lastLoginAt?: Date;
  readonly lastLoginIp?: string;
  readonly failedLoginAttempts: number;
  readonly lockedUntil?: Date;
}

// User profile (safe to expose)
export interface UserProfile {
  readonly id: UserId;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatar?: ImageAsset;
  readonly preferredLanguage: Language;
  readonly mfaEnabled: boolean;
}

// Store membership (user's role in a store)
export interface StoreMembership {
  readonly id: UUID;
  readonly userId: UserId;
  readonly storeId: UUID;
  readonly tenantId: TenantId;
  readonly role: UserRole;
  readonly permissions: readonly Permission[];
  readonly invitedBy?: UserId;
  readonly invitedAt: Date;
  readonly acceptedAt?: Date;
  readonly status: 'pending' | 'active' | 'revoked';
}

// JWT payload
export interface JwtPayload {
  readonly sub: UserId;
  readonly email: string;
  readonly tenantId: TenantId;
  readonly storeId?: UUID;
  readonly role?: UserRole;
  readonly permissions?: readonly Permission[];
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
  readonly type: 'access' | 'refresh';
}

// Auth tokens
export interface AuthTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly tokenType: 'Bearer';
}

// Login request
export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly rememberMe?: boolean;
  readonly mfaCode?: string;
}

// Login response
export interface LoginResponse {
  readonly user: UserProfile;
  readonly tokens: AuthTokens;
  readonly requiresMfa: boolean;
  readonly stores: readonly StoreMembershipSummary[];
}

// Store membership summary
export interface StoreMembershipSummary {
  readonly storeId: UUID;
  readonly storeName: string;
  readonly storeLogo?: ImageAsset;
  readonly role: UserRole;
  readonly isOwner: boolean;
}

// Registration request
export interface RegisterRequest {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly password: string;
  readonly preferredLanguage?: Language;
}

// Store creation during registration
export interface CreateStoreRequest {
  readonly name: string;
  readonly slug: string;
  readonly currency: string;
  readonly language: Language;
}

// Password reset request
export interface PasswordResetRequest {
  readonly email: string;
}

// Password reset confirm
export interface PasswordResetConfirm {
  readonly token: string;
  readonly newPassword: string;
}

// Change password
export interface ChangePasswordRequest {
  readonly currentPassword: string;
  readonly newPassword: string;
}

// MFA setup
export interface MfaSetupResponse {
  readonly secret: string;
  readonly qrCodeUrl: string;
  readonly backupCodes: readonly string[];
}

// MFA verify
export interface MfaVerifyRequest {
  readonly code: string;
}

// Session
export interface Session extends BaseEntity {
  readonly userId: UserId;
  readonly refreshTokenHash: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly expiresAt: Date;
  readonly revokedAt?: Date;
  readonly lastActivityAt: Date;
}

// Audit log for auth events
export interface AuthAuditLog {
  readonly id: UUID;
  readonly userId: UserId;
  readonly tenantId?: TenantId;
  readonly action: AuthAction;
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: Date;
}

export enum AuthAction {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILED = 'login_failed',
  LOGOUT = 'logout',
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  EMAIL_VERIFIED = 'email_verified',
  SESSION_REVOKED = 'session_revoked',
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
}

// OAuth provider
export enum OAuthProvider {
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
}

// OAuth account link
export interface OAuthAccount {
  readonly id: UUID;
  readonly userId: UserId;
  readonly provider: OAuthProvider;
  readonly providerAccountId: string;
  readonly email?: string;
  readonly createdAt: Date;
}
