/**
 * Customer types
 */

import type {
  TenantScopedEntity,
  UUID,
  Address,
  Money,
} from './common';

// Customer status
export enum CustomerStatus {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

// Block type
export enum BlockType {
  MANUAL = 'manual',
  IP = 'ip',
  PHONE = 'phone',
  EMAIL = 'email',
  PERMANENT = 'permanent',
}

// Customer entity
export interface Customer extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly email?: string;
  readonly phone: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly fullName: string;
  readonly status: CustomerStatus;

  // Address
  readonly defaultAddress?: Address;
  readonly addresses: readonly CustomerAddress[];

  // Stats
  readonly totalOrders: number;
  readonly totalSpent: number;
  readonly averageOrderValue: number;
  readonly lastOrderAt?: Date;
  readonly firstOrderAt?: Date;

  // Marketing
  readonly acceptsMarketing: boolean;
  readonly marketingOptInAt?: Date;

  // Notes
  readonly notes?: string;
  readonly tags: readonly string[];
}

// Customer address
export interface CustomerAddress extends Address {
  readonly id: UUID;
  readonly customerId: UUID;
  readonly label?: string;
  readonly isDefault: boolean;
}

// Customer block
export interface CustomerBlock extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly customerId?: UUID;
  readonly blockType: BlockType;
  readonly value: string;
  readonly reason?: string;
  readonly expiresAt?: Date;
  readonly isPermanent: boolean;
  readonly blockedBy: UUID;
}

// Customer statistics
export interface CustomerStatistics {
  readonly totalCustomers: number;
  readonly newCustomers: number;
  readonly repeatCustomers: number;
  readonly repeatRate: number;
  readonly totalRevenue: Money;
  readonly averageOrderValue: Money;
  readonly blockedCustomers: number;
  readonly ipBlocks: number;
  readonly phoneBlocks: number;
  readonly permanentBlocks: number;
}

// Customer list item
export interface CustomerListItem {
  readonly id: UUID;
  readonly fullName: string;
  readonly email?: string;
  readonly phone: string;
  readonly totalOrders: number;
  readonly totalSpent: number;
  readonly lastOrderAt?: Date;
  readonly firstOrderAt?: Date;
  readonly status: CustomerStatus;
  readonly createdAt: Date;
}

// Customer filter
export interface CustomerFilter {
  readonly status?: CustomerStatus;
  readonly search?: string;
  readonly hasEmail?: boolean;
  readonly minOrders?: number;
  readonly maxOrders?: number;
  readonly minSpent?: number;
  readonly maxSpent?: number;
  readonly tags?: readonly string[];
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
}

// Create customer request
export interface CreateCustomerRequest {
  readonly phone: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly address?: Address;
  readonly acceptsMarketing?: boolean;
  readonly notes?: string;
  readonly tags?: readonly string[];
}

// Update customer request
export interface UpdateCustomerRequest {
  readonly phone?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly acceptsMarketing?: boolean;
  readonly notes?: string;
  readonly tags?: readonly string[];
}

// Block customer request
export interface BlockCustomerRequest {
  readonly customerId?: UUID;
  readonly blockType: BlockType;
  readonly value: string;
  readonly reason?: string;
  readonly expiresAt?: Date;
  readonly isPermanent?: boolean;
}

// Customer order history
export interface CustomerOrderHistory {
  readonly customerId: UUID;
  readonly orders: readonly {
    readonly id: UUID;
    readonly orderNumber: string;
    readonly total: number;
    readonly status: string;
    readonly createdAt: Date;
  }[];
  readonly totalOrders: number;
  readonly totalSpent: number;
}

// Top customer
export interface TopCustomer {
  readonly id: UUID;
  readonly fullName: string;
  readonly email?: string;
  readonly phone: string;
  readonly totalOrders: number;
  readonly totalSpent: number;
  readonly averageOrderValue: number;
}

// Customer segment
export interface CustomerSegment extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly name: string;
  readonly description?: string;
  readonly filters: CustomerFilter;
  readonly customerCount: number;
  readonly isAutomatic: boolean;
  readonly lastUpdatedAt: Date;
}
