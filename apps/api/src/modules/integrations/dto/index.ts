/**
 * Integrations DTOs
 */

import { IsString, IsEnum, IsOptional, IsBoolean, IsArray, IsObject, IsUrl, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PixelProvider, WebhookEvent, AppCategory } from '@sellergo/types';

// ==========================================================================
// PIXEL DTOs
// ==========================================================================

export class CreatePixelDto {
  @ApiProperty({ enum: PixelProvider })
  @IsEnum(PixelProvider)
  provider: PixelProvider;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'The pixel ID from the ad platform' })
  @IsString()
  pixelId: string;

  @ApiPropertyOptional({ description: 'Access token for Conversions API' })
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional({ description: 'Test event code for debugging' })
  @IsOptional()
  @IsString()
  testEventCode?: string;

  @ApiPropertyOptional({ description: 'Enable server-side Conversions API' })
  @IsOptional()
  @IsBoolean()
  enableConversionsApi?: boolean;
}

export class UpdatePixelDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pixelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accessToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testEventCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableConversionsApi?: boolean;
}

// ==========================================================================
// WEBHOOK DTOs
// ==========================================================================

export class CreateWebhookDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'The URL to send webhook events to' })
  @IsUrl({ require_tld: false }) // Allow localhost for development
  url: string;

  @ApiProperty({ enum: WebhookEvent, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(WebhookEvent, { each: true })
  events: WebhookEvent[];

  @ApiPropertyOptional({ description: 'Custom headers to include in requests' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @ApiPropertyOptional({ enum: WebhookEvent, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  events?: WebhookEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

// ==========================================================================
// ANALYTICS INTEGRATION DTOs
// ==========================================================================

export class GoogleAnalyticsConfigDto {
  @ApiProperty({ description: 'GA4 Measurement ID (G-XXXXXXXXXX)' })
  @IsString()
  measurementId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableEnhancedEcommerce?: boolean;
}

export class GoogleTagManagerConfigDto {
  @ApiProperty({ description: 'GTM Container ID (GTM-XXXXXXX)' })
  @IsString()
  containerId: string;
}

export class GoogleAdsConfigDto {
  @ApiProperty({ description: 'Google Ads Conversion ID' })
  @IsString()
  conversionId: string;

  @ApiPropertyOptional({ description: 'Conversion Label' })
  @IsOptional()
  @IsString()
  conversionLabel?: string;
}

// ==========================================================================
// APP DTOs
// ==========================================================================

export class InstallAppDto {
  @ApiProperty({ description: 'App ID from the catalog' })
  @IsString()
  appId: string;

  @ApiProperty({ description: 'App-specific configuration' })
  @IsObject()
  config: Record<string, unknown>;
}

export class UpdateAppConfigDto {
  @ApiProperty({ description: 'Updated configuration' })
  @IsObject()
  config: Record<string, unknown>;
}

export class GoogleSheetsConfigDto {
  @ApiProperty()
  @IsString()
  spreadsheetId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sheetName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  columnMapping?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncNewOrders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncOrderUpdates?: boolean;
}

export class WhatsAppConfigDto {
  @ApiProperty()
  @IsString()
  phoneNumberId: string;

  @ApiProperty()
  @IsString()
  accessToken: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableOrderConfirmation?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableShippingUpdates?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enableDeliveryNotification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  templates?: Record<string, string>;
}

export class ZapierConfigDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  webhookUrl: string;

  @ApiPropertyOptional({ enum: WebhookEvent, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(WebhookEvent, { each: true })
  triggerEvents?: WebhookEvent[];
}

// ==========================================================================
// QUERY DTOs
// ==========================================================================

export class AppsQueryDto {
  @ApiPropertyOptional({ enum: AppCategory })
  @IsOptional()
  @IsEnum(AppCategory)
  category?: AppCategory;
}
