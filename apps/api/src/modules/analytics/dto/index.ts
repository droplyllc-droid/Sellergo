/**
 * Analytics DTOs
 */

import { IsString, IsEnum, IsOptional, IsNumber, IsObject, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TimePeriod, AnalyticsEventType } from '@sellergo/types';

// Time Period DTO
export class DateRangeDto {
  @ApiProperty()
  @IsString()
  startDate: string;

  @ApiProperty()
  @IsString()
  endDate: string;
}

// Dashboard Query DTO
export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: TimePeriod, default: TimePeriod.LAST_30_DAYS })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.LAST_30_DAYS;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;
}

// Top Products Query DTO
export class TopProductsQueryDto {
  @ApiPropertyOptional({ enum: TimePeriod, default: TimePeriod.LAST_30_DAYS })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.LAST_30_DAYS;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

// Profit Calculator DTO
export class ProfitCalculatorDto {
  @ApiProperty({ description: 'Delivery cost per order' })
  @IsNumber()
  @Min(0)
  deliveryCost: number;

  @ApiProperty({ description: 'Return cost per returned order' })
  @IsNumber()
  @Min(0)
  returnCost: number;

  @ApiProperty({ description: 'Fulfillment cost per order' })
  @IsNumber()
  @Min(0)
  fulfillmentCost: number;

  @ApiProperty({ description: 'Product cost (COGS)' })
  @IsNumber()
  @Min(0)
  productCost: number;

  @ApiProperty({ description: 'Cost per lead' })
  @IsNumber()
  @Min(0)
  leadCost: number;

  @ApiProperty({ description: 'Total number of leads' })
  @IsNumber()
  @Min(0)
  totalLeads: number;

  @ApiProperty({ description: 'Confirmation rate (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  confirmationRate: number;

  @ApiProperty({ description: 'Delivery rate (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  deliveryRate: number;

  @ApiProperty({ description: 'Selling price' })
  @IsNumber()
  @Min(0)
  sellingPrice: number;
}

// Track Event DTO
export class TrackEventDto {
  @ApiProperty()
  @IsString()
  sessionId: string;

  @ApiProperty()
  @IsString()
  visitorId: string;

  @ApiProperty({ enum: AnalyticsEventType })
  @IsEnum(AnalyticsEventType)
  eventType: AnalyticsEventType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  eventData?: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  pageUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiProperty()
  @IsString()
  userAgent: string;

  @ApiPropertyOptional({ enum: ['desktop', 'mobile', 'tablet'] })
  @IsOptional()
  @IsString()
  deviceType?: string;
}

// Export Query DTO
export class ExportQueryDto {
  @ApiProperty({ enum: ['sales', 'orders', 'customers', 'products'] })
  @IsString()
  type: 'sales' | 'orders' | 'customers' | 'products';

  @ApiPropertyOptional({ enum: TimePeriod })
  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.LAST_30_DAYS;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiProperty({ enum: ['csv', 'xlsx', 'json'] })
  @IsString()
  format: 'csv' | 'xlsx' | 'json';
}
