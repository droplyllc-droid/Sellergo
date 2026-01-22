/**
 * Billing Controller
 */

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Headers, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SkipStoreCheck } from '../auth/decorators/skip-store-check.decorator';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Permission, TransactionType, TransactionStatus } from '@sellergo/types';
import {
  TopUpDto,
  UpdateBillingSettingsDto,
  TransactionFilterDto,
  AddPaymentMethodDto,
  CreateSubscriptionDto,
  CancelSubscriptionDto,
  ConfirmPaymentDto,
} from './dto';
import Stripe from 'stripe';
import { Request } from 'express';

@ApiTags('Billing')
@Controller('stores/:storeId/billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  // ==========================================================================
  // ACCOUNT
  // ==========================================================================

  @Get('account')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get billing account' })
  async getBillingAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.billingService.getBillingAccount(user.tenantId, storeId);
  }

  @Patch('settings')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @ApiOperation({ summary: 'Update billing settings' })
  async updateBillingSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: UpdateBillingSettingsDto,
  ) {
    return this.billingService.updateBillingSettings(user.tenantId, storeId, dto);
  }

  // ==========================================================================
  // TOP-UP
  // ==========================================================================

  @Post('top-up')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @ApiOperation({ summary: 'Create top-up payment' })
  @ApiResponse({ status: 201, description: 'Top-up initiated' })
  async createTopUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: TopUpDto,
  ) {
    return this.billingService.createTopUp(user.tenantId, storeId, dto.amount, dto.paymentMethodId);
  }

  @Post('confirm-payment')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm payment after client-side completion' })
  async confirmPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.billingService.completeTopUp(user.tenantId, dto.transactionId, dto.paymentIntentId);
  }

  // ==========================================================================
  // TRANSACTIONS
  // ==========================================================================

  @Get('transactions')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get transactions' })
  async getTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query() query: TransactionFilterDto,
  ) {
    return this.billingService.getTransactions(
      user.tenantId,
      storeId,
      {
        type: query.type,
        status: query.status,
        dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
        dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      },
      query.page,
      query.limit,
    );
  }

  @Get('transactions/:transactionId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get transaction by ID' })
  async getTransaction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('transactionId') transactionId: string,
  ) {
    return this.billingService.getTransaction(user.tenantId, transactionId);
  }

  // ==========================================================================
  // INVOICES
  // ==========================================================================

  @Get('invoices')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get invoices' })
  async getInvoices(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.billingService.getInvoices(user.tenantId, storeId, page || 1, limit || 20);
  }

  @Get('invoices/:invoiceId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get invoice by ID' })
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.billingService.getInvoice(user.tenantId, invoiceId);
  }

  // ==========================================================================
  // SUBSCRIPTIONS
  // ==========================================================================

  @Get('plans')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get subscription plans' })
  async getPlans() {
    return this.billingService.getSubscriptionPlans();
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get current subscription' })
  async getSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.billingService.getSubscription(user.tenantId, storeId);
  }

  @Post('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @ApiOperation({ summary: 'Create subscription' })
  @ApiResponse({ status: 201, description: 'Subscription created' })
  async createSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.billingService.createSubscription(user.tenantId, storeId, dto.planId, dto.paymentMethodId);
  }

  @Delete('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancelSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.billingService.cancelSubscription(user.tenantId, storeId, dto.cancelAtPeriodEnd);
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  @Get('payment-methods')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get payment methods' })
  async getPaymentMethods(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.billingService.getPaymentMethods(user.tenantId, storeId);
  }

  @Post('payment-methods')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @ApiOperation({ summary: 'Add payment method' })
  @ApiResponse({ status: 201, description: 'Payment method added' })
  async addPaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Body() dto: AddPaymentMethodDto,
  ) {
    return this.billingService.addPaymentMethod(user.tenantId, storeId, dto.paymentMethodId, dto.setAsDefault);
  }

  @Delete('payment-methods/:paymentMethodId')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove payment method' })
  async removePaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    return this.billingService.removePaymentMethod(user.tenantId, paymentMethodId);
  }

  @Post('payment-methods/:paymentMethodId/default')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set default payment method' })
  async setDefaultPaymentMethod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
    @Param('paymentMethodId') paymentMethodId: string,
  ) {
    return this.billingService.setDefaultPaymentMethod(user.tenantId, storeId, paymentMethodId);
  }

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  @Get('statistics')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get billing statistics' })
  async getBillingStatistics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.billingService.getBillingStatistics(user.tenantId, storeId);
  }

  @Get('usage')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, StoreGuard)
  @ApiBearerAuth()
  @RequirePermissions(Permission.BILLING_READ)
  @ApiOperation({ summary: 'Get usage metrics' })
  async getUsageMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('storeId') storeId: string,
  ) {
    return this.billingService.getUsageMetrics(user.tenantId, storeId);
  }
}

// Separate controller for Stripe webhooks
@ApiTags('Billing')
@Controller('webhooks')
export class StripeWebhookController {
  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService,
  ) {}

  @Post('stripe')
  @Public()
  @SkipStoreCheck()
  @SkipTenantCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const endpointSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    if (!stripeKey || !endpointSecret) {
      return { received: true };
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });
    const rawBody = req.rawBody;

    if (!rawBody) {
      return { received: true };
    }

    try {
      const event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
      await this.billingService.handleStripeWebhook(event);
      return { received: true };
    } catch (err) {
      return { received: false, error: 'Invalid signature' };
    }
  }
}
