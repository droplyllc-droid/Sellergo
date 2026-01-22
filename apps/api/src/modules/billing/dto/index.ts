/**
 * Billing DTOs
 */

import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType, TransactionStatus } from '@sellergo/types';

// Top-up DTO
export class TopUpDto {
  @ApiProperty({ description: 'Amount to top up (minimum 10 TND)' })
  @IsNumber()
  @Min(10)
  amount: number;

  @ApiPropertyOptional({ description: 'Stripe payment method ID for immediate charge' })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

// Update billing settings DTO
export class UpdateBillingSettingsDto {
  @ApiPropertyOptional({ description: 'Low balance threshold for notifications' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowBalanceThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  lowBalanceNotificationEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoTopUpEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Amount to automatically top up' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  autoTopUpAmount?: number;

  @ApiPropertyOptional({ description: 'Balance threshold to trigger auto top-up' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  autoTopUpThreshold?: number;
}

// Transaction filter DTO
export class TransactionFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: TransactionType })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ enum: TransactionStatus })
  @IsOptional()
  @IsEnum(TransactionStatus)
  status?: TransactionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateTo?: string;
}

// Add payment method DTO
export class AddPaymentMethodDto {
  @ApiProperty({ description: 'Stripe payment method ID' })
  @IsString()
  paymentMethodId: string;

  @ApiPropertyOptional({ description: 'Set as default payment method' })
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean = true;
}

// Create subscription DTO
export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Plan ID (free, starter, professional, enterprise)' })
  @IsString()
  planId: string;

  @ApiPropertyOptional({ description: 'Stripe payment method ID for paid plans' })
  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

// Cancel subscription DTO
export class CancelSubscriptionDto {
  @ApiPropertyOptional({ description: 'If true, subscription will be cancelled at period end' })
  @IsOptional()
  @IsBoolean()
  cancelAtPeriodEnd?: boolean = true;
}

// Stripe webhook DTO
export class StripeWebhookDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  data: {
    object: Record<string, unknown>;
  };
}

// Payment intent confirmation DTO
export class ConfirmPaymentDto {
  @ApiProperty({ description: 'Transaction ID' })
  @IsString()
  transactionId: string;

  @ApiProperty({ description: 'Stripe payment intent ID' })
  @IsString()
  paymentIntentId: string;
}
