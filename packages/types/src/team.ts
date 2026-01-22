/**
 * Team types
 */

import type {
  TenantScopedEntity,
  UUID,
  UserId,
  ImageAsset,
} from './common';
import { UserRole, Permission } from './auth';

// Team member status
export enum TeamMemberStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

// Team member
export interface TeamMember extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly userId: UserId;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly avatar?: ImageAsset;
  readonly role: UserRole;
  readonly customPermissions?: readonly Permission[];
  readonly status: TeamMemberStatus;
  readonly invitedBy?: UserId;
  readonly invitedAt: Date;
  readonly acceptedAt?: Date;
  readonly lastLoginAt?: Date;
  readonly lastActivityAt?: Date;
}

// Team invitation
export interface TeamInvitation extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly email: string;
  readonly role: UserRole;
  readonly customPermissions?: readonly Permission[];
  readonly invitedBy: UserId;
  readonly inviteToken: string;
  readonly expiresAt: Date;
  readonly acceptedAt?: Date;
  readonly revokedAt?: Date;
  readonly status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

// Invite request
export interface InviteTeamMemberRequest {
  readonly email: string;
  readonly role: UserRole;
  readonly customPermissions?: readonly Permission[];
  readonly sendEmail?: boolean;
}

// Update member request
export interface UpdateTeamMemberRequest {
  readonly role?: UserRole;
  readonly customPermissions?: readonly Permission[];
}

// Team member list item
export interface TeamMemberListItem {
  readonly id: UUID;
  readonly userId: UserId;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly fullName: string;
  readonly avatar?: ImageAsset;
  readonly role: UserRole;
  readonly status: TeamMemberStatus;
  readonly joinedAt?: Date;
  readonly lastLoginAt?: Date;
  readonly isOnline: boolean;
}

// Team statistics
export interface TeamStatistics {
  readonly totalMembers: number;
  readonly activeMembers: number;
  readonly onlineMembers: number;
  readonly pendingInvitations: number;
  readonly membersByRole: readonly {
    readonly role: UserRole;
    readonly count: number;
    readonly percentage: number;
  }[];
}

// Role definition (for UI)
export interface RoleDefinition {
  readonly role: UserRole;
  readonly name: string;
  readonly description: string;
  readonly permissions: readonly Permission[];
  readonly isCustomizable: boolean;
}

// Permission definition (for UI)
export interface PermissionDefinition {
  readonly permission: Permission;
  readonly name: string;
  readonly description: string;
  readonly category: PermissionCategory;
}

export enum PermissionCategory {
  STORE = 'store',
  PRODUCTS = 'products',
  ORDERS = 'orders',
  CUSTOMERS = 'customers',
  ANALYTICS = 'analytics',
  TEAM = 'team',
  SETTINGS = 'settings',
  INTEGRATIONS = 'integrations',
  BILLING = 'billing',
}

// Role definitions
export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    role: UserRole.OWNER,
    name: 'Owner',
    description: 'Full ownership and control of the store',
    permissions: Object.values(Permission),
    isCustomizable: false,
  },
  {
    role: UserRole.ADMIN,
    name: 'Admin',
    description: 'Full control over all store settings and data',
    permissions: [
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
    isCustomizable: true,
  },
  {
    role: UserRole.MANAGER,
    name: 'Manager',
    description: 'Can manage orders, products and customers',
    permissions: [
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
    isCustomizable: true,
  },
  {
    role: UserRole.STAFF,
    name: 'Staff',
    description: 'Can view and process orders',
    permissions: [
      Permission.STORE_READ,
      Permission.PRODUCT_READ,
      Permission.ORDER_READ,
      Permission.ORDER_UPDATE,
      Permission.CUSTOMER_READ,
    ],
    isCustomizable: true,
  },
  {
    role: UserRole.READ_ONLY,
    name: 'Read Only',
    description: 'Can only view data without making changes',
    permissions: [
      Permission.STORE_READ,
      Permission.PRODUCT_READ,
      Permission.ORDER_READ,
      Permission.CUSTOMER_READ,
      Permission.ANALYTICS_READ,
    ],
    isCustomizable: false,
  },
] as const;

// Activity log
export interface TeamActivityLog extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly userId: UserId;
  readonly userName: string;
  readonly action: TeamAction;
  readonly resourceType?: string;
  readonly resourceId?: UUID;
  readonly resourceName?: string;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string;
}

export enum TeamAction {
  // Auth
  LOGIN = 'login',
  LOGOUT = 'logout',

  // Team
  MEMBER_INVITED = 'member_invited',
  MEMBER_JOINED = 'member_joined',
  MEMBER_REMOVED = 'member_removed',
  MEMBER_ROLE_CHANGED = 'member_role_changed',

  // Products
  PRODUCT_CREATED = 'product_created',
  PRODUCT_UPDATED = 'product_updated',
  PRODUCT_DELETED = 'product_deleted',

  // Orders
  ORDER_CREATED = 'order_created',
  ORDER_UPDATED = 'order_updated',
  ORDER_STATUS_CHANGED = 'order_status_changed',

  // Settings
  SETTINGS_UPDATED = 'settings_updated',
  INTEGRATION_CONNECTED = 'integration_connected',
  INTEGRATION_DISCONNECTED = 'integration_disconnected',
}
