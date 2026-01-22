/**
 * Billing types
 */

import type {
  TenantScopedEntity,
  UUID,
  Money,
} from './common';

// Billing model
export enum BillingModel {
  PAY_AS_YOU_GO = 'pay_as_you_go',
  SUBSCRIPTION = 'subscription',
}

// Transaction type
export enum TransactionType {
  TOP_UP = 'top_up',
  ORDER_FEE = 'order_fee',
  REFUND = 'refund',
  ADJUSTMENT = 'adjustment',
  SUBSCRIPTION = 'subscription',
  BONUS = 'bonus',
}

// Transaction status
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

// Payment provider
export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank_transfer',
}

// Billing account
export interface BillingAccount extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly balance: number;
  readonly currency: string;
  readonly feeRate: number;
  readonly billingModel: BillingModel;
  readonly stripeCustomerId?: string;
  readonly stripePaymentMethodId?: string;
  readonly lastTopUpAt?: Date;
  readonly lowBalanceThreshold: number;
  readonly lowBalanceNotificationEnabled: boolean;
  readonly autoTopUpEnabled: boolean;
  readonly autoTopUpAmount?: number;
  readonly autoTopUpThreshold?: number;
}

// Transaction
export interface Transaction extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly amount: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly currency: string;
  readonly description: string;
  readonly orderId?: UUID;
  readonly orderNumber?: string;
  readonly paymentProvider?: PaymentProvider;
  readonly paymentIntentId?: string;
  readonly paymentMethodLast4?: string;
  readonly metadata?: Record<string, unknown>;
  readonly failureReason?: string;
}

// Invoice
export interface Invoice extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly invoiceNumber: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly subtotal: number;
  readonly tax: number;
  readonly total: number;
  readonly currency: string;
  readonly status: InvoiceStatus;
  readonly paidAt?: Date;
  readonly dueDate: Date;
  readonly items: readonly InvoiceItem[];
  readonly pdfUrl?: string;
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  PAID = 'paid',
  VOID = 'void',
  UNCOLLECTIBLE = 'uncollectible',
}

export interface InvoiceItem {
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly amount: number;
}

// Subscription plan
export interface SubscriptionPlan {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly price: number;
  readonly currency: string;
  readonly interval: 'month' | 'year';
  readonly features: readonly string[];
  readonly limits: PlanLimits;
  readonly isPopular: boolean;
  readonly stripePriceId?: string;
}

export interface PlanLimits {
  readonly maxProducts: number;
  readonly maxOrders: number;
  readonly maxTeamMembers: number;
  readonly maxStorageGb: number;
  readonly customDomain: boolean;
  readonly prioritySupport: boolean;
  readonly apiAccess: boolean;
  readonly whiteLabeling: boolean;
}

// Subscription
export interface Subscription extends TenantScopedEntity {
  readonly storeId: UUID;
  readonly planId: string;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: Date;
  readonly currentPeriodEnd: Date;
  readonly cancelAtPeriodEnd: boolean;
  readonly cancelledAt?: Date;
  readonly stripeSubscriptionId?: string;
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
}

// Top-up request
export interface TopUpRequest {
  readonly amount: number;
  readonly paymentMethodId?: string;
}

// Top-up response
export interface TopUpResponse {
  readonly transactionId: UUID;
  readonly clientSecret?: string;
  readonly status: TransactionStatus;
}

// Billing statistics
export interface BillingStatistics {
  readonly currentBalance: Money;
  readonly totalTopUps: Money;
  readonly totalFees: Money;
  readonly feesThisMonth: Money;
  readonly ordersThisMonth: number;
  readonly averageFeePerOrder: Money;
}

// Transaction filter
export interface TransactionFilter {
  readonly type?: TransactionType;
  readonly status?: TransactionStatus;
  readonly dateFrom?: Date;
  readonly dateTo?: Date;
}

// Usage metrics
export interface UsageMetrics {
  readonly ordersCount: number;
  readonly ordersLimit: number;
  readonly productsCount: number;
  readonly productsLimit: number;
  readonly teamMembersCount: number;
  readonly teamMembersLimit: number;
  readonly storageUsedGb: number;
  readonly storageLimitGb: number;
}

// Payment method
export interface StoredPaymentMethod {
  readonly id: string;
  readonly type: 'card';
  readonly brand: string;
  readonly last4: string;
  readonly expMonth: number;
  readonly expYear: number;
  readonly isDefault: boolean;
}

// Add payment method request
export interface AddPaymentMethodRequest {
  readonly paymentMethodId: string;
  readonly setAsDefault?: boolean;
}

// Platform fee configuration
export const PLATFORM_FEE_CONFIG = {
  defaultFeeRate: 0.0027, // 0.27%
  minimumTopUp: 10, // $10 minimum
  topUpAmounts: [50, 100, 250, 500, 1000] as const,
} as const;
