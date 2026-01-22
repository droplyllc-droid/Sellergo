/**
 * Billing Repository
 */

import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { TransactionType, TransactionStatus, BillingModel, InvoiceStatus, SubscriptionStatus } from '@sellergo/types';

export interface TransactionFilter {
  type?: TransactionType;
  status?: TransactionStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

@Injectable()
export class BillingRepository {
  constructor(private readonly db: DatabaseService) {}

  // ==========================================================================
  // BILLING ACCOUNT
  // ==========================================================================

  async getBillingAccount(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.billingAccount.findUnique({
      where: { storeId },
    });
  }

  async createBillingAccount(tenantId: string, storeId: string, data: {
    balance?: number;
    currency?: string;
    feeRate?: number;
    billingModel?: BillingModel;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.billingAccount.create({
      data: {
        tenantId,
        storeId,
        balance: data.balance ?? 0,
        currency: data.currency ?? 'TND',
        feeRate: data.feeRate ?? 0.0027, // 0.27%
        billingModel: data.billingModel ?? 'pay_as_you_go',
        lowBalanceThreshold: 10,
        lowBalanceNotificationEnabled: true,
        autoTopUpEnabled: false,
      },
    });
  }

  async updateBillingAccount(tenantId: string, storeId: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.billingAccount.update({
      where: { storeId },
      data,
    });
  }

  async updateBalance(tenantId: string, storeId: string, amount: number) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.billingAccount.update({
      where: { storeId },
      data: {
        balance: { increment: amount },
        lastTopUpAt: amount > 0 ? new Date() : undefined,
      },
    });
  }

  // ==========================================================================
  // TRANSACTIONS
  // ==========================================================================

  async getTransactions(tenantId: string, storeId: string, filter: TransactionFilter, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;

    const where: Record<string, unknown> = { storeId };
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;
    if (filter.dateFrom || filter.dateTo) {
      where.createdAt = {};
      if (filter.dateFrom) (where.createdAt as Record<string, Date>).gte = filter.dateFrom;
      if (filter.dateTo) (where.createdAt as Record<string, Date>).lte = filter.dateTo;
    }

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getTransactionById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.transaction.findUnique({ where: { id } });
  }

  async createTransaction(tenantId: string, storeId: string, data: {
    type: TransactionType;
    status: TransactionStatus;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    currency: string;
    description: string;
    orderId?: string;
    orderNumber?: string;
    paymentProvider?: string;
    paymentIntentId?: string;
    paymentMethodLast4?: string;
    metadata?: Record<string, unknown>;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.transaction.create({
      data: {
        tenantId,
        storeId,
        ...data,
      },
    });
  }

  async updateTransaction(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.transaction.update({ where: { id }, data });
  }

  // ==========================================================================
  // INVOICES
  // ==========================================================================

  async getInvoices(tenantId: string, storeId: string, pagination: PaginationOptions) {
    const prisma = await this.db.withTenant(tenantId);
    const { page, limit } = pagination;

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { storeId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.invoice.count({ where: { storeId } }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getInvoiceById(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.invoice.findUnique({ where: { id } });
  }

  async createInvoice(tenantId: string, storeId: string, data: {
    invoiceNumber: string;
    periodStart: Date;
    periodEnd: Date;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    status: InvoiceStatus;
    dueDate: Date;
    items: Array<{ description: string; quantity: number; unitPrice: number; amount: number }>;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.invoice.create({
      data: {
        tenantId,
        storeId,
        ...data,
      },
    });
  }

  async updateInvoice(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.invoice.update({ where: { id }, data });
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  async getSubscription(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.subscription.findFirst({
      where: { storeId, status: { not: 'cancelled' } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSubscription(tenantId: string, storeId: string, data: {
    planId: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    stripeSubscriptionId?: string;
  }) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.subscription.create({
      data: {
        tenantId,
        storeId,
        cancelAtPeriodEnd: false,
        ...data,
      },
    });
  }

  async updateSubscription(tenantId: string, id: string, data: Record<string, unknown>) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.subscription.update({ where: { id }, data });
  }

  async cancelSubscription(tenantId: string, id: string, cancelAtPeriodEnd: boolean) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.subscription.update({
      where: { id },
      data: {
        cancelAtPeriodEnd,
        cancelledAt: new Date(),
        status: cancelAtPeriodEnd ? undefined : 'cancelled',
      },
    });
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  async getBillingStatistics(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [account, totalTopUps, totalFees, feesThisMonth, ordersThisMonth] = await Promise.all([
      prisma.billingAccount.findUnique({ where: { storeId } }),
      prisma.transaction.aggregate({
        where: { storeId, type: 'top_up', status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { storeId, type: 'order_fee', status: 'completed' },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          storeId,
          type: 'order_fee',
          status: 'completed',
          createdAt: { gte: monthStart },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({
        where: {
          storeId,
          type: 'order_fee',
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    const currency = account?.currency || 'TND';
    const totalFeesAmount = Math.abs(totalFees._sum.amount || 0);
    const feesThisMonthAmount = Math.abs(feesThisMonth._sum.amount || 0);

    return {
      currentBalance: { amount: account?.balance || 0, currency },
      totalTopUps: { amount: totalTopUps._sum.amount || 0, currency },
      totalFees: { amount: totalFeesAmount, currency },
      feesThisMonth: { amount: feesThisMonthAmount, currency },
      ordersThisMonth,
      averageFeePerOrder: {
        amount: ordersThisMonth > 0 ? feesThisMonthAmount / ordersThisMonth : 0,
        currency,
      },
    };
  }

  async getUsageMetrics(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);

    const [products, members, orders] = await Promise.all([
      prisma.product.count({ where: { storeId } }),
      prisma.storeMember.count({ where: { storeId } }),
      prisma.order.count({
        where: {
          storeId,
          createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
      }),
    ]);

    // Default limits for pay-as-you-go
    return {
      ordersCount: orders,
      ordersLimit: -1, // Unlimited
      productsCount: products,
      productsLimit: -1, // Unlimited
      teamMembersCount: members,
      teamMembersLimit: -1, // Unlimited
      storageUsedGb: 0, // Would need to calculate from uploaded files
      storageLimitGb: 10,
    };
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  async getPaymentMethods(tenantId: string, storeId: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.paymentMethod.findMany({
      where: { storeId },
      orderBy: { isDefault: 'desc' },
    });
  }

  async addPaymentMethod(tenantId: string, storeId: string, data: {
    stripePaymentMethodId: string;
    type: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }) {
    const prisma = await this.db.withTenant(tenantId);

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { storeId },
        data: { isDefault: false },
      });
    }

    return prisma.paymentMethod.create({
      data: {
        tenantId,
        storeId,
        ...data,
      },
    });
  }

  async removePaymentMethod(tenantId: string, id: string) {
    const prisma = await this.db.withTenant(tenantId);
    return prisma.paymentMethod.delete({ where: { id } });
  }

  async setDefaultPaymentMethod(tenantId: string, storeId: string, paymentMethodId: string) {
    const prisma = await this.db.withTenant(tenantId);

    await prisma.paymentMethod.updateMany({
      where: { storeId },
      data: { isDefault: false },
    });

    return prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true },
    });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  async generateInvoiceNumber(storeId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${year}${month}-${random}`;
  }
}
