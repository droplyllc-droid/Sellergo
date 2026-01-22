/**
 * Auth Module Types
 */

import type { ImageAsset, Language, UserRole } from '@sellergo/types';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: ImageAsset;
  preferredLanguage: Language;
  mfaEnabled: boolean;
  emailVerified?: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface StoreMembershipSummary {
  storeId: string;
  storeName: string;
  storeLogo?: ImageAsset;
  role: UserRole;
  isOwner: boolean;
}

export interface MfaSetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface LoginResult {
  user: UserProfile;
  tokens: AuthTokens | null;
  requiresMfa: boolean;
  stores: StoreMembershipSummary[];
}

export interface RegisterResult {
  user: UserProfile;
  requiresVerification: boolean;
}

export interface RegisterWithStoreResult {
  user: UserProfile;
  store: {
    id: string;
    name: string;
    slug: string;
  };
  tokens: AuthTokens;
  requiresVerification: boolean;
}

export interface SessionInfo {
  id: string;
  userAgent: string;
  ipAddress: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
    isMobile: boolean;
  };
  createdAt: Date;
  lastActivityAt: Date;
  isCurrent: boolean;
}
