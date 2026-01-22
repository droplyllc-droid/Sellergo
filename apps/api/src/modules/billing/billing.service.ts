/**
 * Billing Service
 * Handles billing, payments, and Stripe integration
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingRepository, TransactionFilter } from './billing.repository';
import { QueueService } from '../../core/queue/queue.service';
import { RedisService } from '../../core/redis/redis.service';
import {
  ErrorCode,
  TransactionType,
  TransactionStatus,
  InvoiceStatus,
  SubscriptionStatus,
  PLATFORM_FEE_CONFIG,
  SubscriptionPlan,
} from '@sellergo/types';
import Stripe from 'stripe';

// Subscription plans
const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    currency: 'TND',
    interval: 'month',
    features: ['Up to 50 products', 'Up to 100 orders/month', '1 team member', '1GB storage'],
    limits: {
      maxProducts: 50,
      maxOrders: 100,
      maxTeamMembers: 1,
      maxStorageGb: 1,
      customDomain: false,
      prioritySupport: false,
      apiAccess: false,
      whiteLabeling: false,
    },
    isPopular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'For growing businesses',
    price: 49,
    currency: 'TND',
    interval: 'month',
    features: [
      'Unlimited products',
      'Up to 500 orders/month',
      '3 team members',
      '5GB storage',
      'Custom domain',
    ],
    limits: {
      maxProducts: -1,
      maxOrders: 500,
      maxTeamMembers: 3,
      maxStorageGb: 5,
      customDomain: true,
      prioritySupport: false,
      apiAccess: false,
      whiteLabeling: false,
    },
    isPopular: true,
    stripePriceId: 'price_starter_monthly',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'For scaling businesses',
    price: 149,
    currency: 'TND',
    interval: 'month',
    features: [
      'Unlimited products',
      'Unlimited orders',
      '10 team members',
      '20GB storage',
      'Custom domain',
      'Priority support',
      'API access',
    ],
    limits: {
      maxProducts: -1,
      maxOrders: -1,
      maxTeamMembers: 10,
      maxStorageGb: 20,
      customDomain: true,
      prioritySupport: true,
      apiAccess: true,
      whiteLabeling: false,
    },
    isPopular: false,
    stripePriceId: 'price_professional_monthly',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 399,
    currency: 'TND',
    interval: 'month',
    features: [
      'Unlimited everything',
      'Unlimited team members',
      '100GB storage',
      'Custom domain',
      'Priority support',
      'API access',
      'White labeling',
    ],
    limits: {
      maxProducts: -1,
      maxOrders: -1,
      maxTeamMembers: -1,
      maxStorageGb: 100,
      customDomain: true,
      prioritySupport: true,
      apiAccess: true,
      whiteLabeling: true,
    },
    isPopular: false,
    stripePriceId: 'price_enterprise_monthly',
  },
];

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly billingRepository: BillingRepository,
    private readonly queueService: QueueService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (stripeKey) {
      this.stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' as any });
    }
  }

  // ==========================================================================
  // BILLING ACCOUNT
  // ==========================================================================

  async getBillingAccount(tenantId: string, storeId: string) {
    let account = await this.billingRepository.getBillingAccount(tenantId, storeId);

    if (!account) {
      // Create billing account if it doesn't exist
      account = await this.billingRepository.createBillingAccount(tenantId, storeId, {});
    }

    return account;
  }

  async updateBillingSettings(tenantId: string, storeId: string, settings: {
    lowBalanceThreshold?: number;
    lowBalanceNotificationEnabled?: boolean;
    autoTopUpEnabled?: boolean;
    autoTopUpAmount?: number;
    autoTopUpThreshold?: number;
  }) {
    await this.getBillingAccount(tenantId, storeId);
    return this.billingRepository.updateBillingAccount(tenantId, storeId, settings);
  }

  // ==========================================================================
  // TOP-UP
  // ==========================================================================

  async createTopUp(tenantId: string, storeId: string, amount: number, paymentMethodId?: string) {
    if (amount < PLATFORM_FEE_CONFIG.minimumTopUp) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Minimum top-up amount is ${PLATFORM_FEE_CONFIG.minimumTopUp} TND`,
      });
    }

    const account = await this.getBillingAccount(tenantId, storeId);

    // Create pending transaction
    const transaction = await this.billingRepository.createTransaction(tenantId, storeId, {
      type: TransactionType.TOP_UP,
      status: TransactionStatus.PENDING,
      amount,
      balanceBefore: account.balance,
      balanceAfter: account.balance + amount,
      currency: account.currency,
      description: `Top-up of ${amount} ${account.currency}`,
    });

    if (!this.stripe) {
      // For development/testing without Stripe
      await this.completeTopUp(tenantId, transaction.id, 'test_payment');
      return { transactionId: transaction.id, status: TransactionStatus.COMPLETED };
    }

    try {
      // Create or get Stripe customer
      let customerId = account.stripeCustomerId;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          metadata: { tenantId, storeId },
        });
        customerId = customer.id;
        await this.billingRepository.updateBillingAccount(tenantId, storeId, { stripeCustomerId: customerId });
      }

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: account.currency.toLowerCase(),
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: !!paymentMethodId,
        automatic_payment_methods: paymentMethodId ? undefined : { enabled: true },
        metadata: {
          tenantId,
          storeId,
          transactionId: transaction.id,
          type: 'top_up',
        },
      });

      await this.billingRepository.updateTransaction(tenantId, transaction.id, {
        paymentIntentId: paymentIntent.id,
        paymentProvider: 'stripe',
      });

      if (paymentIntent.status === 'succeeded') {
        await this.completeTopUp(tenantId, transaction.id, paymentIntent.id);
        return { transactionId: transaction.id, status: TransactionStatus.COMPLETED };
      }

      return {
        transactionId: transaction.id,
        clientSecret: paymentIntent.client_secret,
        status: TransactionStatus.PENDING,
      };
    } catch (error) {
      await this.billingRepository.updateTransaction(tenantId, transaction.id, {
        status: TransactionStatus.FAILED,
        failureReason: error instanceof Error ? error.message : 'Payment failed',
      });

      throw new BadRequestException({
        code: ErrorCode.STRIPE_ERROR,
        message: 'Payment processing failed',
      });
    }
  }

  async completeTopUp(tenantId: string, transactionId: string, paymentIntentId: string) {
    const transaction = await this.billingRepository.getTransactionById(tenantId, transactionId);
    if (!transaction || transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid transaction' });
    }

    // Update balance
    await this.billingRepository.updateBalance(tenantId, transaction.storeId, transaction.amount);

    // Complete transaction
    await this.billingRepository.updateTransaction(tenantId, transactionId, {
      status: TransactionStatus.COMPLETED,
      paymentIntentId,
    });

    // Send notification
    await this.queueService.addJob('notification', 'balance-topped-up', {
      storeId: transaction.storeId,
      amount: transaction.amount,
      currency: transaction.currency,
    });
  }

  // ==========================================================================
  // ORDER FEE
  // ==========================================================================

  async chargeOrderFee(tenantId: string, storeId: string, orderId: string, orderNumber: string, orderTotal: number) {
    const account = await this.getBillingAccount(tenantId, storeId);
    const feeAmount = Math.round(orderTotal * account.feeRate * 100) / 100; // Round to 2 decimal places

    if (feeAmount <= 0) return null;

    // Check balance
    if (account.balance < feeAmount) {
      // Queue low balance notification
      await this.queueService.addJob('notification', 'low-balance', {
        storeId,
        currentBalance: account.balance,
        requiredAmount: feeAmount,
      });

      throw new BadRequestException({
        code: ErrorCode.INSUFFICIENT_BALANCE,
        message: 'Insufficient balance to process order',
      });
    }

    // Deduct fee
    await this.billingRepository.updateBalance(tenantId, storeId, -feeAmount);

    // Create transaction
    const transaction = await this.billingRepository.createTransaction(tenantId, storeId, {
      type: TransactionType.ORDER_FEE,
      status: TransactionStatus.COMPLETED,
      amount: -feeAmount,
      balanceBefore: account.balance,
      balanceAfter: account.balance - feeAmount,
      currency: account.currency,
      description: `Fee for order ${orderNumber}`,
      orderId,
      orderNumber,
    });

    // Check if balance is low
    const newBalance = account.balance - feeAmount;
    if (newBalance <= account.lowBalanceThreshold && account.lowBalanceNotificationEnabled) {
      await this.queueService.addJob('notification', 'low-balance-warning', {
        storeId,
        currentBalance: newBalance,
        threshold: account.lowBalanceThreshold,
      });
    }

    // Auto top-up if enabled
    if (account.autoTopUpEnabled && account.autoTopUpAmount && account.autoTopUpThreshold) {
      if (newBalance <= account.autoTopUpThreshold) {
        await this.createTopUp(tenantId, storeId, account.autoTopUpAmount);
      }
    }

    return transaction;
  }

  // ==========================================================================
  // TRANSACTIONS
  // ==========================================================================

  async getTransactions(tenantId: string, storeId: string, filter: TransactionFilter, page = 1, limit = 20) {
    return this.billingRepository.getTransactions(tenantId, storeId, filter, { page, limit });
  }

  async getTransaction(tenantId: string, transactionId: string) {
    const transaction = await this.billingRepository.getTransactionById(tenantId, transactionId);
    if (!transaction) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Transaction not found' });
    }
    return transaction;
  }

  // ==========================================================================
  // INVOICES
  // ==========================================================================

  async getInvoices(tenantId: string, storeId: string, page = 1, limit = 20) {
    return this.billingRepository.getInvoices(tenantId, storeId, { page, limit });
  }

  async getInvoice(tenantId: string, invoiceId: string) {
    const invoice = await this.billingRepository.getInvoiceById(tenantId, invoiceId);
    if (!invoice) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Invoice not found' });
    }
    return invoice;
  }

  async generateMonthlyInvoice(tenantId: string, storeId: string) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get all order fees for the period
    const transactions = await this.billingRepository.getTransactions(
      tenantId,
      storeId,
      {
        type: TransactionType.ORDER_FEE,
        status: TransactionStatus.COMPLETED,
        dateFrom: periodStart,
        dateTo: periodEnd,
      },
      { page: 1, limit: 10000 },
    );

    const subtotal = Math.abs(transactions.items.reduce((sum, t) => sum + t.amount, 0));
    const tax = 0; // No VAT for now
    const total = subtotal + tax;

    const invoiceNumber = await this.billingRepository.generateInvoiceNumber(storeId);

    return this.billingRepository.createInvoice(tenantId, storeId, {
      invoiceNumber,
      periodStart,
      periodEnd,
      subtotal,
      tax,
      total,
      currency: 'TND',
      status: InvoiceStatus.PAID, // Auto-paid from balance
      dueDate: new Date(),
      items: [{
        description: `Platform fees (${transactions.items.length} orders)`,
        quantity: transactions.items.length,
        unitPrice: transactions.items.length > 0 ? subtotal / transactions.items.length : 0,
        amount: subtotal,
      }],
    });
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  async getSubscriptionPlans() {
    return SUBSCRIPTION_PLANS;
  }

  async getSubscription(tenantId: string, storeId: string) {
    const subscription = await this.billingRepository.getSubscription(tenantId, storeId);
    if (subscription) {
      const plan = SUBSCRIPTION_PLANS.find(p => p.id === subscription.planId);
      return { ...subscription, plan };
    }
    return null;
  }

  async createSubscription(tenantId: string, storeId: string, planId: string, paymentMethodId?: string) {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Invalid plan' });
    }

    // Check for existing subscription
    const existing = await this.billingRepository.getSubscription(tenantId, storeId);
    if (existing && existing.status === SubscriptionStatus.ACTIVE) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Store already has an active subscription' });
    }

    if (plan.price === 0) {
      // Free plan - no Stripe needed
      const now = new Date();
      return this.billingRepository.createSubscription(tenantId, storeId, {
        planId,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()),
      });
    }

    if (!this.stripe || !plan.stripePriceId) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Stripe not configured' });
    }

    const account = await this.getBillingAccount(tenantId, storeId);
    let customerId = account.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { tenantId, storeId },
      });
      customerId = customer.id;
      await this.billingRepository.updateBillingAccount(tenantId, storeId, { stripeCustomerId: customerId });
    }

    const stripeSubscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripePriceId }],
      default_payment_method: paymentMethodId,
      metadata: { tenantId, storeId, planId },
    });

    return this.billingRepository.createSubscription(tenantId, storeId, {
      planId,
      status: stripeSubscription.status as SubscriptionStatus,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      stripeSubscriptionId: stripeSubscription.id,
    });
  }

  async cancelSubscription(tenantId: string, storeId: string, cancelAtPeriodEnd = true) {
    const subscription = await this.billingRepository.getSubscription(tenantId, storeId);
    if (!subscription) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'No active subscription' });
    }

    if (this.stripe && subscription.stripeSubscriptionId) {
      if (cancelAtPeriodEnd) {
        await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        await this.stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      }
    }

    return this.billingRepository.cancelSubscription(tenantId, subscription.id, cancelAtPeriodEnd);
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  async getPaymentMethods(tenantId: string, storeId: string) {
    return this.billingRepository.getPaymentMethods(tenantId, storeId);
  }

  async addPaymentMethod(tenantId: string, storeId: string, stripePaymentMethodId: string, setAsDefault = true) {
    if (!this.stripe) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION_ERROR, message: 'Stripe not configured' });
    }

    const account = await this.getBillingAccount(tenantId, storeId);
    let customerId = account.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        metadata: { tenantId, storeId },
      });
      customerId = customer.id;
      await this.billingRepository.updateBillingAccount(tenantId, storeId, { stripeCustomerId: customerId });
    }

    // Attach payment method to customer
    const paymentMethod = await this.stripe.paymentMethods.attach(stripePaymentMethodId, {
      customer: customerId,
    });

    if (setAsDefault) {
      await this.stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: stripePaymentMethodId },
      });
    }

    const card = paymentMethod.card!;
    return this.billingRepository.addPaymentMethod(tenantId, storeId, {
      stripePaymentMethodId,
      type: 'card',
      brand: card.brand || 'unknown',
      last4: card.last4 || '****',
      expMonth: card.exp_month,
      expYear: card.exp_year,
      isDefault: setAsDefault,
    });
  }

  async removePaymentMethod(tenantId: string, paymentMethodId: string) {
    const methods = await this.billingRepository.getPaymentMethods(tenantId, paymentMethodId);
    const method = methods.find(m => m.id === paymentMethodId);

    if (!method) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Payment method not found' });
    }

    if (this.stripe && method.stripePaymentMethodId) {
      await this.stripe.paymentMethods.detach(method.stripePaymentMethodId);
    }

    await this.billingRepository.removePaymentMethod(tenantId, paymentMethodId);
    return { success: true };
  }

  async setDefaultPaymentMethod(tenantId: string, storeId: string, paymentMethodId: string) {
    const methods = await this.billingRepository.getPaymentMethods(tenantId, storeId);
    const method = methods.find(m => m.id === paymentMethodId);

    if (!method) {
      throw new NotFoundException({ code: ErrorCode.RESOURCE_NOT_FOUND, message: 'Payment method not found' });
    }

    const account = await this.getBillingAccount(tenantId, storeId);

    if (this.stripe && account.stripeCustomerId && method.stripePaymentMethodId) {
      await this.stripe.customers.update(account.stripeCustomerId, {
        invoice_settings: { default_payment_method: method.stripePaymentMethodId },
      });
    }

    return this.billingRepository.setDefaultPaymentMethod(tenantId, storeId, paymentMethodId);
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  async getBillingStatistics(tenantId: string, storeId: string) {
    return this.billingRepository.getBillingStatistics(tenantId, storeId);
  }

  async getUsageMetrics(tenantId: string, storeId: string) {
    const [metrics, subscription] = await Promise.all([
      this.billingRepository.getUsageMetrics(tenantId, storeId),
      this.getSubscription(tenantId, storeId),
    ]);

    // Apply plan limits if subscription exists
    if (subscription?.plan) {
      return {
        ...metrics,
        ordersLimit: subscription.plan.limits.maxOrders,
        productsLimit: subscription.plan.limits.maxProducts,
        teamMembersLimit: subscription.plan.limits.maxTeamMembers,
        storageLimitGb: subscription.plan.limits.maxStorageGb,
      };
    }

    return metrics;
  }

  // ==========================================================================
  // STRIPE WEBHOOKS
  // ==========================================================================

  async handleStripeWebhook(event: Stripe.Event) {
    this.logger.debug(`Handling Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const { tenantId, transactionId } = paymentIntent.metadata;
    if (tenantId && transactionId) {
      await this.completeTopUp(tenantId, transactionId, paymentIntent.id);
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const { tenantId, transactionId } = paymentIntent.metadata;
    if (tenantId && transactionId) {
      await this.billingRepository.updateTransaction(tenantId, transactionId, {
        status: TransactionStatus.FAILED,
        failureReason: paymentIntent.last_payment_error?.message || 'Payment failed',
      });
    }
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    // Handle subscription invoice payment
    this.logger.debug(`Invoice paid: ${invoice.id}`);
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const { tenantId, storeId } = subscription.metadata;
    if (tenantId && storeId) {
      const sub = await this.billingRepository.getSubscription(tenantId, storeId);
      if (sub && sub.stripeSubscriptionId === subscription.id) {
        await this.billingRepository.updateSubscription(tenantId, sub.id, {
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        });
      }
    }
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    const { tenantId, storeId } = subscription.metadata;
    if (tenantId && storeId) {
      const sub = await this.billingRepository.getSubscription(tenantId, storeId);
      if (sub && sub.stripeSubscriptionId === subscription.id) {
        await this.billingRepository.updateSubscription(tenantId, sub.id, {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
        });
      }
    }
  }
}
